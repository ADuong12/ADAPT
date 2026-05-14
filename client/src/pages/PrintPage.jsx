import { useState, useEffect, useRef, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useApi } from '../api/useApi';

export default function PrintPage() {
  const api = useApi();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const iframeRef = useRef(null);
  const [version, setVersion] = useState(null);
  const [error, setError] = useState(null);

  const adaptedId = searchParams.get('adapted_id');
  const versionId = searchParams.get('version_id');

  useEffect(() => {
    if (!adaptedId || !versionId) {
      setError('Missing query parameters: adapted_id and version_id are required.');
      return;
    }
    api.get(`/adaptations/${adaptedId}/versions/${versionId}`)
      .then((v) => {
        setVersion(v);
      })
      .catch((e) => setError(e.message));
  }, [adaptedId, versionId]);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  };

  const handleClose = () => {
    navigate(-1);
  };

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div className="page-title">Print Preview</div>
        <div className="page-subtitle" style={{ color: '#b91c1c' }}>{error}</div>
      </div>
    );
  }

  return (
    <>
      <div className="print-toolbar" style={{
        position: 'sticky',
        top: 0,
        background: '#fff',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        padding: '8px 16px',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        zIndex: 10,
      }}>
        <button className="btn-primary" onClick={handlePrint} style={{ padding: '6px 14px', fontSize: 13 }}>
          Print or Save PDF
        </button>
        <button className="btn" onClick={handleClose} style={{ padding: '6px 14px', fontSize: 13 }}>
          Close
        </button>
        {version && (
          <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>
            adaptation #{adaptedId}, version {versionId}
          </span>
        )}
      </div>
      <iframe
        ref={iframeRef}
        className="plan-frame"
        sandbox="allow-same-origin"
        title="Print preview"
        style={{ width: '100%', height: 'calc(100vh - 50px)', border: 0 }}
        srcDoc={version?.rendered_html || ''}
      />
    </>
  );
}