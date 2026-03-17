import type { PageLayout, RenderItem } from './types';

export class CanvasRenderer {
    private ctx: CanvasRenderingContext2D;

    constructor(canvas: HTMLCanvasElement) {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not get 2D context');
        this.ctx = context;
    }

    public renderPage(page: PageLayout) {
        // White background
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, page.width, page.height);

        // Page border (subtle)
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(0, 0, page.width, page.height);

        for (const item of page.items) {
            if (item.type === 'text') {
                this.drawText(item);
            } else if (item.type === 'image') {
                this.drawImage(item);
            } else if (item.type === 'line') {
                this.drawLine(item);
            }
        }
    }

    private drawLine(item: Extract<RenderItem, { type: 'line' }>) {
        const { x, y, width, height, lineWidth, color, lineStyle } = item;
        const strokeColor = color ? `#${color}` : '#000000';
        this.ctx.strokeStyle = strokeColor;

        // Use precise integer coordinates to avoid blur
        const rx = Math.round(x);
        const ry = Math.round(y);

        if (lineStyle === 'double' && width !== undefined) {
            const thinW = Math.max(0.5, lineWidth * 0.3);
            const gap = Math.max(0.5, lineWidth * 0.35);

            this.ctx.lineWidth = thinW;
            const rw = Math.round(width);

            this.ctx.beginPath();
            this.ctx.moveTo(rx, ry - gap);
            this.ctx.lineTo(rx + rw, ry - gap);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(rx, ry + gap);
            this.ctx.lineTo(rx + rw, ry + gap);
            this.ctx.stroke();
        } else {
            this.ctx.lineWidth = lineWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(rx, ry);
            if (width !== undefined) {
                this.ctx.lineTo(rx + Math.round(width), ry);
            } else if (height !== undefined) {
                this.ctx.lineTo(rx, ry + Math.round(height));
            }
            this.ctx.stroke();
        }
    }

    private drawText(item: Extract<RenderItem, { type: 'text' }>) {
        const { text, x, y, fontSize, fontFamily, color, bold, italic, underline, strikethrough, width } = item;

        const fontWeight = bold ? 'bold' : 'normal';
        const fontStyle = italic ? 'italic' : 'normal';
        this.ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}"`;

        const fillColor = color ? `#${color}` : '#000000';
        this.ctx.fillStyle = fillColor;

        // Round coordinates to prevent sub-pixel blurring
        const rx = Math.round(x);
        const baseline = Math.round(y + fontSize * 0.88);
        this.ctx.fillText(text, rx, baseline);

        if (underline) {
            const lineY = baseline + 1.5;
            this.ctx.strokeStyle = fillColor;
            this.ctx.lineWidth = Math.max(0.6, fontSize * 0.05);
            this.ctx.beginPath();
            this.ctx.moveTo(x, lineY);
            this.ctx.lineTo(x + width, lineY);
            this.ctx.stroke();
        }

        if (strikethrough) {
            const lineY = y + fontSize * 0.55;
            this.ctx.strokeStyle = fillColor;
            this.ctx.lineWidth = Math.max(0.6, fontSize * 0.05);
            this.ctx.beginPath();
            this.ctx.moveTo(x, lineY);
            this.ctx.lineTo(x + width, lineY);
            this.ctx.stroke();
        }
    }

    private drawImage(item: Extract<RenderItem, { type: 'image' }>) {
        const img = new Image();

        img.onerror = () => {
            console.error('Failed to load image:', item.src.substring(0, 50) + '...');
            this.ctx.fillStyle = '#fee2e2';
            this.ctx.fillRect(item.x, item.y, item.width, item.height);
        };

        const render = () => {
            this.ctx.save();

            // Move to center of image position
            const centerX = item.x + item.width / 2;
            const centerY = item.y + item.height / 2;
            this.ctx.translate(centerX, centerY);

            // Apply rotation if needed
            if (item.rotation) {
                this.ctx.rotate((item.rotation * Math.PI) / 180);
            }

            // Draw image centered at the translated origin
            this.ctx.drawImage(img, -item.width / 2, -item.height / 2, item.width, item.height);
            this.ctx.restore();
        };

        img.onload = render;
        img.src = item.src;
        if (img.complete && img.naturalWidth > 0) {
            render();
        }
    }

    public static setupHiDPICanvas(canvas: HTMLCanvasElement, width: number, height: number, ratio?: number) {
        const pixelRatio = ratio || window.devicePixelRatio || 1;
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            ctx.imageSmoothingEnabled = true;
            (ctx as any).imageSmoothingQuality = 'high';
        }
    }
}
