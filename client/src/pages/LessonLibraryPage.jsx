import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router';
import { useApi, toast } from '../api/useApi';
import { AuthContext } from '../auth/AuthContext';

export default function LessonLibraryPage() {
  const api = useApi();
  const { user } = useContext(AuthContext);
  const [lessons, setLessons] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [sourceFiles, setSourceFiles] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [selectedFile, setSelectedFile] = useState('');
  const [selectedClusterId, setSelectedClusterId] = useState('');
  const [instruction, setInstruction] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editStatus, setEditStatus] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/lessons?page=1&limit=50'),
      api.get('/api/clusters'),
    ])
      .then(([lessonData, clusterList]) => {
        // lessons endpoint returns { lessons, total, page, limit }
        const lessonArr = Array.isArray(lessonData) ? lessonData : (lessonData.lessons || []);
        setLessons(lessonArr);
        setClusters(clusterList);
        if (lessonArr.length > 0) {
          setSelectedLessonId(lessonArr[0].lesson_id);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  // Load source files when lesson selection changes
  useEffect(() => {
    if (!selectedLessonId) return;
    api.get(`/api/file-edits/lessons/${selectedLessonId}/sources`)
      .then((files) => {
        setSourceFiles(files || []);
        if (files && files.length > 0) {
          setSelectedFile(files[0].source_path);
        } else {
          setSelectedFile('');
        }
      })
      .catch((e) => {
        // Source files endpoint may not return data for all lessons
        setSourceFiles([]);
        setSelectedFile('');
      });
  }, [selectedLessonId]);

  const handleChangeLesson = (e) => {
    setSelectedLessonId(Number(e.target.value));
  };

  const handleEditSubmit = async () => {
    if (!selectedLessonId || !selectedFile || !instruction.trim()) {
      toast('Choose a lesson, source file, and instruction first.', 'error');
      return;
    }
    setSubmitting(true);
    setEditStatus('Reading the source file, asking the LLM for edits, and writing a copy.');
    try {
      // Optionally get KB IDs for the selected cluster
      let kbIds = [];
      if (selectedClusterId) {
        const kbs = await api.get(`/api/clusters/${selectedClusterId}/kbs`);
        kbIds = kbs.map((k) => k.kb_id);
      }

      // Use the correct API path: POST /api/file-edits (NOT /api/lessons/:id/edit-source-file)
      const result = await api.post('/api/file-edits', {
        lesson_id: selectedLessonId,
        source_filename: selectedFile,
        instruction: instruction.trim(),
        cluster_id: selectedClusterId ? Number(selectedClusterId) : null,
        kb_ids: kbIds,
      });

      // If the result includes a download URL, download it with auth
      if (result && result.download_url) {
        try {
          const downloadRes = await fetch(`/api${result.download_url}`, {
            headers: { 'Authorization': `Bearer ${user?.token}` },
          });
          if (downloadRes.ok) {
            const blob = await downloadRes.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = result.filename || 'edited-file';
            a.click();
            URL.revokeObjectURL(a.href);
          }
        } catch {}
      }

      setEditStatus(result?.note || 'Edit complete');
      toast('Edited copy downloaded', 'success');
    } catch (e) {
      setEditStatus(e.message);
      toast(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLessons = lessons.filter((l) =>
    [l.title, l.cs_topic, l.cs_standard].join(' ').toLowerCase().includes(search.toLowerCase())
  );

  if (error) return <div className="page-subtitle">{error}</div>;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 16 }}>
        <div>
          <div className="page-title">Lesson Library</div>
          <div className="page-subtitle">{lessons.length} base lessons available</div>
        </div>
        <Link to="/personalize" className="btn-primary">Plan a Lesson</Link>
      </div>

      <div className="library-workspace">
        <div>
          <input
            type="search"
            placeholder="Search by title, topic, or standard..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <div className="section-label">Base lessons</div>
          {filteredLessons.map((l) => (
            <div className="card" key={l.lesson_id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{l.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', margin: '4px 0' }}>
                    {l.grade_level || ''} — {l.cs_topic || ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    CS Standard: {l.cs_standard || '—'}
                  </div>
                </div>
                <Link to={`/personalize?lesson_id=${l.lesson_id}`} className="btn" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Plan</Link>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>{l.objectives || ''}</div>
            </div>
          ))}
        </div>

        <div className="teacher-panel">
          <div className="section-label">AI edit source file</div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Create an edited copy</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
            Choose a Word, PowerPoint, or PDF source file and tell ADAPT what to change. Originals stay untouched; DOCX/PPTX copies keep existing text formatting and hyperlinks where possible.
          </div>

          <div className="form-row">
            <label>Lesson</label>
            <select value={selectedLessonId || ''} onChange={handleChangeLesson}>
              {lessons.map((l) => (
                <option key={l.lesson_id} value={l.lesson_id}>{l.title}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Source file</label>
            <select value={selectedFile} onChange={(e) => setSelectedFile(e.target.value)}>
              {sourceFiles.length === 0 ? (
                <option value="">No DOCX, PPTX, or PDF source files found</option>
              ) : (
                sourceFiles.map((f) => (
                  <option key={f.source_path} value={f.source_path}>
                    {f.filename} ({(f.file_type || 'unknown').toUpperCase()})
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="form-row">
            <label>Learner profile for RAG context</label>
            <select value={selectedClusterId} onChange={(e) => setSelectedClusterId(e.target.value)}>
              <option value="">No profile context</option>
              {clusters.map((c) => (
                <option key={c.cluster_id} value={c.cluster_id}>{c.cluster_name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Teacher instruction</label>
            <textarea
              rows={6}
              placeholder="Example: Translate this lesson into Spanish while keeping teacher directions clear and classroom-ready."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
          </div>
          <button
            className="btn-primary"
            style={{ width: '100%' }}
            disabled={submitting}
            onClick={handleEditSubmit}
          >
            {submitting ? 'Creating copy...' : 'Create Edited Copy'}
          </button>
          {editStatus && (
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 10 }}>{editStatus}</div>
          )}
        </div>
      </div>
    </>
  );
}