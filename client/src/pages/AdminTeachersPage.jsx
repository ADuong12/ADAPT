import { useState, useEffect, useContext } from 'react';
import { useApi } from '../api/useApi';
import { AuthContext } from '../auth/AuthContext';

export default function AdminTeachersPage() {
  const api = useApi();
  const { user } = useContext(AuthContext);
  const [teachers, setTeachers] = useState([]);
  const [error, setError] = useState(null);
  const institutionId = user?.institutionId;

  useEffect(() => {
    if (!institutionId) return;
    api.get(`/institutions/${institutionId}/teachers`)
      .then(setTeachers)
      .catch((e) => setError(e.message));
  }, [institutionId]);

  if (error) return <div className="page-subtitle">{error}</div>;
  if (!teachers.length) return <div className="page-subtitle">Loading…</div>;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div className="page-title">Teachers</div>
          <div className="page-subtitle">{teachers.length} teachers</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {teachers.map((t) => {
          const initials = ((t.first_name?.[0] || '') + (t.last_name?.[0] || '')).toUpperCase();
          const roleBadge = t.role === 'admin' ? 'badge-purple' : 'badge-info';
          return (
            <div className="card" key={t.teacher_id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div className="avatar" style={t.role === 'admin' ? { background: 'var(--purple-bg)', color: 'var(--purple-text)' } : {}}>
                  {initials}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{t.first_name} {t.last_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{t.email}</div>
                </div>
                <span className={`badge ${roleBadge}`} style={{ marginLeft: 'auto' }}>
                  {t.role === 'admin' ? 'Admin' : 'Teacher'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <div style={{ background: 'var(--surface2)', padding: 8, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 500 }}>{t.class_count || 0}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>Classes</div>
                </div>
                <div style={{ background: 'var(--surface2)', padding: 8, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 500 }}>{t.student_count || 0}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>Students</div>
                </div>
                <div style={{ background: 'var(--surface2)', padding: 8, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 500 }}>{t.adaptation_count || 0}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>Adaptations</div>
                </div>
              </div>
              {t.classes && t.classes.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>
                  Classes: {t.classes.map((c) => c.class_name || c).join(', ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}