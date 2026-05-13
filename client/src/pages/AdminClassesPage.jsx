import { useState, useEffect, useContext } from 'react';
import { useApi } from '../api/useApi';
import { AuthContext } from '../auth/AuthContext';

const badgeColors = ['badge-info', 'badge-success', 'badge-warn', 'badge-purple'];
function pickBadge(text) {
  if (!text) return 'badge-info';
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return badgeColors[Math.abs(h) % badgeColors.length];
}

export default function AdminClassesPage() {
  const api = useApi();
  const { user } = useContext(AuthContext);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState(null);
  const institutionId = user?.institutionId;

  useEffect(() => {
    if (!institutionId) return;
    api.get(`/api/institutions/${institutionId}/classes`)
      .then(setClasses)
      .catch((e) => setError(e.message));
  }, [institutionId]);

  if (error) return <div className="page-subtitle">{error}</div>;
  if (!classes.length) return <div className="page-subtitle">Loading…</div>;

  const totalStudents = classes.reduce((n, c) => n + (c.student_count || 0), 0);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div className="page-title">Classes</div>
          <div className="page-subtitle">{classes.length} classes · {totalStudents} students total</div>
        </div>
      </div>

      <div className="section-label">All classes</div>
      {classes.map((c) => (
        <div className="card" key={c.class_id}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{c.class_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                {c.teacher_name || ''} · {c.grade_band || ''} · {c.subject || ''} · {c.year || ''}
              </div>
            </div>
            <span className="badge badge-info">{c.student_count || 0} students</span>
          </div>
          {c.clusters && c.clusters.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Student clusters:</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                {c.clusters.map((cl) => (
                  <span key={typeof cl === 'string' ? cl : cl.cluster_name} className={`badge ${pickBadge(typeof cl === 'string' ? cl : cl.cluster_name)}`}>
                    {typeof cl === 'string' ? cl : cl.cluster_name}
                  </span>
                ))}
              </div>
            </>
          )}
          {c.students && c.students.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Students:</div>
              <div style={{ fontSize: 12 }}>
                {c.students.map((s) => `${s.first_name} ${s.last_name}`).join(', ')}
              </div>
            </>
          )}
        </div>
      ))}
    </>
  );
}