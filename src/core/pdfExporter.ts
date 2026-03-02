import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { LayoutModel } from './types';

/**
 * Barcha canvas sahifalarini to'plab jsPDF orqali PDF fayl sifatida yuklab beradi.
 * Har bir canvas sahifasi alohida PDF sahifasiga aylanadi.
 */
export async function exportToPdf(
    layoutModel: LayoutModel,
    pageContainerIds: string[]
): Promise<void> {
    const A4_WIDTH_MM = 210;

    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
    });

    for (let i = 0; i < pageContainerIds.length; i++) {
        const containerId = pageContainerIds[i];
        const element = document.getElementById(containerId);
        if (!element) continue;

        const canvas = await html2canvas(element, {
            scale: 2, // HiDPI uchun
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const imgWidth = A4_WIDTH_MM;
        const imgHeight = (canvas.height * A4_WIDTH_MM) / canvas.width;

        if (i > 0) {
            pdf.addPage();
        }

        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    }

    const filename = `document-${layoutModel.documentId}.pdf`;
    pdf.save(filename);
}
