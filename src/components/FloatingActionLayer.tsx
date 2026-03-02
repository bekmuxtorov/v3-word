import React, { useState } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import type { LayoutModel } from '../core/types';
import { FileSignature, CheckCircle } from 'lucide-react';

interface Props {
    layoutModel: LayoutModel;
    pageIndex: number;
}

export const FloatingActionLayer: React.FC<Props> = ({ layoutModel, pageIndex }) => {
    const [signed, setSigned] = useState(false);
    const [loading, setLoading] = useState(false);

    // Parse EOF marker coordinates
    const { eofMarker } = layoutModel;

    // We only show the button on the page where the EOF marker is located
    if (eofMarker.pageIndex !== pageIndex) {
        return null;
    }

    const handleSign = async () => {
        setLoading(true);
        try {
            // Simulate fake API call
            const metadata = {
                signer: "Senior Engineer",
                timestamp: new Date().toISOString(),
            };

            // We would normally POST to server here
            await new Promise(resolve => setTimeout(resolve, 800)); // fake delay
            // await axios.post('https://api.example.com/sign', { documentId: layoutModel.documentId, metadata });

            console.log('Document signed!', metadata);
            setSigned(true);
        } catch (e) {
            console.error(e);
            alert('Failed to sign document');
        } finally {
            setLoading(false);
        }
    };

    // Determine button position over canvas (absolute positioned)
    // X, Y are in 96DPI layout coordinates
    const btnX = eofMarker.x + 10;
    const btnY = eofMarker.y + 20;

    return (
        <div
            style={{
                position: 'absolute',
                left: `${btnX}px`,
                top: `${btnY}px`,
                pointerEvents: 'auto', // override parent pointer-events: none if any
                zIndex: 10,
            }}
        >
            {!signed ? (
                <button
                    onClick={handleSign}
                    disabled={loading}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 18px',
                        backgroundColor: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: loading ? 'wait' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                    }}
                >
                    <FileSignature size={18} />
                    {loading ? "Signing..." : "Sign & Generate QR"}
                </button>
            ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ padding: '8px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                        <QRCode
                            value={`https://verify.example.com/doc/${layoutModel.documentId}`}
                            size={100}
                            level={"H"}
                            includeMargin={false}
                        />
                    </div>
                    <div style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500', marginTop: '4px' }}>
                        <CheckCircle size={18} /> Signed Verify via QR
                    </div>
                </div>
            )}
        </div>
    );
};
