import { useReducer, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApi, toast } from '../api/useApi';

const STEP_LABELS = ['Select lesson', 'Learner profile', 'RAG sources', 'Draft'];

const initialState = {
  currentStep: 1,
  lessons: [],
  clusters: [],
  kbsForCluster: [],
  selectedLessonId: null,
  selectedClusterId: null,
  selectedKbIds: new Set(),
  generating: false,
  progress: 0,
  progressLabel: '',
  error: null,
  lessonSearch: '',
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LESSONS':
      return { ...state, lessons: action.payload };
    case 'SET_CLUSTERS':
      return { ...state, clusters: action.payload };
    case 'SET_KBS_FOR_CLUSTER':
      return { ...state, kbsForCluster: action.payload, selectedKbIds: new Set(action.payload.map(k => k.kb_id)) };
    case 'SELECT_LESSON':
      return { ...state, selectedLessonId: action.payload };
    case 'SELECT_CLUSTER':
      return { ...state, selectedClusterId: action.payload };
    case 'TOGGLE_KB': {
      const newSet = new Set(state.selectedKbIds);
      if (newSet.has(action.payload)) newSet.delete(action.payload);
      else newSet.add(action.payload);
      return { ...state, selectedKbIds: newSet };
    }
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    case 'SET_GENERATING':
      return { ...state, generating: action.payload };
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload };
    case 'SET_PROGRESS_LABEL':
      return { ...state, progressLabel: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, generating: false };
    case 'SET_LESSON_SEARCH':
      return { ...state, lessonSearch: action.payload };
    default:
      return state;
  }
}

const colors = ['badge-info', 'badge-success', 'badge-warn', 'badge-purple'];
function pickBadge(text) {
  if (!text) return 'badge-info';
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return colors[Math.abs(h) % colors.length];
}

