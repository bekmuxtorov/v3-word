import React, { useEffect, useRef } from 'react';
import type { LayoutModel } from '../core/types';
import { CanvasRenderer } from '../core/Renderer';

interface Props {
    layoutModel: LayoutModel;
}

export const DocumentEditor: React.FC<Props> = ({ layoutModel }) => {
    return (
        <div className="document-pages-list">
            {layoutModel.pages.map((_, index) => (
                <PageContainer
                    key={index}
                    layoutModel={layoutModel}
                    pageIndex={index}
                    containerId={`page-container-${layoutModel.documentId}-${index}`}
                />
            ))}
        </div>
    );
};

const PageContainer: React.FC<{
    layoutModel: LayoutModel,
    pageIndex: number,
    containerId: string
}> = ({ layoutModel, pageIndex, containerId }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const page = layoutModel.pages[pageIndex];

    useEffect(() => {
        if (!canvasRef.current) return;
        CanvasRenderer.setupHiDPICanvas(canvasRef.current, page.width, page.height);
        const renderer = new CanvasRenderer(canvasRef.current);
        renderer.renderPage(page);
    }, [page]);

    return (
        <div
            id={containerId}
            className="page-wrapper"
            style={{
                width: `${page.width}px`,
                height: `${page.height}px`,
            }}
        >
            {/* Layer 1: Canvas Render Layer */}
            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: 1
                }}
            />
        </div>
    );
}
