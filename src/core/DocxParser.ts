import JSZip from 'jszip';
import type { DocumentNode, TextRun, Alignment, PageSettings, ParagraphProperties, TabStop, DocumentDefaults } from './types';

// Twips to Pixels conversion factor (1440 twips = 1 inch = 96 pixels)
const TWIP_TO_PX = 96 / 1440;

export async function parseDocxBuffer(arrayBuffer: ArrayBuffer): Promise<{ nodes: DocumentNode[], pageSettings: PageSettings, defaults: DocumentDefaults }> {
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Find elements regardless of namespace prefix
    const byTag = (element: Document | Element, tagName: string): Element[] => {
        let results = Array.from(element.getElementsByTagName(tagName));
        if (results.length > 0) return results;
        const localName = tagName.includes(':') ? tagName.split(':')[1] : tagName;
        results = Array.from(element.getElementsByTagName(localName));
        if (results.length > 0) return results;
        const all = Array.from(element.getElementsByTagName('*'));
        return all.filter(el =>
            el.localName === localName ||
            el.nodeName === tagName ||
            el.nodeName.endsWith(`:${localName}`)
        );
    };

    const directByTag = (element: Element, tagName: string): Element[] => {
        const localName = tagName.includes(':') ? tagName.split(':')[1] : tagName;
        return Array.from(element.children).filter(el =>
            el.localName === localName ||
            el.nodeName === tagName ||
            el.nodeName.endsWith(`:${localName}`)
        );
    };

    // 1. Relationships
    const relsXmlFile = zip.file('word/_rels/document.xml.rels');
    const relationships: Record<string, string> = {};
    if (relsXmlFile) {
        const relsContent = await relsXmlFile.async('text');
        const p = new DOMParser();
        const relsDoc = p.parseFromString(relsContent.replace(/xmlns=".*?"/g, ''), 'text/xml');
        for (const rel of byTag(relsDoc, 'Relationship')) {
            const id = rel.getAttribute('Id');
            const target = rel.getAttribute('Target');
            if (id && target) relationships[id] = target;
        }
    }

    // 2. Styles
    let defaults: DocumentDefaults = {
        fontFamily: 'Times New Roman',
        fontSize: 11
    };
    const stylesXmlFile = zip.file('word/styles.xml');
    if (stylesXmlFile) {
        const stylesContent = await stylesXmlFile.async('text');
        const stylesDoc = new DOMParser().parseFromString(stylesContent, 'text/xml');
        const docDefaults = byTag(stylesDoc, 'w:docDefaults')[0];
        if (docDefaults) {
            const rPrDefault = byTag(docDefaults, 'w:rPrDefault')[0];
            if (rPrDefault) {
                const rPr = byTag(rPrDefault, 'w:rPr')[0];
                if (rPr) {
                    const sz = byTag(rPr, 'w:sz')[0];
                    if (sz) defaults.fontSize = (Number(sz.getAttribute('w:val')) || 24) / 2;
                    const rFonts = byTag(rPr, 'w:rFonts')[0];
                    if (rFonts) defaults.fontFamily = rFonts.getAttribute('w:ascii') || rFonts.getAttribute('w:hAnsi') || 'Times New Roman';
                }
            }
        }
    }

    // 3. document.xml
    const documentXmlFile = zip.file('word/document.xml');
    if (!documentXmlFile) throw new Error('Invalid DOCX: word/document.xml not found.');
    const xmlContent = await documentXmlFile.async('text');
    const xmlDoc = new DOMParser().parseFromString(xmlContent, 'text/xml');

    // 3a. Extract Section Properties (Page Size, Margins)
    const sectPrs = byTag(xmlDoc, 'w:sectPr');
    let pageSettings: PageSettings = {
        width: 816, // Default A4 approx
        height: 1056,
        margins: { top: 96, bottom: 96, left: 96, right: 96 }
    };

    if (sectPrs.length > 0) {
        const sectPr = sectPrs[sectPrs.length - 1]; // Use the last one for global settings
        const pgSz = byTag(sectPr, 'w:pgSz')[0];
        if (pgSz) {
            const w = Number(pgSz.getAttribute('w:w')) || 0;
            const h = Number(pgSz.getAttribute('w:h')) || 0;
            if (w) pageSettings.width = w * TWIP_TO_PX;
            if (h) pageSettings.height = h * TWIP_TO_PX;
        }
        const pgMar = byTag(sectPr, 'w:pgMar')[0];
        if (pgMar) {
            const t = Number(pgMar.getAttribute('w:top')) || 0;
            const b = Number(pgMar.getAttribute('w:bottom')) || 0;
            const l = Number(pgMar.getAttribute('w:left')) || 0;
            const r = Number(pgMar.getAttribute('w:right')) || 0;
            pageSettings.margins = {
                top: t * TWIP_TO_PX,
                bottom: b * TWIP_TO_PX,
                left: l * TWIP_TO_PX,
                right: r * TWIP_TO_PX
            };
        }
    }

    const nodes: DocumentNode[] = [];

    // Base64 image helper
    const getBase64Image = async (targetPath: string): Promise<{ src: string; natW: number; natH: number } | null> => {
        const normalizedPath = `word/${targetPath}`;
        let imageFile = zip.file(normalizedPath) || zip.file(targetPath);
        if (!imageFile) {
            const basename = targetPath.split('/').pop();
            const matched = Object.keys(zip.files).find(f => f.endsWith(basename || targetPath));
            if (matched) imageFile = zip.file(matched);
        }
        if (!imageFile) return null;
        const base64 = await imageFile.async('base64');
        let mime = 'image/jpeg';
        const lp = targetPath.toLowerCase();
        if (lp.endsWith('png')) mime = 'image/png';
        if (lp.endsWith('gif')) mime = 'image/gif';
        if (lp.endsWith('svg')) mime = 'image/svg+xml';
        const b64url = `data:${mime};base64,${base64}`;
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve({ src: b64url, natW: img.naturalWidth, natH: img.naturalHeight });
            img.onerror = () => resolve({ src: b64url, natW: 300, natH: 300 });
            img.src = b64url;
        });
    };

    // Extract paragraph properties <w:pPr>
    const extractParaProps = (p: Element): ParagraphProperties => {
        const pPrList = byTag(p, 'w:pPr');
        if (pPrList.length === 0) return {};
        const pPr = pPrList[0];
        const props: ParagraphProperties = {};

        // Alignment
        const jcNodes = byTag(pPr, 'w:jc');
        if (jcNodes.length > 0) {
            const val = jcNodes[0].getAttribute('w:val');
            if (val === 'center') props.align = 'center';
            else if (val === 'right') props.align = 'right';
            else if (val === 'both' || val === 'distribute') props.align = 'both';
            else props.align = 'left';
        }

        // Spacing (Line Spacing, Before/After)
        const spacing = byTag(pPr, 'w:spacing')[0];
        if (spacing) {
            const lineValue = Number(spacing.getAttribute('w:line')) || 0;
            const lineRule = spacing.getAttribute('w:lineRule');
            if (lineRule === 'auto' || !lineRule) {
                props.lineSpacing = lineValue / 240;
            } else {
                props.lineSpacing = lineValue * TWIP_TO_PX / 16;
            }

            const before = Number(spacing.getAttribute('w:before')) || 0;
            const after = Number(spacing.getAttribute('w:after')) || 0;
            if (before) props.spaceBefore = before * TWIP_TO_PX;
            if (after) props.spaceAfter = after * TWIP_TO_PX;
        }

        // Paragraph Borders
        const pBdr = byTag(pPr, 'w:pBdr')[0];
        if (pBdr) {
            const bottom = byTag(pBdr, 'w:bottom')[0];
            if (bottom) {
                const sz = Number(bottom.getAttribute('w:sz')) || 0;
                let color = bottom.getAttribute('w:color') || '000000';
                if (color === 'auto') color = '000000';
                props.borderBottom = {
                    style: bottom.getAttribute('w:val') || 'single',
                    size: (sz / 8) * (96 / 72),
                    color: color
                };
            }
        }

        // Indentation
        const ind = byTag(pPr, 'w:ind')[0];
        if (ind) {
            const left = Number(ind.getAttribute('w:left')) || 0;
            const firstLine = Number(ind.getAttribute('w:firstLine')) || 0;
            if (left) props.indentLeft = left * TWIP_TO_PX;
            if (firstLine) props.indentFirstLine = firstLine * TWIP_TO_PX;
        }

        // Tabs
        const tabs = byTag(pPr, 'w:tabs')[0];
        if (tabs) {
            const tabNodes = byTag(tabs, 'w:tab');
            props.tabs = tabNodes.map(t => ({
                position: (Number(t.getAttribute('w:pos')) || 0) * TWIP_TO_PX,
                type: (t.getAttribute('w:val') || 'left') as TabStop['type'],
                leader: (t.getAttribute('w:leader') || 'none') as TabStop['leader']
            }));
        }

        return props;
    };

    // Extract run properties from <w:rPr>
    const extractRunProps = (run: Element): Omit<TextRun, 'text'> => {
        const rPrList = byTag(run, 'w:rPr');
        if (rPrList.length === 0) return {};
        const rPr = rPrList[0];
        const props: Omit<TextRun, 'text'> = {};

        const bNodes = byTag(rPr, 'w:b');
        if (bNodes.length > 0) {
            const val = bNodes[0].getAttribute('w:val');
            props.bold = val !== 'false' && val !== '0';
        }
        const iNodes = byTag(rPr, 'w:i');
        if (iNodes.length > 0) {
            const val = iNodes[0].getAttribute('w:val');
            props.italic = val !== 'false' && val !== '0';
        }
        const uNodes = byTag(rPr, 'w:u');
        if (uNodes.length > 0) {
            const val = uNodes[0].getAttribute('w:val') || '';
            props.underline = val !== 'none' && val !== '';
        }
        const stNodes = byTag(rPr, 'w:strike');
        if (stNodes.length > 0) {
            const val = stNodes[0].getAttribute('w:val');
            props.strikethrough = val !== 'false' && val !== '0';
        }
        const colorNodes = byTag(rPr, 'w:color');
        if (colorNodes.length > 0) {
            const val = colorNodes[0].getAttribute('w:val') || '';
            if (val && val !== 'auto' && val.toUpperCase() !== '000000') props.color = val;
        }
        const szNodes = byTag(rPr, 'w:sz');
        if (szNodes.length > 0) {
            const val = Number(szNodes[0].getAttribute('w:val') || 0);
            if (val > 0) props.fontSize = val / 2;
        }
        const rFontsNodes = byTag(rPr, 'w:rFonts');
        if (rFontsNodes.length > 0) {
            const ascii = rFontsNodes[0].getAttribute('w:ascii') ||
                rFontsNodes[0].getAttribute('w:hAnsi') ||
                rFontsNodes[0].getAttribute('w:cs');
            if (ascii) props.fontFamily = ascii;
        }
        return props;
    };

    // Process image helper
    const processImageWrapper = async (wrapper: Element, rEmbed: string, baseAlign: Alignment, outNodes: DocumentNode[]) => {
        let width = 300, height = 300;
        const extents = byTag(wrapper, 'wp:extent');
        if (extents.length > 0) {
            const cx = Number(extents[0].getAttribute('cx')) || 0;
            const cy = Number(extents[0].getAttribute('cy')) || 0;
            if (cx > 0) width = cx / 9525;
            if (cy > 0) height = cy / 9525;
        }

        const absPos: any = {};
        let imageAlign: Alignment = baseAlign;

        // Extract Wrapping
        let wrapType: any = 'inline';
        if (byTag(wrapper, 'wp:wrapSquare').length > 0) wrapType = 'square';
        else if (byTag(wrapper, 'wp:wrapTopAndBottom').length > 0) wrapType = 'topAndBottom';
        else if (byTag(wrapper, 'wp:wrapTight').length > 0) wrapType = 'tight';
        else if (byTag(wrapper, 'wp:wrapThrough').length > 0) wrapType = 'through';
        else if (byTag(wrapper, 'wp:wrapNone').length > 0) wrapType = 'none';

        // Extract Rotation and Z-Index
        let rotation = 0;
        const xfrm = byTag(wrapper, 'a:xfrm')[0];
        if (xfrm) {
            const rot = Number(xfrm.getAttribute('rot')) || 0;
            // OOXML rotation is in 60,000ths of a degree, clockwise
            rotation = rot / 60000;
        }

        const zIndex = Number(wrapper.getAttribute('relativeHeight')) || 0;

        // Extract Position (Anchored)
        const posH = byTag(wrapper, 'wp:positionH')[0];
        if (posH) {
            absPos.relH = posH.getAttribute('relativeFrom');
            const align = byTag(posH, 'wp:align')[0]?.textContent;
            if (align) {
                absPos.alignH = align;
                if (align === 'center') imageAlign = 'center';
                else if (align === 'right') imageAlign = 'right';
                else if (align === 'left') imageAlign = 'left';
            }
            const offset = byTag(posH, 'wp:posOffset')[0]?.textContent;
            if (offset) absPos.x = Number(offset) / 9525;
        }

        const posV = byTag(wrapper, 'wp:positionV')[0];
        if (posV) {
            absPos.relV = posV.getAttribute('relativeFrom');
            const align = byTag(posV, 'wp:align')[0]?.textContent;
            if (align) absPos.alignV = align;
            const offset = byTag(posV, 'wp:posOffset')[0]?.textContent;
            if (offset) absPos.y = Number(offset) / 9525;
        }

        const targetPath = relationships[rEmbed];
        if (!targetPath) return;
        const base64Src = await getBase64Image(targetPath);
        if (base64Src) {
            outNodes.push({
                type: 'image',
                src: base64Src.src,
                width,
                height,
                nativeWidth: base64Src.natW,
                nativeHeight: base64Src.natH,
                align: imageAlign,
                absolutePos: Object.keys(absPos).length > 0 ? absPos : undefined,
                wrapType,
                rotation,
                zIndex
            });
        }
    };

    const processParagraphNode = async (p: Element, outNodes: DocumentNode[] = nodes) => {
        const pPr = extractParaProps(p);
        const align = pPr.align || 'left';

        const runs = byTag(p, 'w:r');
        const textRuns: TextRun[] = [];
        const pendingImages: DocumentNode[] = [];

        // Check if paragraph has its own default run properties
        const pPrNode = byTag(p, 'w:pPr')[0];
        const pRPr = pPrNode ? extractRunProps(pPrNode) : {};

        for (let rIdx = 0; rIdx < runs.length; rIdx++) {
            const run = runs[rIdx];
            const runProps = extractRunProps(run);
            // Merge paragraph run properties with specific run properties
            const props = { ...pRPr, ...runProps };
            const children = Array.from(run.children);

            for (const child of children) {
                const localName = child.localName || child.nodeName.split(':').pop();

                if (localName === 't') {
                    const text = child.textContent || '';
                    if (text !== '') textRuns.push({ text, ...props });
                } else if (localName === 'tab') {
                    textRuns.push({ text: '\t', isTab: true, ...props });
                } else if (localName === 'br') {
                    textRuns.push({ text: '\n', isLineBreak: true, ...props });
                } else if (localName === 'drawing') {
                    if (textRuns.length > 0) {
                        outNodes.push({ type: 'paragraph', runs: [...textRuns], text: textRuns.map(r => r.text).join(''), align, pPr });
                        textRuns.length = 0;
                    }
                    const wrapper = byTag(child, 'wp:inline')[0] || byTag(child, 'wp:anchor')[0];
                    if (wrapper) {
                        let rE: string | null = null;
                        const blips = byTag(wrapper, 'a:blip');
                        if (blips.length > 0) rE = blips[0].getAttribute('r:embed');
                        if (!rE) {
                            for (const el of byTag(wrapper, '*')) {
                                rE = el.getAttribute('r:embed');
                                if (rE) break;
                            }
                        }
                        if (rE && relationships[rE]) await processImageWrapper(wrapper, rE, align, pendingImages);
                    }
                } else if (localName === 'pict') {
                    const shapes = byTag(child, 'v:shape');
                    for (const shape of shapes) {
                        const iData = byTag(shape, 'v:imagedata')[0];
                        if (!iData) continue;
                        const rId = iData.getAttribute('r:id');
                        if (rId && relationships[rId]) {
                            if (textRuns.length > 0) {
                                outNodes.push({ type: 'paragraph', runs: [...textRuns], text: textRuns.map(r => r.text).join(''), align, pPr });
                                textRuns.length = 0;
                            }
                            let w = 300, h = 300;
                            const styleStr = shape.getAttribute('style') || '';
                            const wm = styleStr.match(/width:([0-9.]+)(pt|px)/);
                            const hm = styleStr.match(/height:([0-9.]+)(pt|px)/);
                            if (wm) { w = parseFloat(wm[1]); if (wm[2] === 'pt') w *= 1.333; }
                            if (hm) { h = parseFloat(hm[1]); if (hm[2] === 'pt') h *= 1.333; }
                            const base64Src = await getBase64Image(relationships[rId]);
                            if (base64Src) {
                                pendingImages.push({ type: 'image', src: base64Src.src, width: w, height: h, nativeWidth: base64Src.natW, nativeHeight: base64Src.natH, align });
                            }
                        }
                    }
                }
            }
        }

        outNodes.push({ type: 'paragraph', runs: [...textRuns], text: textRuns.map(r => r.text).join(''), align, pPr });
        for (const img of pendingImages) outNodes.push(img);
    };

    const processTableNode = async (tbl: Element, outNodes: DocumentNode[] = nodes) => {
        const rows: any[] = [];
        const grid: number[] = [];

        // Grid (Column widths)
        const tblGrid = directByTag(tbl, 'w:tblGrid')[0];
        if (tblGrid) {
            const cols = directByTag(tblGrid, 'w:gridCol');
            for (const col of cols) {
                const w = Number(col.getAttribute('w:w')) || 0;
                grid.push(w * TWIP_TO_PX);
            }
        }

        // Table Properties (Width and Borders)
        const tblPr = directByTag(tbl, 'w:tblPr')[0];
        let tableWidthVal: any = { type: 'auto', value: 0 };
        const tableBorders: any = {};

        if (tblPr) {
            // Table Width
            const tblW = directByTag(tblPr, 'w:tblW')[0];
            if (tblW) {
                const type = tblW.getAttribute('w:type') || 'auto';
                const val = Number(tblW.getAttribute('w:w')) || 0;
                tableWidthVal = { type, value: (type === 'dxa') ? val * TWIP_TO_PX : val };
            }

            // Table Borders
            const bdrNode = directByTag(tblPr, 'w:tblBorders')[0];
            if (bdrNode) {
                ['top', 'bottom', 'left', 'right', 'insideH', 'insideV'].forEach(side => {
                    const b = directByTag(bdrNode, `w:${side}`)[0];
                    if (b) {
                        const style = b.getAttribute('w:val') || 'single';
                        if (style === 'none' || style === 'nil') return;

                        const sz = Number(b.getAttribute('w:sz')) || 0;
                        let color = b.getAttribute('w:color') || '000000';
                        if (color === 'auto') color = '000000';
                        tableBorders[side] = {
                            style: style,
                            size: (sz / 8) * (96 / 72),
                            color: color
                        };
                    }
                });
            }

            // Table Alignment
            const jcNode = directByTag(tblPr, 'w:jc')[0];
            if (jcNode) {
                const val = jcNode.getAttribute('w:val');
                if (val === 'center') (tableWidthVal as any).align = 'center';
                else if (val === 'right') (tableWidthVal as any).align = 'right';
            }
        }

        const trNodes = directByTag(tbl, 'w:tr');
        for (const tr of trNodes) {
            const cells: any[] = [];
            const tcNodes = directByTag(tr, 'w:tc');
            for (const tc of tcNodes) {
                const cellNodes: DocumentNode[] = [];
                // Cells can contain paragraphs or even other tables (rare but possible)
                for (const tcChild of Array.from(tc.children)) {
                    const tcChildName = tcChild.localName || tcChild.nodeName.split(':').pop();
                    if (tcChildName === 'p') {
                        await processParagraphNode(tcChild, cellNodes);
                    } else if (tcChildName === 'tbl') {
                        await processTableNode(tcChild, cellNodes);
                    } else if (tcChildName === 'sdt' || tcChildName === 'sdtContent' || tcChildName === 'ins' || tcChildName === 'smartTag') {
                        // Containers inside cells
                        await walkBody(tcChild, cellNodes);
                    }
                }

                const tcPr = directByTag(tc, 'w:tcPr')[0];
                const cellBorders: any = {};
                let gridSpan = 1;
                let vAlign: 'top' | 'center' | 'bottom' = 'top';

                if (tcPr) {
                    const bdrNode = directByTag(tcPr, 'w:tcBorders')[0];
                    if (bdrNode) {
                        ['top', 'bottom', 'left', 'right'].forEach(side => {
                            const b = directByTag(bdrNode, `w:${side}`)[0];
                            if (b) {
                                const style = b.getAttribute('w:val') || 'single';
                                if (style === 'none' || style === 'nil') return;

                                const sz = Number(b.getAttribute('w:sz')) || 0;
                                let color = b.getAttribute('w:color') || '000000';
                                if (color === 'auto') color = '000000';
                                cellBorders[side] = {
                                    style: style,
                                    size: (sz / 8) * (96 / 72),
                                    color: color
                                };
                            }
                        });
                    }
                    const gs = directByTag(tcPr, 'w:gridSpan')[0];
                    if (gs) gridSpan = Number(gs.getAttribute('w:val')) || 1;

                    const va = directByTag(tcPr, 'w:vAlign')[0];
                    if (va) {
                        const val = va.getAttribute('w:val');
                        if (val === 'center') vAlign = 'center';
                        else if (val === 'bottom') vAlign = 'bottom';
                    }
                }

                cells.push({
                    nodes: cellNodes,
                    gridSpan,
                    vAlign,
                    borders: Object.keys(cellBorders).length > 0 ? cellBorders : undefined
                });
            }
            rows.push({ cells });
        }

        outNodes.push({
            type: 'table',
            rows,
            grid: grid.length > 0 ? grid : undefined,
            borders: Object.keys(tableBorders).length > 0 ? tableBorders : undefined,
            widthValue: tableWidthVal
        });
    };

    // Main parsing: Recursively walk the body to find paragraphs and tables
    const body = byTag(xmlDoc, 'w:body')[0];
    if (body) {
        await walkBody(body, nodes);
    }

    async function walkBody(container: Element, outNodes: DocumentNode[]) {
        const children = Array.from(container.children);
        for (const child of children) {
            const nodeName = child.localName || child.nodeName.split(':').pop();

            if (nodeName === 'p') {
                await processParagraphNode(child, outNodes);
            } else if (nodeName === 'tbl') {
                await processTableNode(child, outNodes);
            } else if (nodeName === 'sdt' || nodeName === 'sdtContent' || nodeName === 'ins' || nodeName === 'smartTag') {
                // Containers that might wrap paragraphs or tables
                await walkBody(child, outNodes);
            }
        }
    }

    return { nodes, pageSettings, defaults };
}
