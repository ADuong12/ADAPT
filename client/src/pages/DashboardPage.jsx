import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router';
import { AuthContext } from '../auth/AuthContext';
import { useApi } from '../api/useApi';

const badgeColors = ['badge-info', 'badge-success', 'badge-warn', 'badge-purple'];

function pickBadge(text) {
  if (!text) return 'badge-info';
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return badgeColors[Math.abs(h) % badgeColors.length];
}

function metric(label, value) {
  return { label, value };
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const { user } = useContext(AuthContext);
  const api = useApi();

  useEffect(() => {
    if (!user?.teacherId) return;
    api.get('/api/teachers/' + user.teacherId + '/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
  }, [user?.teacherId]);

  if (error) return <div className="page-subtitle">{error}</div>;
  if (!data) return <div className="page-subtitle">Loading…</div>;

  const teacher = data.teacher || {};
  const inst = data.institution ? data.institution.name : 'Independent';
  const m = data.metrics || {};

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div>
          <div className="page-title">Welcome back, {teacher.first_name} {teacher.last_name}</div>
          <div className="page-subtitle">
            {inst} — {m.classes || 0} class{m.classes === 1 ? '' : 'es'} — {m.students || 0} students — {m.clusters || 0} learner profiles
          </div>
        </div>
        <Link to="/personalize" className="btn-primary">Plan a Lesson</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {[
          metric('Learner profiles', m.clusters || 0),
          metric('Lesson drafts', m.adaptations || 0),
          metric('Knowledge bases', m.knowledge_bases || 0),
          metric('Students', m.students || 0),
        ].map((m) => (
          <div className="metric" key={m.label}>
            <div className="label">{m.label}</div>
            <div className="value">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="section-label">Recent lesson drafts</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
        {data.recent_adaptations && data.recent_adaptations.length > 0 ? (
          data.recent_adaptations.map((r) => (
            <Link to={'/workspace/' + r.adapted_id} key={r.adapted_id} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{r.lesson_title}</div>
                <span className="badge badge-info">v{r.head_version_number}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', margin: '4px 0' }}>
                {r.grade_level || ''}{r.cs_topic ? ' · ' + r.cs_topic : ''}
              </div>
              <span className={`badge ${pickBadge(r.cluster_name)}`}>{r.cluster_name}</span>
            </Link>
          ))
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--text3)', gridColumn: '1 / -1' }}>
            No lesson drafts yet. <Link to="/personalize" style={{ color: 'var(--accent-text)' }}>Create your first one →</Link>
          </div>
        )}
      </div>

      <div className="section-label">Students and support profiles</div>
      <div>
        {data.roster && data.roster.map((s) => {
          const initials = s.student_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
          const badge = s.cluster_name
            ? <span className={`badge ${pickBadge(s.cluster_name)}`}>{s.cluster_name}</span>
            : null;
          return (
            <div className="roster-row" key={s.student_id || s.student_name}>
              <div className="avatar">{initials}</div>
              <div style={{ flex: 1 }}>{s.student_name}</div>
              {badge}
            </div>
          );
        })}
      </div>
    </>
  );
}