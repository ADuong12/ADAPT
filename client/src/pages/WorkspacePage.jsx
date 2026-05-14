import { useReducer, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useApi, toast } from '../api/useApi';
import { AuthContext } from '../auth/AuthContext';
import { diffWords } from 'diff';

const initialState = {
  adaptation: null,
  versions: [],
  selectedId: null,
  selectedDetail: null,
  parentDetail: null,
  refineInstruction: '',
  rating: 0,
  feedbackComment: '',
  diffOpen: false,
  refineLoading: false,
  rollbackLoading: false,
  feedbackLoading: false,
  exportLoading: false,
  loading: true,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ADAPTATION':
      return { ...state, adaptation: action.payload, versions: action.payload.versions || [], loading: false };
    case 'SELECT_VERSION':
      return { ...state, selectedId: action.payload.detail.version_id, selectedDetail: action.payload.detail, parentDetail: action.payload.parent };
    case 'SET_REFINE_INSTRUCTION':
      return { ...state, refineInstruction: action.payload };
    case 'SET_RATING':
      return { ...state, rating: action.payload };
    case 'SET_FEEDBACK_COMMENT':
      return { ...state, feedbackComment: action.payload };
    case 'TOGGLE_DIFF':
      return { ...state, diffOpen: !state.diffOpen };
    case 'SET_REFINE_LOADING':
      return { ...state, refineLoading: action.payload };
    case 'SET_ROLLBACK_LOADING':
      return { ...state, rollbackLoading: action.payload };
    case 'SET_FEEDBACK_LOADING':
      return { ...state, feedbackLoading: action.payload };
    case 'SET_EXPORT_LOADING':
      return { ...state, exportLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    default:
      return state;
  }
}

function htmlToText(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || '').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim();
}

