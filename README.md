# v3-word

A high-performance, high-fidelity DOCX viewer built with React and HTML5 Canvas. This project is specifically designed to render complex Word documents, including advanced tables, images, and nested structures, with pixel-perfect accuracy.

## 🚀 Key Features

- **High-Fidelity Table Rendering**: Supports complex table grids, nested tables, vertical alignment, and custom borders.
- **Pixel-Perfect Accuracy**: Matches Microsoft Word's layout physics, including proportional column scaling and specific cell padding.
- **Recursive Parsing**: A robust `DocxParser` that handles nested content controls (SDT), smart tags, and insertions.
- **Advanced Layout Engine**:
  - Automatic pagination and page breaks.
  - Support for images with proper aspect ratio and scaling.
  - Text wrapping and alignment (left, center, right, justified).
  - Indentations and tab-stop supporting.
- **Iframe Integration**: Ready to be embedded in other platforms via `postMessage` API.
- **PDF Export**: Built-in support for exporting the rendered document to PDF.

## 🛠️ Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/bekmuxtorov/v3-word.git
   cd v3-word
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

## 📖 Usage Guide

### Embedding via Iframe
You can embed the viewer in your web application using an iframe. The viewer listens for an `input_url` through the `postMessage` API.

```html
<iframe src="https://your-deployment-url.uz/use.html" id="docx-viewer"></iframe>

<script>
  const viewer = document.getElementById('docx-viewer');
  
  // Send the document URL to the viewer
  viewer.contentWindow.postMessage({
    type: 'INIT_DOCX',
    config: {
      input_url: 'https://storage.example.com/document.docx',
      token: 'your-auth-token'
    }
  }, '*');
</script>
```

### Core Architecture

- **`DocxParser.ts`**: Converts raw OpenXML (DOCX) into a clean JSON `DocumentNode` tree. Handles relationships, images, and styles.
- **`LayoutEngine.ts`**: The "brain" of the viewer. It performs two passes:
  1. **Measurement Pass**: Calculates the height of text, tables, and rows.
  2. **Render Pass**: Positions items on specific pages, handles pagination, and vertical alignment offset.
- **`Renderer.ts`**: Draws the `LayoutModel` onto an HTML5 Canvas for crystal-clear text rendering.

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License
This project is licensed under the MIT License.
