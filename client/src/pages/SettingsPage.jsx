import { useState, useEffect, useContext } from 'react';
import { useApi, toast } from '../api/useApi';
import { AuthContext } from '../auth/AuthContext';

export default function SettingsPage() {
  const api = useApi();
  const { user } = useContext(AuthContext);
  const [provider, setProvider] = useState('openrouter');
  const [model, setModel] = useState('nvidia/nemotron-3-super-120b-a12b:free');
  const [apiKey, setApiKey] = useState('');
  const [redacted, setRedacted] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.teacherId) return;
    api.get(`/teachers/${user.teacherId}/llm-config`)
      .then((cfg) => {
        if (cfg) {
          setProvider(cfg.provider || 'openrouter');
          setModel(cfg.model || 'nvidia/nemotron-3-super-120b-a12b:free');
          setRedacted(cfg.api_key_redacted
            ? `Saved key: ${cfg.api_key_redacted} (paste a new one to replace)`
            : 'No key saved yet.');
        }
      })
      .catch((e) => setError(e.message));
  }, [user?.teacherId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        provider,
        model: model || null,
      };
      if (apiKey) payload.api_key = apiKey;
      await api.put(`/teachers/${user.teacherId}/llm-config`, payload);
      setApiKey('');
      // Reload config to show updated redacted key
      const cfg = await api.get(`/teachers/${user.teacherId}/llm-config`);
      if (cfg) {
        setRedacted(cfg.api_key_redacted
          ? `Saved key: ${cfg.api_key_redacted} (paste a new one to replace)`
          : 'No key saved yet.');
      }
      toast('saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestStatus('testing…');
    try {
      const r = await api.post(`/teachers/${user.teacherId}/llm-config/test`, {});
      if (r && r.ok) {
        setTestStatus(`✓ ${r.provider}/${r.model || 'default'} responded in ${r.latency_ms}ms`);
        setTestStatus((prev) => prev); // trigger style
      } else {
        setTestStatus(`✗ ${r?.error || 'Test failed'}`);
      }
    } catch (err) {
      // Handle 501 Not Implemented gracefully
      if (err.status === 501) {
        setTestStatus('Test connection feature coming soon');
        toast('Test connection feature coming soon', 'error');
      } else {
        setTestStatus(err.message);
      }
    } finally {
      setTesting(false);
    }
  };

  if (error) return <div className="page-subtitle">{error}</div>;

  return (
    <>
      <div className="page-title">LLM Settings</div>
      <div className="page-subtitle">Configure your AI provider</div>

      <div className="card" style={{ maxWidth: 560 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>LLM provider</div>
        <form id="llm-form" onSubmit={handleSave}>
          <div className="form-row">
            <label>Provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="openrouter">OpenRouter — recommended</option>
              <option value="gemini">Gemini (Google)</option>
              <option value="huggingface">HuggingFace Inference</option>
            </select>
          </div>
          <div className="form-row">
            <label>Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. nvidia/nemotron-3-super-120b-a12b:free"
            />
          </div>
          <div className="form-row">
            <label>API key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="paste new key to replace existing one (optional)"
            />
            <div id="redacted" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{redacted}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            <button className="btn" type="button" onClick={handleTest} disabled={testing}>
              Test connection
            </button>
          </div>
          {testStatus && (
            <div style={{ fontSize: 12, color: testStatus.startsWith('✓') ? 'var(--success-text)' : testStatus.startsWith('✗') || testStatus.includes('coming soon') ? '#b91c1c' : 'var(--text2)', marginTop: 10 }}>
              {testStatus}
            </div>
          )}
        </form>
      </div>

      <div className="card" style={{ maxWidth: 560, marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Where to get a key</div>
        <ul style={{ fontSize: 12, color: 'var(--text2)', paddingLeft: 18, lineHeight: 1.7 }}>
          <li><b>Gemini</b>: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-text)' }}>aistudio.google.com/app/apikey</a> (free tier)</li>
          <li><b>OpenRouter</b>: <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-text)' }}>openrouter.ai/keys</a> (multi-model, free tiers available)</li>
          <li><b>HuggingFace</b>: <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-text)' }}>huggingface.co/settings/tokens</a> (read access)</li>
        </ul>
      </div>

      <div className="card" style={{ maxWidth: 560, marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Local fallback</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
          For a shared local demo, set <code>ADAPT_GEMINI_API_KEY</code> in the project environment. ADAPT will use it only when this teacher has not saved a key here.
        </div>
      </div>
    </>
  );
}