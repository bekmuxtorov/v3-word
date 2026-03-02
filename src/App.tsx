import { useState, useEffect, useCallback } from 'react'
import {
  QrCode, ImageIcon
} from 'lucide-react'
import { DocumentEditor } from './components/DocumentEditor'
import { parseDocxBuffer } from './core/DocxParser'
import { buildLayoutTree } from './core/LayoutEngine'
import type { LayoutModel } from './core/types'
import './App.css'

interface WindowConfig {
  input_url: string;
  output_url?: string;
  v3_ganiwer?: string;
  mode?: 'edit' | 'pdf';
}

function App() {
  const [layoutModel, setLayoutModel] = useState<LayoutModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingSource, setLoadingSource] = useState<'file' | 'url' | 'window' | null>(null)

  const processBuffer = useCallback(async (arrayBuffer: ArrayBuffer, name: string) => {
    const { nodes, pageSettings, defaults } = await parseDocxBuffer(arrayBuffer)
    if (nodes.length === 0) {
      throw new Error('Hujjatda matn topilmadi.')
    }
    const layout = buildLayoutTree(name, nodes, pageSettings, defaults)
    setLayoutModel(layout)
    window.parent.postMessage({ status: 'loaded', url: name }, '*');
  }, []);

  useEffect(() => {
    let readyInterval: NodeJS.Timeout;

    // Notify both parent (iframe) and opener (popup window)
    const notifyReady = (count: number) => {
      const msg = { status: 'ready', version: 'v3-debug', attempt: count };
      console.log(`[Editor] Sending ready signal (attempt ${count})...`, msg);

      if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, '*');
      }
      if (window.opener) {
        window.opener.postMessage(msg, '*');
      }
    };

    // Initial notification
    notifyReady(0);

    // Repeat notification until we get a message (fix for production race conditions)
    let attempts = 0;
    readyInterval = setInterval(() => {
      attempts++;
      if (attempts > 10) { // Stop after 5 seconds (10 * 500ms)
        console.warn('[Editor] Ready signal timeout. Parent did not respond after 5s.');
        clearInterval(readyInterval);
        return;
      }
      notifyReady(attempts);
    }, 500);

    const handleMessage = async (event: MessageEvent) => {
      console.log('[Editor] Received message from parent:', event.data);

      const data = event.data as WindowConfig;
      if (!data || !data.input_url) {
        console.warn('[Editor] Invalid message data or missing input_url:', data);
        return;
      }

      console.info('[Editor] Valid config received. Starting document load:', data.input_url);

      // Stop repeating once we receive the configuration
      clearInterval(readyInterval);

      setLoading(true);
      setLoadingSource('window');
      setError(null);
      setLayoutModel(null);

      try {
        console.log('[Editor] Fetching document...');
        const response = await fetch(data.input_url);
        if (!response.ok) throw new Error(`Server javobi: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        console.log('[Editor] Document fetched, processing buffer...');
        await processBuffer(arrayBuffer, data.input_url.split('/').pop() || 'document.docx');
        console.info('[Editor] Document loaded successfully.');
      } catch (err: any) {
        console.error('[Editor] Error loading document:', err);
        setError('Hujjatni yuklashda xatolik: ' + err.message);
      } finally {
        setLoading(false);
        setLoadingSource(null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      console.log('[Editor] Cleaning up message listeners...');
      window.removeEventListener('message', handleMessage);
      clearInterval(readyInterval);
    };
  }, [processBuffer]);

  const handleInjectQR = useCallback(() => {
    if (!layoutModel) return;

    // Professional QR Template Placeholder (Base64)
    const qrSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJ4AAACfCAMAAAA/B5DsAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAMAUExURf///wAAAO/39xAQGQAICO/v7xAQCK2trSEhIXNrc9bO1ubm5jExMVJaWr21vUI6Qs7Fztbe1qWlnCkhKYR7hL3FxYyUlJycnEpKQoyMhHtzc1JKUjoZ5joZtRAZ5hAZtWMZ5rWlELVCEGMZtbVzELUQEK2MzmNaWjrO3jrOWmOEOmPvGWMZjGPvnDrOnDrOGWPF3hDO3hDOWmOEEGMZY2PFnBDOnBDOGbXvpbVStbUZtbXOpbVSlLUZlKVS5qUZ5ubvY+beMebvpYS9WoS9GebOY+bOpXtKOjpK5jpKtWOMY3tKEBBK5hBKtWNK5ualEOZCEGN7lGNKteZzEOYQEIQZOjoZjDFSGVoZOhAZjIQZEDoZY1oZEBAZY+atzmNShOaEzuZStbXmzuYZtYQZ5rWlMbVCMbWlc7VCc4QZtbVzMbUQMbVzc7UQc62M71JKGeZSlOYZlLWlUrVCUrVzUrUQUuZC5uYI5oTv3oTvWjrv3jrvWoSEOoTvGYQZjITvnDrvnDrvGYTF3hDv3hDvWoSEEIQZY4TFnBDvnBDvGa3e7zpKjBBKjDpKYxBKY86tnM6EnMVS5sUZ5oRK5ualc+ZCc+alMeZCMWOclIRKteZzMeYQMeZzc+YQc+alUuZCUuZzUuYQUuat74RShOaE77XvELXOEDE6Os7e7+Zj5q215uYp5mN772N7xYSUY++tnO+EnObvEGO9a2O9KaWEnObOEGO9SmO9CLXvMbXvc7XOc7XOMbXvUrXOUjql7zqlazqlrTqlKRCl7xClaxClrRClKTp77zp7azp7rTp7KRB77xB7axB7rRB7KWOc72OcxWPv72PvazEIEDEIOggxOoR774R7xQgxEDqlzjqlSjqljDqlCBClzhClShCljBClCDp7zjp7Sjp7jDp7CBB7zhB7ShB7jBB7CGPvzmPvSmNrYwhSOoSc74ScxQhSEIRSWggQMe/v1jFSQjExEO/O7+/O1jEhEAgAKf/e76W1vVprc+/35iEhCP//7xAAAAAAANdxYjcAAAEAdFJOU////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wBT9wclAAAACXBIWXMAABcRAAAXEQHKJvM/AAASiklEQVR4Xu1cXXKrurK2AYFihILANkh+vx7WmdadgSeQkeQlc+Atb7GduG61/pCE8N/ZtbOq7vpMcGwQklut7lZ3S4uFRFlvKKWbWwetmbr/WbD76tm49SBGi257F7qCMuTW9wjQ6u56msI28FwXYl/1VQ+H8xb9WA0dfbJ9aNMJWc30qdOPlShqVU9ZnAhOv/E7fsf4/UO+w6fYR/xOqk6XexCo3lbqQZOnTj7id0yGolTF+Gu+XC6XmT3ZNwPzMVsus3YonmJAVog2Uw+6XolCSnidQPOKAXsXbuBj19Vh1XcA1ds+DZ91DeREP+FXNQ81L7v0/JneRTV/rHl4L3tp1VX4El67gnTH63NY+W083ryhW8nmDW14aQRwm/dFSk4FA6Z4FKwQZKZ9k0oAuOqAenVXYcOraYr160Of3nFq/4d3TIbmmb6VcqV6xfrJ0UpSDCfT0HaQPM46w3spJoe+V8frqzz1B/0Gp1fS95XoavQM8RbJZw1y7xUeFK9EXiPfisT5SL1W8l72fdgLvl4LdXA4r+F/YT5wwbdFjZ4intScBefycfK1Fmv5yVYC1Zz2B00szXtAPUnQtK34sd5s3EO/qxPdbOrV8zptsUBlDc8aH6neTS2yjq5qJfkyvJeda0duSgT9TM4LdE7Oydc5QefkB/6HL9AXfLl4mnAayQIeY58LDz4v0I+uBP7KYlAD6NIOsnNXlnoHQZ/iqn8SPxuh5E+GK925lRIs6UFswrv/dSAqiFSxhvdqI/dyIp41Rv45nKmWjhe8l53LugrL9qYHcfz15iF66pWBouUe8J7qXCKKP6B5RrdYubdXzcsPf0DnosKhnpZ7Siz/WdS7hDoXRi5YWL8KZA2HkXq6c8kfMDTOVBxC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';

    const link = document.createElement('a');
    link.href = qrSrc;
    link.download = 'image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [layoutModel]);

  return (
    <div className="app-container">
      {/* 1. Minimal Toolbar */}
      <div className="toolbar-container">
        <div className="toolbar-row" style={{ justifyContent: 'flex-end', padding: '0 12px' }}>
          <div className="toolbar-group" style={{ borderRight: 'none' }}>
            <button className="toolbar-btn" title="QR Kod" onClick={handleInjectQR}><QrCode size={18} /></button>
            {/* <button className="toolbar-btn" title="Saqlash"><Save size={18} /></button> */}
          </div>
        </div>
      </div>

      <main className="workspace-container">
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>{loadingSource === 'window' ? 'Hujjat yuklanmoqda...' : 'Iltimos kuting...'}</p>
          </div>
        )}

        {error && <div className="error-state">{error}</div>}

        {!layoutModel && !loading && !error && (
          <div style={{ color: '#6b7280', marginTop: '100px', textAlign: 'center' }}>
            <ImageIcon size={48} strokeWidth={1} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p>Hujjat manzili parent oynadan kutilmoqda...</p>
          </div>
        )}

        {layoutModel && !loading && (
          <>
            <DocumentEditor layoutModel={layoutModel} />
          </>
        )}
      </main>
    </div>
  )
}

export default App
