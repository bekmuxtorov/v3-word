import JSZip from 'jszip';
import fs from 'fs';

async function testDocxParsing(filePath: string) {
    const buffer = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(buffer);

    // Print all files in zip
    console.log("--- Files in docx ---");
    Object.keys(zip.files).forEach(name => console.log(name));

    const relsXmlFile = zip.file('word/_rels/document.xml.rels');
    if (relsXmlFile) {
        console.log("\n--- Relations ---");
        const content = await relsXmlFile.async('text');
        console.log(content.substring(0, 500) + '...');
    }

    const documentXmlFile = zip.file('word/document.xml');
    if (documentXmlFile) {
        let content = await documentXmlFile.async('text');

        // Find drawing tags
        const drawingStart = content.indexOf('<w:drawing>');
        if (drawingStart > -1) {
            console.log("\n--- FIRST DRAWING TAG ---");
            console.log(content.substring(drawingStart, drawingStart + 1500));
        }

        // Find second drawing tag
        const secondStart = content.indexOf('<w:drawing>', drawingStart + 10);
        if (secondStart > -1) {
            console.log("\n--- SECOND DRAWING TAG ---");
            console.log(content.substring(secondStart, secondStart + 1500));
        }
    }
}

testDocxParsing(process.argv[2]);
