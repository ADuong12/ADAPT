import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router';
import { useApi, toast } from '../api/useApi';
import { AuthContext } from '../auth/AuthContext';

const badgeColors = ['badge-info', 'badge-success', 'badge-warn', 'badge-purple'];
function pickBadge(text) {
  if (!text) return 'badge-info';
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return badgeColors[Math.abs(h) % badgeColors.length];
}

export default function MyClassesPage() {
  const api = useApi();
  const { user } = useContext(AuthContext);
  const [classes, setClasses] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState({});

  useEffect(() => {
    if (!user?.teacherId) return;
    Promise.all([
      api.get(`/teachers/${user.teacherId}/classes`),
      api.get('/clusters'),
    ])
      .then(([classData, clusterList]) => {
        setClasses(classData);
        setClusters(clusterList);
      })
      .catch((e) => setError(e.message));
  }, [user?.teacherId]);

  const handleSave = async (studentId, clusterId) => {
    setSaving((prev) => ({ ...prev, [studentId]: true }));
    try {
      await api.patch(`/teachers/${user.teacherId}/students/${studentId}`, {
        cluster_id: clusterId,
      });
      toast('Student support profile updated', 'success');
      // Reload data
      const [classData] = await Promise.all([
        api.get(`/teachers/${user.teacherId}/classes`),
      ]);
      setClasses(classData);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving((prev) => ({ ...prev, [studentId]: false }));
    }
  };

  if (error) return <div className="page-subtitle">{error}</div>;
  if (!classes.length && !error) {
    // Might still be loading
  }

  const totalStudents = classes.reduce((n, c) => n + c.students.length, 0);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 16 }}>
        <div>
          <div className="page-title">My Classes</div>
          <div className="page-subtitle">{classes.length} classes — {totalStudents} students</div>
        </div>
        <Link to="/personalize" className="btn-primary">Plan for a Cluster</Link>
      </div>
      <div className="teacher-note">
        Update a student&apos;s support profile as their needs change. Future lesson plans use the profile&apos;s linked knowledge bases when ADAPT retrieves RAG context.
      </div>
      {classes.map((c) => {
        const activeClusters = new Set(c.students.map((s) => s.cluster_name).filter(Boolean));
        return (
          <div className="class-panel" key={c.class_id}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{c.class_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {c.grade_band || ''} — {c.subject || ''} — {c.students.length} students
                </div>
              </div>
              <span className="badge badge-info">{activeClusters.size} active profiles</span>
            </div>
            <div className="section-label">Roster and support profile</div>
            {c.students.map((s) => {
              const initials = (s.first_name?.[0] || '') + (s.last_name?.[0] || '');
              const badge = s.cluster_name
                ? <span className={`badge ${pickBadge(s.cluster_name)}`}>{s.cluster_name}</span>
                : null;
              const isSaving = saving[s.student_id];
              return (
                <div className="student-edit-row" key={s.student_id}>
                  <div className="avatar">{initials.toUpperCase()}</div>
                  <div className="student-main">
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{s.first_name} {s.last_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>{s.learner_variability || 'No notes yet'}</div>
                  </div>
                  <div style={{ minWidth: 180 }}>{badge}</div>
                  <select
                    className="cluster-select"
                    aria-label={`Support profile for ${s.first_name} ${s.last_name}`}
                    defaultValue={s.cluster_id || ''}
                    onChange={(e) => {
                      // Track local selection for save
                      const select = e.target;
                      const btn = select.parentElement.querySelector('.save-student-btn');
                      if (btn) btn.dataset.changed = 'true';
                    }}
                  >
                    <option value="">— None —</option>
                    {clusters.map((cl) => (
                      <option key={cl.cluster_id} value={cl.cluster_id}>
                        {cl.cluster_name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn save-student-btn"
                    style={{ fontSize: 12 }}
                    disabled={isSaving}
                    onClick={(e) => {
                      const row = e.target.closest('.student-edit-row');
                      const select = row.querySelector('.cluster-select');
                      const newClusterId = Number(select.value);
                      handleSave(s.student_id, newClusterId);
                    }}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}