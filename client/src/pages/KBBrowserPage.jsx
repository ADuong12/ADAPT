import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router';
import { useApi, toast } from '../api/useApi';
import { AuthContext } from '../auth/AuthContext';

export default function KBBrowserPage() {
  const api = useApi();
  const { user } = useContext(AuthContext);
  const [kbs, setKbs] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [selectedKbIds, setSelectedKbIds] = useState(new Set());
  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/knowledge-bases'),
      api.get('/clusters'),
    ])
      .then(([kbList, clusterList]) => {
        setKbs(kbList);
        setClusters(clusterList);
        if (clusterList.length > 0) {
          setSelectedClusterId(clusterList[0].cluster_id);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  // Load cluster KB mapping when cluster selection changes
  useEffect(() => {
    if (!selectedClusterId) return;
    api.get(`/clusters/${selectedClusterId}/kbs`)
      .then((current) => {
        setSelectedKbIds(new Set(current.map((k) => k.kb_id)));
      })
      .catch((e) => setError(e.message));
  }, [selectedClusterId]);

  const handleToggleKb = (kbId, checked) => {
    setSelectedKbIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(kbId);
      else next.delete(kbId);
      return next;
    });
  };

  const handleSaveMapping = async () => {
    if (!selectedClusterId) return;
    setSaving(true);
    try {
      await api.put(`/clusters/${selectedClusterId}/kbs`, {
        kb_ids: [...selectedKbIds],
      });
      toast('Knowledge base mapping saved', 'success');
      // Refresh clusters to show updated kb_count
      const clusterList = await api.get('/clusters');
      setClusters(clusterList);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredKbs = kbs.filter((k) =>
    [k.kb_name, k.description, k.category, `KB ${k.kb_id}`].join(' ').toLowerCase().includes(search.toLowerCase())
  );

  // Group KBs by category
  const grouped = {};
  filteredKbs.forEach((k) => {
    const cat = k.category || 'Other';
    (grouped[cat] ||= []).push(k);
  });

  if (error) return <div className="page-subtitle">{error}</div>;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
        <div>
          <div className="page-title">Knowledge Bases</div>
          <div className="page-subtitle">{kbs.length} resources — {clusters.length} learner profiles</div>
        </div>
        <Link to="/personalize" className="btn-primary">Use in a Lesson</Link>
      </div>

      <div className="teacher-note">
        Knowledge base IDs are the source set ADAPT retrieves from during RAG. A learner profile can use multiple KB IDs, and every generated plan cites the KBs it used.
      </div>

      <div className="kb-workspace">
        <div>
          <input
            type="search"
            placeholder="Search knowledge bases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="section-label" style={{ marginTop: 14 }}>{cat}</div>
              {items.map((k) => (
                <div className="card" key={k.kb_id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{k.kb_name}</div>
                    <span className="badge badge-info">KB #{k.kb_id}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', margin: '4px 0' }}>{k.description || ''}</div>
                  {k.source_url && (
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      <a href={k.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-text)' }}>View source</a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="teacher-panel">
          <div className="section-label">Profile to KB mapping</div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Tune RAG sources by learner profile</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
            Choose a profile, then check the KB IDs ADAPT should retrieve from when planning for that group.
          </div>
          <select
            className="wide-select"
            aria-label="Learner profile"
            value={selectedClusterId || ''}
            onChange={(e) => setSelectedClusterId(Number(e.target.value))}
          >
            {clusters.map((c) => (
              <option key={c.cluster_id} value={c.cluster_id}>{c.cluster_name}</option>
            ))}
          </select>
          <div style={{ marginTop: 12 }}>
            {(() => {
              const kbGroups = {};
              kbs.forEach((k) => {
                const cat = k.category || 'Other';
                (kbGroups[cat] ||= []).push(k);
              });
              return Object.entries(kbGroups).map(([cat, items]) => (
                <div key={cat}>
                  <div className="section-label" style={{ marginTop: 12 }}>{cat}</div>
                  {items.map((k) => (
                    <label
                      key={k.kb_id}
                      className={`mini-check ${selectedKbIds.has(k.kb_id) ? 'checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedKbIds.has(k.kb_id)}
                        onChange={(e) => handleToggleKb(k.kb_id, e.target.checked)}
                      />
                      <span>KB #{k.kb_id} {k.kb_name}</span>
                    </label>
                  ))}
                </div>
              ));
            })()}
          </div>
          <button
            className="btn-primary"
            style={{ width: '100%', marginTop: 8 }}
            disabled={saving}
            onClick={handleSaveMapping}
          >
            {saving ? 'Saving...' : 'Save KB Mapping'}
          </button>
        </div>
      </div>
    </>
  );
}