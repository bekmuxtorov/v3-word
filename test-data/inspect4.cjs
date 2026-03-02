const fs = require('fs');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');

async function testDocx() {
    const buffer = fs.readFileSync(process.argv[2]);
    const zip = await JSZip.loadAsync(buffer);

    const relsXmlFile = zip.file('word/_rels/document.xml.rels');
    const relationships = {};
    if (relsXmlFile) {
        const relsContent = await relsXmlFile.async('text');
        const parser = new DOMParser();
        const relsDoc = parser.parseFromString(relsContent, "text/xml");
        const relNodes = relsDoc.getElementsByTagName('Relationship');
        for (let i = 0; i < relNodes.length; i++) {
            const rel = relNodes[i];
            const id = rel.getAttribute('Id');
            const target = rel.getAttribute('Target');
            if (id && target) relationships[id] = target;
        }
    }

    const documentXmlFile = zip.file('word/document.xml');
    const xmlContent = await documentXmlFile.async('text');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
    const paragraphs = xmlDoc.getElementsByTagName('w:p');

    let imagesFound = 0;

    for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        const runs = p.getElementsByTagName('w:r');

        for (let rIdx = 0; rIdx < runs.length; rIdx++) {
            const run = runs[rIdx];
            const drawings = run.getElementsByTagName('w:drawing');
            for (let d = 0; d < drawings.length; d++) {
                const drawing = drawings[d];

                let wrapper = drawing.getElementsByTagName('wp:inline')[0] || drawing.getElementsByTagName('wp:anchor')[0];

                if (wrapper) {
                    let rEmbed = null;
                    const blips = wrapper.getElementsByTagName('a:blip');
                    if (blips.length > 0) rEmbed = blips[0].getAttribute('r:embed');

                    if (!rEmbed) {
                        const allElems = wrapper.getElementsByTagName('*');
                        for (let k = 0; k < allElems.length; k++) {
                            rEmbed = allElems[k].getAttribute('r:embed');
                            if (rEmbed) break;
                        }
                    }

                    console.log("Found Drawing:", {
                        rEmbed,
                        relationshipTarget: rEmbed ? relationships[rEmbed] : null
                    });
                    if (rEmbed) imagesFound++;
                } else {
                    console.log("Drawing without wrapper:", drawing.textContent?.substring(0, 50));
                }
            }
        }
    }
    console.log("Total Raster Images Extracted:", imagesFound);
}

testDocx();