function renderDiff(parentHtml, currentHtml) {
  const oldText = htmlToText(parentHtml);
  const newText = htmlToText(currentHtml);
  const parts = diffWords(oldText, newText);
  return parts.map((part, i) => {
    const text = part.value.replace(/</g, '&lt;').replace(/\n/g, '<br/>');
    if (part.added) return `<ins key=${i}>${text}</ins>`;
    if (part.removed) return `<del key=${i}>${text}</del>`;
    return text;
  }).join('');
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function WorkspacePage() {
  const { adaptedId } = useParams();
  const api = useApi();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, initialState);
  useEffect(() => {
    api.get('/adaptations/' + adaptedId)
      .then(data => {
        dispatch({ type: 'SET_ADAPTATION', payload: data });
        if (data.versions && data.versions.length > 0) {
          const headId = data.head?.version_id || data.versions[0].version_id;
          selectVersion(headId);
        }
      })
      .catch(e => dispatch({ type: 'SET_ERROR', payload: e.message }));
  }, [adaptedId]);

  async function selectVersion(versionId) {
    try {
      const detail = await api.get('/adaptations/' + adaptedId + '/versions/' + versionId);
      let parent = null;
      if (detail.parent_version_id) {
        parent = await api.get('/adaptations/' + adaptedId + '/versions/' + detail.parent_version_id);
      }
      dispatch({ type: 'SELECT_VERSION', payload: { detail, parent } });
    } catch (e) {
      toast('Failed to load version: ' + e.message, 'error');
    }
  }

  async function handleRefine(e) {
    e.preventDefault();
    if (!state.refineInstruction.trim()) return;
    dispatch({ type: 'SET_REFINE_INSTRUCTION', payload: '' });
    dispatch({ type: 'SET_REFINE_LOADING', payload: true });
    try {
      const out = await api.post('/adaptations/' + adaptedId + '/refine', { instruction: state.refineInstruction });
      // Reload adaptation data
      const data = await api.get('/adaptations/' + adaptedId);
      dispatch({ type: 'SET_ADAPTATION', payload: data });
      if (out.head_version) {
        await selectVersion(out.head_version.version_id);
      }
      toast('Saved as version ' + (out.head_version?.version_number || ''), 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      dispatch({ type: 'SET_REFINE_LOADING', payload: false });
    }
  }

  async function handleRollback() {
    if (!confirm('Make version ' + state.selectedDetail?.version_number + ' the current draft? Later versions stay in history.')) return;
    dispatch({ type: 'SET_ROLLBACK_LOADING', payload: true });
    try {
      const out = await api.post('/adaptations/' + adaptedId + '/rollback', { version_id: state.selectedId });
      const data = await api.get('/adaptations/' + adaptedId);
      dispatch({ type: 'SET_ADAPTATION', payload: data });
      if (out.head) {
        await selectVersion(out.head.version_id);
      }
      toast('Version restored as current draft', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      dispatch({ type: 'SET_ROLLBACK_LOADING', payload: false });
    }
  }

  async function handleFeedback() {
    if (!state.rating) { toast('Pick a rating first', 'error'); return; }
    dispatch({ type: 'SET_FEEDBACK_LOADING', payload: true });
    try {
      await api.post('/adaptations/' + adaptedId + '/feedback', {
        rating: state.rating,
        comments: state.feedbackComment || null,
      });
      toast('Feedback saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      dispatch({ type: 'SET_FEEDBACK_LOADING', payload: false });
    }
  }

  async function exportHTML() {
    if (!state.selectedId) return;
    dispatch({ type: 'SET_EXPORT_LOADING', payload: true });
    try {
      const token = user?.token || localStorage.getItem('authToken');
      const res = await fetch('/api/adaptations/' + adaptedId + '/versions/' + state.selectedId + '/export.html', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'adapt-lesson-' + adaptedId + '-v' + (state.selectedDetail?.version_number || 1) + '.html';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Final HTML downloaded', 'success');
    } catch (err) {
      toast('Download failed: ' + err.message, 'error');
    } finally {
      dispatch({ type: 'SET_EXPORT_LOADING', payload: false });
    }
  }

  async function exportDocx() {
    if (!state.selectedId) return;
    dispatch({ type: 'SET_EXPORT_LOADING', payload: true });
    try {
      const token = user?.token || localStorage.getItem('authToken');
      const res = await fetch('/api/adaptations/' + adaptedId + '/versions/' + state.selectedId + '/export-docx', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'adapt-lesson-' + adaptedId + '-v' + (state.selectedDetail?.version_number || 1) + '.docx';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('DOCX downloaded', 'success');
    } catch (err) {
      toast('DOCX download failed: ' + err.message, 'error');
    } finally {
      dispatch({ type: 'SET_EXPORT_LOADING', payload: false });
    }
  }

  async function exportPdf() {
    if (!state.selectedId) return;
    dispatch({ type: 'SET_EXPORT_LOADING', payload: true });
    try {
      const token = user?.token || localStorage.getItem('authToken');
      const res = await fetch('/api/adaptations/' + adaptedId + '/versions/' + state.selectedId + '/export-pdf', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'adapt-lesson-' + adaptedId + '-v' + (state.selectedDetail?.version_number || 1) + '.pdf';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('PDF downloaded', 'success');
    } catch (err) {
      toast('PDF download failed: ' + err.message, 'error');
    } finally {
      dispatch({ type: 'SET_EXPORT_LOADING', payload: false });
    }
  }

  if (state.error) {
    return (
      <div>
        <div className="page-title">Lesson Workspace</div>
        <div className="page-subtitle" style={{ color: '#b91c1c' }}>{state.error}</div>
      </div>
    );
  }

  if (state.loading) {
    return (
      <div>
        <div className="page-title">Lesson planning workspace</div>
        <div className="page-subtitle">Loading your latest lesson draft…</div>
      </div>
    );
  }

  const suggestions = [
    'Make it simpler',
    'Add more examples',
    'Focus on visual learners',
  ];

  return (
    <div>
      <div className="workspace-header">
        <div>
          <div className="page-title">Lesson planning workspace #{adaptedId}</div>
          <div className="page-subtitle">
            {state.versions.length} version{state.versions.length === 1 ? '' : 's'} — current draft: version {state.adaptation?.head?.version_number || '—'}
          </div>
        </div>
        <div className="workspace-actions">
          {state.parentDetail && (
            <button className="btn" style={{ fontSize: 12 }} onClick={() => dispatch({ type: 'TOGGLE_DIFF' })}>
              {state.diffOpen ? 'Hide redline' : 'Show redline vs previous'}
            </button>
          )}
          {state.selectedDetail && !state.selectedDetail.is_head && (
            <button className="btn" style={{ fontSize: 12 }} onClick={handleRollback} disabled={state.rollbackLoading}>
              {state.rollbackLoading ? 'Restoring…' : 'Rollback to this version'}
            </button>
          )}
          <button className="btn" style={{ fontSize: 12 }} onClick={exportHTML} disabled={state.exportLoading}>
            {state.exportLoading ? 'Downloading…' : 'Download HTML'}
          </button>
          <button className="btn" style={{ fontSize: 12 }} onClick={exportDocx} disabled={state.exportLoading}>
            {state.exportLoading ? 'Downloading…' : 'Export DOCX'}
          </button>
          <button className="btn" style={{ fontSize: 12 }} onClick={exportPdf} disabled={state.exportLoading}>
            {state.exportLoading ? 'Downloading…' : 'Export PDF'}
          </button>
          {state.selectedId && (
            <Link
              to={'/print?adapted_id=' + adaptedId + '&version_id=' + state.selectedId}
              target="_blank"
              className="btn-primary"
              style={{ fontSize: 12, textDecoration: 'none', display: 'inline-block' }}
            >
              Open Print View
            </Link>
          )}
        </div>
      </div>

      <div className="teacher-workspace">
        {/* Left column: Version timeline */}
        <div className="version-timeline">
          <div className="section-label">Draft history</div>
          {state.versions.map(v => (
            <div
              key={v.version_id}
              className={`version-row${state.selectedId === v.version_id ? ' selected' : ''}`}
              onClick={() => selectVersion(v.version_id)}
            >
              <div>
                <span className="v-label">Version {v.version_number}</span>
                {v.is_head && <span className="head-pill">current</span>}
              </div>
              <div className="v-meta">{fmtDate(v.created_at)}{v.provider ? ' - ' + v.provider : ''}</div>
              {v.instruction ? (
                <div className="v-instr">&ldquo;{v.instruction}&rdquo;</div>
              ) : (
                <div className="v-instr">Initial RAG draft</div>
              )}
            </div>
          ))}
        </div>

        {/* Center column: Preview */}
        <div className="preview-column">
          <div className="workspace-strip">
            <div>
              <div className="section-label">Rendered lesson preview</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                {state.selectedDetail ? [
                  state.selectedDetail.provider ? 'Provider: ' + state.selectedDetail.provider : null,
                  state.selectedDetail.model_used ? 'Model: ' + state.selectedDetail.model_used : null,
                  state.selectedDetail.parent_version_id ? 'Refined from prior version' : 'Initial RAG generation',
                ].filter(Boolean).join(' - ') : 'Loading...'}
              </div>
            </div>
            <span className="badge badge-success">{state.selectedDetail?.is_head ? 'Current draft' : 'History'}</span>
          </div>

          {state.diffOpen && state.parentDetail && state.selectedDetail && (
            <div className="diff-output card">
              <div className="section-label">Redline diff</div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }} dangerouslySetInnerHTML={{ __html: renderDiff(state.parentDetail.rendered_html, state.selectedDetail.rendered_html) }} />
            </div>
          )}

          <iframe
            className="plan-frame"
            sandbox="allow-same-origin"
            title="Lesson preview"
            srcDoc={state.selectedDetail?.rendered_html || ''}
          />
        </div>

        {/* Right column: Refine + Feedback */}
        <div className="teacher-panel">
          <div className="section-label">Iterate with RAG</div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Ask for the next classroom-ready revision</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
            Each request uses the current draft, selected knowledge bases, and your class context to create a new version.
          </div>
          <form onSubmit={handleRefine}>
            <div className="form-row">
              <textarea
                rows={7}
                placeholder="Example: Make the unplugged activity easier for multilingual learners and add a Spanish family note."
                value={state.refineInstruction}
                onChange={e => dispatch({ type: 'SET_REFINE_INSTRUCTION', payload: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={state.refineLoading}>
              {state.refineLoading ? 'Using RAG to revise…' : 'Create New Version'}
            </button>
          </form>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0 16px' }}>
            {suggestions.map(s => (
              <button
                key={s}
                className="btn"
                style={{ fontSize: 11, padding: '5px 11px' }}
                onClick={() => dispatch({ type: 'SET_REFINE_INSTRUCTION', payload: s })}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="section-label">Finalize</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
            Download the adapted plan as HTML, DOCX, or PDF. DOCX preserves original images and hyperlinks.
          </div>
          <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={exportHTML} disabled={state.exportLoading}>
            {state.exportLoading ? 'Downloading…' : 'Download HTML'}
          </button>
          <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={exportDocx} disabled={state.exportLoading}>
            {state.exportLoading ? 'Downloading…' : 'Export DOCX'}
          </button>
          <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={exportPdf} disabled={state.exportLoading}>
            {state.exportLoading ? 'Downloading…' : 'Export PDF'}
          </button>
          {state.selectedId && (
            <Link
              to={'/print?adapted_id=' + adaptedId + '&version_id=' + state.selectedId}
              target="_blank"
              className="btn-primary"
              style={{ width: '100%', display: 'block', textAlign: 'center', textDecoration: 'none' }}
            >
              Open Printable Lesson
            </Link>
          )}

          <div className="feedback-box">
            <div className="section-label">Teacher feedback</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
              Rate whether this version is ready for your class.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <span
                  key={n}
                  style={{ fontSize: 18, cursor: 'pointer', letterSpacing: 2, color: n <= state.rating ? '#D97706' : 'rgba(0,0,0,0.32)' }}
                  onClick={() => dispatch({ type: 'SET_RATING', payload: n })}
                >
                  ★
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Optional note for this draft"
              value={state.feedbackComment}
              onChange={e => dispatch({ type: 'SET_FEEDBACK_COMMENT', payload: e.target.value })}
              style={{ fontSize: 12 }}
            />
            <button
              className="btn"
              style={{ fontSize: 12, width: '100%', marginTop: 8 }}
              onClick={handleFeedback}
              disabled={state.feedbackLoading}
            >
              {state.feedbackLoading ? 'Saving…' : 'Save Feedback'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}