const fs = require('fs');
const appPath = 'd:\\1CForNigox\\v3-word\\src\\App.tsx';
const imgPath = 'C:\\Users\\Администратор\\.gemini\\antigravity\\brain\\4558febe-69cc-4b47-a6cd-de0ec81c3608\\qr_template_placeholder_1772366694909.png';

let appContent = fs.readFileSync(appPath, 'utf8');
const imgData = fs.readFileSync(imgPath);
const base64Template = 'data:image/png;base64,' + imgData.toString('base64');

// Regex to find handleInjectQR content and replace it
const regex = /const handleInjectQR = useCallback\(\(\) => \{[\s\S]*?\}, \[layoutModel\]\);/;
const replacement = `const handleInjectQR = useCallback(() => {
    if (!layoutModel) return;

    // Professional QR Template Placeholder (Base64)
    const qrSrc = '${base64Template}';
    
    const newLayout = { ...layoutModel };
    const lastPageIndex = newLayout.pages.length - 1;
    const lastPage = { ...newLayout.pages[lastPageIndex] };
    const { x, y } = newLayout.eofMarker!;

    lastPage.items = [
      ...lastPage.items,
      {
        type: 'image' as const,
        src: qrSrc,
        x: Math.round(x),
        y: Math.round(y),
        width: 120,
        height: 120,
        align: 'left' as const,
        zIndex: 100
      }
    ];

    newLayout.pages[lastPageIndex] = lastPage;
    newLayout.eofMarker = { ...newLayout.eofMarker!, y: y + 130 };
    setLayoutModel({ ...newLayout });
  }, [layoutModel]);`;

const newAppContent = appContent.replace(regex, replacement);
fs.writeFileSync(appPath, newAppContent);
console.log('Successfully updated App.tsx with full QR template template');