export default function PersonalizePage() {
  const api = useApi();
  const [state, dispatch] = useReducer(reducer, initialState);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/api/lessons?page=1&limit=100'),
      api.get('/api/clusters'),
    ])
      .then(([lessonsData, clustersData]) => {
        dispatch({ type: 'SET_LESSONS', payload: lessonsData.lessons || lessonsData });
        dispatch({ type: 'SET_CLUSTERS', payload: clustersData });
      })
      .catch(e => dispatch({ type: 'SET_ERROR', payload: e.message }));
  }, []);

  const handleSelectCluster = async (clusterId) => {
    dispatch({ type: 'SELECT_CLUSTER', payload: clusterId });
    try {
      const kbs = await api.get('/api/clusters/' + clusterId + '/kbs');
      dispatch({ type: 'SET_KBS_FOR_CLUSTER', payload: kbs });
    } catch (e) {
      dispatch({ type: 'SET_ERROR', payload: e.message });
    }
  };

  const handleGeneration = async () => {
    dispatch({ type: 'SET_GENERATING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    let progress = 5;
    dispatch({ type: 'SET_PROGRESS', payload: progress });
    const stages = [
      'Retrieving KB chunks...',
      'Building prompt...',
      'Calling the teacher-selected LLM...',
      'Rendering HTML...',
    ];
    let stageIndex = 0;
    dispatch({ type: 'SET_PROGRESS_LABEL', payload: stages[0] });

    const tick = setInterval(() => {
      progress = Math.min(progress + 8, 90);
      dispatch({ type: 'SET_PROGRESS', payload: progress });
      if (stageIndex < stages.length - 1) {
        stageIndex++;
        dispatch({ type: 'SET_PROGRESS_LABEL', payload: stages[stageIndex] });
      }
    }, 700);

    try {
      const result = await api.post('/api/adapt', {
        lesson_id: state.selectedLessonId,
        cluster_id: state.selectedClusterId,
        kb_ids: [...state.selectedKbIds],
        include_student_context: true,
      });
      clearInterval(tick);
      dispatch({ type: 'SET_PROGRESS', payload: 100 });
      dispatch({ type: 'SET_PROGRESS_LABEL', payload: 'Done — opening lesson workspace...' });
      navigate('/workspace/' + result.adapted_id);
    } catch (e) {
      clearInterval(tick);
      dispatch({ type: 'SET_ERROR', payload: e.message });
      dispatch({ type: 'SET_PROGRESS_LABEL', payload: 'Failed.' });
    }
  };

  const filteredLessons = state.lessons.filter(l =>
    (l.title + ' ' + (l.cs_topic || '') + ' ' + (l.cs_standard || '')).toLowerCase().includes(state.lessonSearch.toLowerCase())
  );

  return (
    <div>
      <div className="page-title">Plan a Lesson</div>
      <div className="page-subtitle">Choose a lesson, learner profile, and sources, then generate an adapted plan.</div>

      {/* Stepper pills */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        {STEP_LABELS.map((label, i) => {
          const s = i + 1;
          const pillClass = s === state.currentStep ? 'pill pill-on' : s < state.currentStep ? 'pill pill-done' : 'pill pill-off';
          return (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <span
                className={pillClass}
                onClick={() => { if (s < state.currentStep) dispatch({ type: 'SET_STEP', payload: s }); }}
              >
                {s}. {label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <span style={{ width: 16, height: 1, background: 'rgba(0,0,0,0.12)', display: 'inline-block', verticalAlign: 'middle', marginLeft: 4, marginRight: 4 }} />
              )}
            </span>
          );
        })}
      </div>

      {/* Step 1: Select lesson */}
      <div className={`step-wrap${state.currentStep === 1 ? ' active' : ''}`}>
        <div style={{ fontSize: 16, fontWeight: 500 }}>Step 1: Select a base lesson</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', margin: '4px 0 14px' }}>Choose an existing CS lesson to adapt for your students.</div>
        <input
          type="search"
          placeholder="Search lessons..."
          value={state.lessonSearch}
          onChange={e => dispatch({ type: 'SET_LESSON_SEARCH', payload: e.target.value })}
          style={{ marginBottom: 12 }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {filteredLessons.length === 0 && state.lessons.length === 0 && (
            <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--text3)' }}>Loading lessons…</div>
          )}
          {filteredLessons.map(l => (
            <div
              key={l.lesson_id}
              className={`card${state.selectedLessonId === l.lesson_id ? ' selected' : ''}`}
              onClick={() => dispatch({ type: 'SELECT_LESSON', payload: l.lesson_id })}
            >
              <div style={{ fontSize: 13, fontWeight: 500 }}>{l.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', margin: '4px 0' }}>
                {l.grade_level || ''} · {l.cs_topic || ''}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                CS standard: {l.cs_standard || '—'}
                {l.subject && <span className={`badge ${pickBadge(l.subject)}`} style={{ marginLeft: 6 }}>{l.subject}</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn-primary"
            disabled={!state.selectedLessonId}
            onClick={() => dispatch({ type: 'SET_STEP', payload: 2 })}
          >
            Next: choose profile →
          </button>
        </div>
      </div>

      {/* Step 2: Pick cluster */}
      <div className={`step-wrap${state.currentStep === 2 ? ' active' : ''}`}>
        <div style={{ fontSize: 16, fontWeight: 500 }}>Step 2: Pick the learner profile</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', margin: '4px 0 14px' }}>
          Choose the group of students you are planning for today.
        </div>
        {(state.clusters || []).map(c => (
          <div
            key={c.cluster_id}
            className={`check-row${state.selectedClusterId === c.cluster_id ? ' checked' : ''}`}
            onClick={() => handleSelectCluster(c.cluster_id)}
          >
            <div className="cbox">{state.selectedClusterId === c.cluster_id ? '✓' : ''}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{c.cluster_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                {c.student_count} student{c.student_count === 1 ? '' : 's'} · {c.cluster_description || ''}
              </div>
            </div>
            <span className={`badge ${pickBadge(c.cluster_name)}`}>{c.kb_count} KB IDs</span>
          </div>
        ))}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn" onClick={() => dispatch({ type: 'SET_STEP', payload: 1 })}>← Back</button>
          <button
            className="btn-primary"
            disabled={!state.selectedClusterId}
            onClick={() => dispatch({ type: 'SET_STEP', payload: 3 })}
          >
            Next: knowledge bases →
          </button>
        </div>
      </div>

      {/* Step 3: Review KB sources */}
      <div className={`step-wrap${state.currentStep === 3 ? ' active' : ''}`}>
        <div style={{ fontSize: 16, fontWeight: 500 }}>Step 3: Review RAG sources</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', margin: '4px 0 14px' }}>
          These KB IDs are linked to the learner profile. Adjust the source set before generating.
        </div>
        {state.kbsForCluster.length === 0 && !state.selectedClusterId && (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Select a learner profile in Step 2 first.</div>
        )}
        {(() => {
          const groups = {};
          state.kbsForCluster.forEach(k => (groups[k.category || 'Other'] ||= []).push(k));
          return Object.entries(groups).map(([cat, items]) => (
            <div key={cat}>
              <div className="section-label" style={{ marginTop: 8 }}>{cat}</div>
              {items.map(k => (
                <div
                  key={k.kb_id}
                  className={`mini-check${state.selectedKbIds.has(k.kb_id) ? ' checked' : ''}`}
                  onClick={() => dispatch({ type: 'TOGGLE_KB', payload: k.kb_id })}
                >
                  <input type="checkbox" checked={state.selectedKbIds.has(k.kb_id)} readOnly />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{k.kb_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>{k.description || ''}</div>
                  </div>
                </div>
              ))}
            </div>
          ));
        })()}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn" onClick={() => dispatch({ type: 'SET_STEP', payload: 2 })}>← Back</button>
          <button className="btn-primary" onClick={() => { dispatch({ type: 'SET_STEP', payload: 4 }); handleGeneration(); }}>
            Generate lesson draft →
          </button>
        </div>
      </div>

      {/* Step 4: Generation */}
      <div className={`step-wrap${state.currentStep === 4 ? ' active' : ''}`}>
        <div style={{ fontSize: 16, fontWeight: 500 }}>Generating…</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', margin: '4px 0 14px' }}>
          Retrieving RAG context and drafting a teacher-reviewed plan.
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${state.progress}%` }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{state.progressLabel}</div>
        {state.error && (
          <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 14, background: '#fef2f2', padding: 12, borderRadius: 8 }}>
            {state.error}
            <br /><br />
            If you haven&apos;t set an LLM key yet, <a href="/settings" style={{ color: 'var(--accent)' }}>go to Settings</a>.
          </div>
        )}
      </div>
    </div>
  );
}