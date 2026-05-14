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

export default function AdminDashboardPage() {
  const api = useApi();
  const { user } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const institutionId = user?.institutionId;

  useEffect(() => {
    if (!institutionId) return;
    api.get(`/institutions/${institutionId}/overview`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [institutionId]);

  if (error) return <div className="page-subtitle">{error}</div>;
  if (!data) return <div className="page-subtitle">Loading…</div>;

  const { institution, teachers, classes, clusters } = data;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div className="page-title">{institution?.name || 'Admin Overview'}</div>
          <div className="page-subtitle">
            {institution?.district || ''} · {teachers?.length || 0} teachers · {classes?.length || 0} classes · {institution?.student_count || 0} students
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        <div className="metric"><div className="label">Teachers</div><div className="value">{teachers?.length || 0}</div></div>
        <div className="metric"><div className="label">Classes</div><div className="value">{classes?.length || 0}</div></div>
        <div className="metric"><div className="label">Students</div><div className="value">{institution?.student_count || 0}</div></div>
        <div className="metric"><div className="label">Adaptations</div><div className="value">{institution?.adaptation_count || 0}</div></div>
      </div>

      <div className="section-label">Teachers at this institution</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Teacher</th>
              <th>Email</th>
              <th>Classes</th>
              <th>Students</th>
              <th>Adaptations</th>
            </tr>
          </thead>
          <tbody>
            {(teachers || []).map((t) => {
              const initials = ((t.first_name?.[0] || '') + (t.last_name?.[0] || '')).toUpperCase();
              return (
                <tr key={t.teacher_id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar">{initials}</div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{t.first_name} {t.last_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t.specialty || ''}</div>
                      </div>
                    </div>
                  </td>
                  <td>{t.email}</td>
                  <td><span className="badge badge-info">{t.class_count || 0} classes</span></td>
                  <td>{t.student_count || 0} students</td>
                  <td><span className="badge badge-success">{t.adaptation_count || 0} adaptations</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="section-label">Class overview</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Class</th>
              <th>Teacher</th>
              <th>Grade Band</th>
              <th>Students</th>
              <th>Top Clusters</th>
            </tr>
          </thead>
          <tbody>
            {(classes || []).map((c) => (
              <tr key={c.class_id}>
                <td style={{ fontWeight: 500 }}>{c.class_name}</td>
                <td>{c.teacher_name || ''}</td>
                <td>{c.grade_band || ''}</td>
                <td>{c.student_count || 0}</td>
                <td>
                  {(c.clusters || []).map((cl) => (
                    <span key={cl} className={`badge ${pickBadge(cl)}`} style={{ marginRight: 4 }}>{cl}</span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {clusters && clusters.length > 0 && (
        <>
          <div className="section-label">Cluster distribution across institution</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {clusters.map((c) => (
              <div className="card" key={c.cluster_name || c.cluster_id}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{c.cluster_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', margin: '4px 0' }}>
                  {c.student_count || 0} students · {c.class_count || 0} classes
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {c.kb_count || 0} KBs available
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}