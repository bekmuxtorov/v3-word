import type { DocumentNode, TextRun, LayoutModel, PageLayout, PageSettings, TabStop, DocumentDefaults } from './types';

const PT_TO_PX = 96 / 72;
const DEFAULT_FONT_SIZE_PT = 11;
const DEFAULT_FONT_FAMILY = 'Times New Roman';
const DEFAULT_TAB_STOP_PX = 36;

export function buildLayoutTree(
    documentId: string,
    nodes: DocumentNode[],
    pageSettings: PageSettings,
    defaults: DocumentDefaults
): LayoutModel {
    const pages: PageLayout[] = [];
    let currentPage: PageLayout = { width: pageSettings.width, height: pageSettings.height, items: [] };
    pages.push(currentPage);

    let currentX = pageSettings.margins.left;
    let currentY = pageSettings.margins.top;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    const calcLineHeight = (sizePt: number, multiplier: number) => {
        return (sizePt * PT_TO_PX) * multiplier;
    };

    const measureText = (text: string, fontCss: string): number => {
        if (!ctx) return text.length * 8;
        ctx.font = fontCss;
        return ctx.measureText(text).width;
    };

    const buildFontCss = (run: TextRun): string => {
        const sizePt = run.fontSize ?? defaults.fontSize ?? DEFAULT_FONT_SIZE_PT;
        const sizePx = sizePt * PT_TO_PX;
        const family = run.fontFamily ?? defaults.fontFamily ?? DEFAULT_FONT_FAMILY;
        const weight = run.bold ? 'bold' : 'normal';
        const style = run.italic ? 'italic' : 'normal';
        return `${style} ${weight} ${sizePx}px "${family}"`;
    };

    const newPage = () => {
        currentPage = { width: pageSettings.width, height: pageSettings.height, items: [] };
        pages.push(currentPage);
        currentY = pageSettings.margins.top;
        currentX = pageSettings.margins.left;
    };

    const checkPagination = (neededHeight: number) => {
        if (currentY + neededHeight > pageSettings.height - pageSettings.margins.bottom) {
            newPage();
        }
    };

    const getNextTabStopObj = (penX: number, customTabs?: TabStop[]): TabStop => {
        if (customTabs && customTabs.length > 0) {
            const nextCustom = customTabs.find(t => t.position > penX + 2);
            if (nextCustom) return nextCustom;
        }
        const relXFromMargin = penX - pageSettings.margins.left;
        const next = Math.floor(relXFromMargin / DEFAULT_TAB_STOP_PX + 1) * DEFAULT_TAB_STOP_PX;
        return { position: pageSettings.margins.left + next, type: 'left' };
    };

    const processParagraph = (node: DocumentNode, isMeasuring: boolean = false, outItems?: any[]) => {
        const currentContentWidth = pageSettings.width - pageSettings.margins.left - pageSettings.margins.right;
        const pPr = node.pPr || {};
        const align = pPr.align || 'left';
        const isInsideTable = outItems !== undefined;
        const lineSpacingMult = pPr.lineSpacing || (isInsideTable ? 1.05 : 1.15);
        const indentLeft = pPr.indentLeft || 0;
        const indentFirstLine = pPr.indentFirstLine || 0;
        const customTabs = pPr.tabs || [];
        const spaceBefore = pPr.spaceBefore || 0;
        const spaceAfter = pPr.spaceAfter || 0;

        currentY += spaceBefore;

        const runs: TextRun[] = (node.runs && node.runs.length > 0)
            ? node.runs
            : node.text ? [{ text: node.text }] : [];

        const hasContent = runs.some(r => !r.isTab && !r.isLineBreak && r.text.trim() !== '');

        if (!hasContent) {
            const emptyLinePx = calcLineHeight(defaults.fontSize || DEFAULT_FONT_SIZE_PT, lineSpacingMult);
            if (!isMeasuring) checkPagination(emptyLinePx);
            if (pPr.borderBottom) {
                const item = { type: 'line', x: Math.round(pageSettings.margins.left), y: Math.round(currentY + emptyLinePx), width: currentContentWidth, lineWidth: pPr.borderBottom.size, color: pPr.borderBottom.color, lineStyle: pPr.borderBottom.style } as const;
                if (outItems) outItems.push(item);
                else currentPage.items.push(item);
            }
            currentY += emptyLinePx + spaceAfter;
            return;
        }

        interface LineChunk {
            text: string;
            run: TextRun;
            fontCss: string;
            sizePx: number;
            width: number;
            x: number;
        }

        let lineChunks: LineChunk[] = [];
        let lineMaxH = (defaults.fontSize || DEFAULT_FONT_SIZE_PT) * PT_TO_PX;
        let isFirstLineOfPara = true;
        let penX = pageSettings.margins.left + indentLeft + indentFirstLine;
        let hasTabInLine = false;

        const flushLine = (isLastLine: boolean = false) => {
            if (lineChunks.length === 0) return;
            const effectiveLineH = (lineMaxH / PT_TO_PX) * PT_TO_PX * lineSpacingMult;
            if (!isMeasuring) checkPagination(effectiveLineH);

            const availableW = currentContentWidth - indentLeft - (isFirstLineOfPara ? indentFirstLine : 0);
            const lineWidth = lineChunks.reduce((s, c) => s + c.width, 0);

            if (!hasTabInLine) {
                if (align === 'center') {
                    const offsetX = Math.max(0, (availableW - lineWidth) / 2);
                    for (const chunk of lineChunks) chunk.x += offsetX;
                } else if (align === 'right') {
                    const offsetX = Math.max(0, availableW - lineWidth);
                    for (const chunk of lineChunks) chunk.x += offsetX;
                } else if (align === 'both' && !isLastLine) {
                    const spaceChunks = lineChunks.filter(c => c.text.trim() === '');
                    if (spaceChunks.length > 0) {
                        const extraTotal = availableW - lineWidth;
                        if (extraTotal > 0 && extraTotal < availableW * 0.4) {
                            const extraPerSpace = extraTotal / spaceChunks.length;
                            let currentOffset = 0;
                            for (const chunk of lineChunks) {
                                chunk.x += currentOffset;
                                if (chunk.text.trim() === '') currentOffset += extraPerSpace;
                            }
                        }
                    }
                }
            }

            for (const chunk of lineChunks) {
                const item = {
                    type: 'text',
                    text: chunk.text,
                    x: Math.round(chunk.x),
                    y: Math.round(currentY),
                    fontSize: chunk.sizePx,
                    fontFamily: chunk.run.fontFamily ?? defaults.fontFamily ?? DEFAULT_FONT_FAMILY,
                    width: chunk.width,
                    height: chunk.sizePx,
                    align: hasTabInLine ? 'left' : align,
                    bold: chunk.run.bold,
                    italic: chunk.run.italic,
                    underline: chunk.run.underline,
                    strikethrough: chunk.run.strikethrough,
                    color: chunk.run.color,
                } as const;
                if (outItems) outItems.push(item);
                else currentPage.items.push(item);
            }

            currentY += effectiveLineH;
            if (isLastLine && pPr.borderBottom) {
                const item = { type: 'line', x: Math.round(pageSettings.margins.left), y: Math.round(currentY), width: currentContentWidth, lineWidth: pPr.borderBottom.size, color: pPr.borderBottom.color, lineStyle: pPr.borderBottom.style } as const;
                if (outItems) outItems.push(item);
                else currentPage.items.push(item);
                currentY += pPr.borderBottom.size + 1;
            }

            lineChunks = [];
            lineMaxH = (defaults.fontSize || DEFAULT_FONT_SIZE_PT) * PT_TO_PX;
            isFirstLineOfPara = false;
            penX = pageSettings.margins.left + indentLeft;
            hasTabInLine = false;
        };

        for (let i = 0; i < runs.length; i++) {
            const run = runs[i];
            if (run.isLineBreak) {
                flushLine();
                continue;
            }

            if (run.isTab) {
                hasTabInLine = true;
                const tabStop = getNextTabStopObj(penX, customTabs);
                if (tabStop.type === 'right') {
                    let nextBlockWidth = 0;
                    for (let j = i + 1; j < runs.length; j++) {
                        if (runs[j].isTab || runs[j].isLineBreak) break;
                        nextBlockWidth += measureText(runs[j].text, buildFontCss(runs[j]));
                    }
                    penX = Math.max(penX, tabStop.position - nextBlockWidth);
                } else {
                    penX = tabStop.position;
                }
                if (penX >= pageSettings.width - pageSettings.margins.right) flushLine();
                continue;
            }

            const fontCss = buildFontCss(run);
            const sizePx = (run.fontSize ?? defaults.fontSize ?? DEFAULT_FONT_SIZE_PT) * PT_TO_PX;

            // Smarter split: keep whitespace separate to allow justification on them
            const tokens = run.text.match(/(\s+|\S+)/g) || [];

            for (const token of tokens) {
                if (token === '') continue;
                const w = measureText(token, fontCss);
                // Wrap on non-whitespace tokens
                if (penX + w > pageSettings.width - pageSettings.margins.right && lineChunks.length > 0 && token.trim() !== '') {
                    flushLine();
                }
                // Skip leading spaces on wrapped lines
                if (penX === pageSettings.margins.left + indentLeft && token.trim() === '' && !hasTabInLine) continue;

                lineChunks.push({ text: token, run, fontCss, sizePx, width: w, x: penX });
                penX += w;
                if (sizePx > lineMaxH) lineMaxH = sizePx;
            }
        }

        flushLine(true);
        currentY += spaceAfter;
    };

    const processImage = (node: DocumentNode, isMeasuring: boolean = false, outItems?: any[]) => {
        if (!node.src) return;
        const currentContentWidth = pageSettings.width - pageSettings.margins.left - pageSettings.margins.right;
        let w = node.width || node.nativeWidth || 300;
        let h = node.height || node.nativeHeight || 300;
        const align = node.align ?? 'left';

        if (node.nativeWidth && node.nativeHeight) {
            const aspect = node.nativeWidth / node.nativeHeight;
            if (Math.abs(aspect - (w / h)) > 0.05) h = w / aspect;
        }

        if (node.absolutePos) {
            const { x: absX, y: absY, relH, relV, alignH, alignV } = node.absolutePos;
            let finalX = pageSettings.margins.left;
            let finalY = currentY;

            if (alignH === 'center') {
                const baseW = (relH === 'page') ? pageSettings.width : currentContentWidth;
                const startX = (relH === 'page') ? 0 : pageSettings.margins.left;
                finalX = startX + (baseW - w) / 2;
            } else if (alignH === 'right') {
                const startX = (relH === 'page') ? pageSettings.width : (pageSettings.margins.left + currentContentWidth);
                finalX = startX - w;
            } else if (absX !== undefined) {
                const startX = (relH === 'page') ? 0 : pageSettings.margins.left;
                finalX = startX + absX;
            }

            if (alignV === 'bottom') {
                finalY = pageSettings.height - pageSettings.margins.bottom - h;
            } else if (alignV === 'center') {
                finalY = (pageSettings.height - h) / 2;
            } else if (absY !== undefined) {
                const startY = (relV === 'page') ? 0 : (relV === 'paragraph' ? currentY : pageSettings.margins.top);
                finalY = startY + absY;
            }

            const item = {
                type: 'image',
                src: node.src,
                x: Math.round(finalX),
                y: Math.round(finalY),
                width: w,
                height: h,
                align,
                rotation: node.rotation,
                zIndex: node.zIndex
            } as const;
            if (outItems) outItems.push(item);
            else currentPage.items.push(item);

            if (node.wrapType !== 'none' && alignV !== 'bottom') {
                if (finalY + h > currentY) {
                    currentY = finalY + h + 1;
                }
            }
            return;
        }

        if (!isMeasuring) checkPagination(h + 20);
        let x = pageSettings.margins.left;
        if (w > currentContentWidth) {
            const ratio = currentContentWidth / w;
            w = currentContentWidth;
            h = h * ratio;
        }
        if (align === 'center') x = pageSettings.margins.left + (currentContentWidth - w) / 2;
        if (align === 'right') x = pageSettings.margins.left + currentContentWidth - w;

        const item = {
            type: 'image',
            src: node.src,
            x: Math.round(x),
            y: Math.round(currentY),
            width: w,
            height: h,
            align,
            rotation: node.rotation,
            zIndex: node.zIndex
        } as const;
        if (outItems) outItems.push(item);
        else currentPage.items.push(item);
        currentY += h + 2;
    };

    const processTable = (node: DocumentNode, isMeasuring: boolean = false, outItems?: any[]) => {
        if (!node.rows || node.rows.length === 0) return;

        const currentContentWidth = pageSettings.width - pageSettings.margins.left - pageSettings.margins.right;
        let tableWidth = currentContentWidth;
        if (node.widthValue) {
            if (node.widthValue.type === 'dxa' || node.widthValue.type === 'auto') {
                if (node.widthValue.value > 0) tableWidth = node.widthValue.value;
            } else if (node.widthValue.type === 'pct') {
                tableWidth = (currentContentWidth * node.widthValue.value) / 5000;
            }
        }
        if (tableWidth > currentContentWidth) tableWidth = currentContentWidth;

        const colCount = node.grid ? node.grid.length : (node.rows[0]?.cells?.length || 1);
        const colWidths: number[] = [];

        if (node.grid && node.grid.length > 0) {
            let totalGridW = node.grid.reduce((s, w) => s + w, 0);
            const scale = (tableWidth > 0 && totalGridW > 0) ? (tableWidth / totalGridW) : 1;
            for (const gw of node.grid) colWidths.push(gw * scale);
        } else {
            const w = tableWidth / colCount;
            for (let i = 0; i < colCount; i++) colWidths.push(w);
        }

        // Table horizontal alignment offset
        let tableXOffset = 0;
        const tableAlign = (node.widthValue as any)?.align;
        if (tableAlign === 'center') {
            tableXOffset = (currentContentWidth - tableWidth) / 2;
        } else if (tableAlign === 'right') {
            tableXOffset = currentContentWidth - tableWidth;
        }
        if (tableXOffset < 0) tableXOffset = 0;

        for (const row of node.rows) {
            let maxRowH = 0;
            let currentCellX = pageSettings.margins.left + tableXOffset;
            const startOfRowY = currentY;

            // First pass: measurement
            const rowCellLayouts: { cell: any, items: any[], height: number, x: number, width: number }[] = [];
            let colIdx = 0;
            for (const cell of row.cells) {
                const span = cell.gridSpan || 1;
                let cellW = 0;
                for (let i = 0; i < span; i++) {
                    cellW += colWidths[colIdx + i] || (tableWidth / colCount);
                }

                const savedY = currentY;
                const savedMargins = {
                    left: pageSettings.margins.left,
                    right: pageSettings.margins.right,
                    top: pageSettings.margins.top,
                    bottom: pageSettings.margins.bottom
                };

                pageSettings.margins.left = currentCellX + 8;
                pageSettings.margins.right = pageSettings.width - (currentCellX + cellW - 8);
                currentY = startOfRowY + 2;

                const cellItems: any[] = [];
                for (const cellNode of cell.nodes) {
                    if (cellNode.type === 'paragraph') processParagraph(cellNode, true, cellItems);
                    else if (cellNode.type === 'image') processImage(cellNode, true, cellItems);
                    else if (cellNode.type === 'table') processTable(cellNode, true, cellItems);
                }

                const cellH = currentY - startOfRowY;
                if (cellH > maxRowH) maxRowH = cellH;

                rowCellLayouts.push({ cell, items: cellItems, height: cellH, x: currentCellX, width: cellW });

                currentY = savedY;
                pageSettings.margins.left = savedMargins.left;
                pageSettings.margins.right = savedMargins.right;

                currentCellX += cellW;
                colIdx += span;
            }

            maxRowH += 2;

            if (!isMeasuring) {
                checkPagination(maxRowH);
            }
            const renderRowY = currentY;

            // Second pass: render
            for (const layout of rowCellLayouts) {
                const { cell, items, height, x, width } = layout;
                let vOffset = 0;
                if (cell.vAlign === 'center') vOffset = (maxRowH - height) / 2;
                else if (cell.vAlign === 'bottom') vOffset = maxRowH - height;

                const measurementBaselineY = startOfRowY + 2;
                const renderBaselineY = renderRowY + 2;

                for (const item of items) {
                    const itemOffsetWithinCell = item.y - measurementBaselineY;
                    const finalY = renderBaselineY + itemOffsetWithinCell + vOffset;

                    const newItem = { ...item, y: Math.round(finalY) };
                    if (outItems) outItems.push(newItem);
                    else currentPage.items.push(newItem);
                }

                const borders = cell.borders || {
                    top: node.borders?.top || node.borders?.insideH,
                    bottom: node.borders?.bottom || node.borders?.insideH,
                    left: node.borders?.left || node.borders?.insideV,
                    right: node.borders?.right || node.borders?.insideV
                };
                if (borders && (borders.top || borders.bottom || borders.left || borders.right)) {
                    const bItems: any[] = [];
                    if (borders.top) bItems.push({ type: 'line', x, y: renderRowY, width, lineWidth: borders.top.size, color: borders.top.color } as const);
                    if (borders.bottom) bItems.push({ type: 'line', x, y: renderRowY + maxRowH, width, lineWidth: borders.bottom.size, color: borders.bottom.color } as const);
                    if (borders.left) bItems.push({ type: 'line', x, y: renderRowY, height: maxRowH, lineWidth: borders.left.size, color: borders.left.color } as const);
                    if (borders.right) bItems.push({ type: 'line', x: x + width, y: renderRowY, height: maxRowH, lineWidth: borders.right.size, color: borders.right.color } as const);
                    for (const b of bItems) {
                        if (outItems) outItems.push(b);
                        else currentPage.items.push(b);
                    }
                }
            }

            currentY += maxRowH;
        }

        currentY += 10; // Space after table
    };

    for (const node of nodes) {
        if (node.type === 'paragraph') processParagraph(node);
        else if (node.type === 'image') processImage(node);
        else if (node.type === 'table') processTable(node);
    }

    // Sort items by zIndex to ensure correct layering
    for (const page of pages) {
        page.items.sort((a, b) => {
            const zA = (a.type === 'image' ? a.zIndex : 0) || 0;
            const zB = (b.type === 'image' ? b.zIndex : 0) || 0;
            return zA - zB;
        });
    }

    return {
        documentId,
        pageSettings,
        defaults,
        pages,
        eofMarker: { x: currentX, y: currentY, pageIndex: pages.length - 1 }
    };
}
