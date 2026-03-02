# v3-word (O'zbek tili)

React va HTML5 Canvas yordamida yaratilgan, yuqori tezlik va aniqlikka ega DOCX ko'ruvchi (viewer). Ushbu loyiha murakkab Word hujjatlarini, jumladan jadvallarni, rasmlarni va ichma-ich joylashgan elementlarni piksel darajasidagi aniqlik bilan render qilish uchun mo'ljallangan.

## 🚀 Asosiy Imkoniyatlar

- **Yuqori Aniqlikdagi Jadvallar**: Murakkab jadval panjaralari (grid), ichma-ich jadvallar, vertikal tekislash va maxsus chegaralarni (borders) qo'llab-quvvatlaydi.
- **Piksel darajasidagi Aniqlik**: Microsoft Word layout fizikasini, jumladan ustunlarni proporsional kengaytirish va hujayralardagi maxsus paddinglarni aniq takrorlaydi.
- **Rekursiv Tahlil (Parsing)**: Ichma-ich joylashgan kontent-kontrollar (SDT), smart-teglar va qo'shimchalarni qayta ishlovchi mustahkam `DocxParser`.
- **Murakkab Layout Engine**:
  - Sahifalarga ajratish va avtomatik page-break.
  - Rasmlarni to'g'ri aspect ratio va o'lcham bilan joylashtirish.
  - Matnlarni o'rash va tekislash (chap, markaz, o'ng, justified).
  - Indentatsiya va tab-stoplarni qo'llab-quvvatlash.
- **Iframe Integratsiyasi**: `postMessage` API orqali boshqa platformalarga integratsiya qilishga tayyor.
- **PDF Eksport**: Render qilingan hujjatni PDF formatiga eksport qilish imkoniyati.

## 🛠️ O'rnatish

### Talablar
- Node.js (v18 yoki undan yuqori)
- npm yoki yarn

### Sozlash
1. Repository-ni klon qiling:
   ```bash
   git clone https://github.com/bekmuxtorov/v3-word.git
   cd v3-word
   ```

2. Kutubxonalarni o'rnating:
   ```bash
   npm install
   ```

3. Lokal serverni ishga tushiring:
   ```bash
   npm run dev
   ```

## 📖 Foydalanish Qo'llanmasi

### Iframe orqali integratsiya qilish
Hujjat ko'ruvchini iframe yordamida o'z saytingizga joylashingiz mumkin. Viewer `postMessage` API orqali `input_url` ni qabul qiladi.

```html
<iframe src="https://sizning-domen.uz/use.html" id="docx-viewer"></iframe>

<script>
  const viewer = document.getElementById('docx-viewer');
  
  // Hujjat URL-ini viewer-ga yuborish
  viewer.contentWindow.postMessage({
    type: 'INIT_DOCX',
    config: {
      input_url: 'https://storage.example.com/document.docx',
      token: 'your-auth-token'
    }
  }, '*');
</script>
```

---

# v3-word (English)

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
