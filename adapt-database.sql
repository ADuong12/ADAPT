-- ============================================================
-- ADAPT: AI-Driven Personalized Lesson Planning Tool
-- Database Schema + Sample Data + Demo Queries
-- ENEB 453 · Database Deliverable (v2 - Institution Support)
-- ============================================================

-- ============================================================
-- PART 1: CREATE TABLES (Normalized to 3NF)
-- ============================================================

-- Institution/School table (NEW - supports multi-tenant admin views)
CREATE TABLE IF NOT EXISTS institution (
    institution_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) DEFAULT 'Elementary', -- Elementary, Middle, High, K-8, K-12
    address TEXT,
    district VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teacher (
    teacher_id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    institution_id INTEGER,
    role VARCHAR(30) DEFAULT 'teacher', -- teacher, admin
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institution(institution_id)
);

CREATE TABLE IF NOT EXISTS class (
    class_id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    grade_band VARCHAR(20),
    subject VARCHAR(50),
    school_year INTEGER,
    FOREIGN KEY (teacher_id) REFERENCES teacher(teacher_id)
);

CREATE TABLE IF NOT EXISTS student_cluster (
    cluster_id INTEGER PRIMARY KEY AUTOINCREMENT,
    cluster_name VARCHAR(100) NOT NULL,
    cluster_description TEXT
);

CREATE TABLE IF NOT EXISTS student (
    student_id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    cluster_id INTEGER,
    math_performance VARCHAR(20),
    ela_performance VARCHAR(20),
    learner_variability TEXT,
    FOREIGN KEY (cluster_id) REFERENCES student_cluster(cluster_id)
);

CREATE TABLE IF NOT EXISTS enrollment (
    enrollment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    enrolled_date DATE DEFAULT CURRENT_DATE,
    FOREIGN KEY (class_id) REFERENCES class(class_id),
    FOREIGN KEY (student_id) REFERENCES student(student_id),
    UNIQUE(class_id, student_id)
);

CREATE TABLE IF NOT EXISTS knowledge_base (
    kb_id INTEGER PRIMARY KEY AUTOINCREMENT,
    kb_name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    source_url VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS cluster_kb (
    cluster_kb_id INTEGER PRIMARY KEY AUTOINCREMENT,
    cluster_id INTEGER NOT NULL,
    kb_id INTEGER NOT NULL,
    FOREIGN KEY (cluster_id) REFERENCES student_cluster(cluster_id),
    FOREIGN KEY (kb_id) REFERENCES knowledge_base(kb_id),
    UNIQUE(cluster_id, kb_id)
);

CREATE TABLE IF NOT EXISTS lesson (
    lesson_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    grade_level VARCHAR(20),
    cs_topic VARCHAR(100),
    cs_standard VARCHAR(30),
    objectives TEXT
);

CREATE TABLE IF NOT EXISTS adapted_lesson (
    adapted_id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,
    cluster_id INTEGER NOT NULL,
    recommendations TEXT,
    adapted_plan TEXT,
    companion_materials TEXT,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lesson_id) REFERENCES lesson(lesson_id),
    FOREIGN KEY (teacher_id) REFERENCES teacher(teacher_id),
    FOREIGN KEY (cluster_id) REFERENCES student_cluster(cluster_id)
);

CREATE TABLE IF NOT EXISTS lesson_kb_used (
    lesson_kb_id INTEGER PRIMARY KEY AUTOINCREMENT,
    adapted_id INTEGER NOT NULL,
    kb_id INTEGER NOT NULL,
    FOREIGN KEY (adapted_id) REFERENCES adapted_lesson(adapted_id),
    FOREIGN KEY (kb_id) REFERENCES knowledge_base(kb_id),
    UNIQUE(adapted_id, kb_id)
);

-- Production enhancement tables
CREATE TABLE IF NOT EXISTS file_storage (
    file_id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name VARCHAR(255),
    file_path VARCHAR(500),
    file_type VARCHAR(50),
    uploaded_by INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES teacher(teacher_id)
);

CREATE TABLE IF NOT EXISTS lesson_file (
    lesson_file_id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER,
    file_type VARCHAR(20),
    file_path VARCHAR(500),
    FOREIGN KEY (lesson_id) REFERENCES lesson(lesson_id)
);

CREATE TABLE IF NOT EXISTS adaptation_feedback (
    feedback_id INTEGER PRIMARY KEY AUTOINCREMENT,
    adapted_id INTEGER,
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (adapted_id) REFERENCES adapted_lesson(adapted_id)
);

-- RAG context tracking (NEW - for context-aware RAG optimization)
CREATE TABLE IF NOT EXISTS rag_context_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    adapted_id INTEGER,
    kb_chunks_used TEXT,
    token_count INTEGER,
    context_layers TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (adapted_id) REFERENCES adapted_lesson(adapted_id)
);

-- ============================================================
-- Pivot tables (2026-04-28): versioned plans + per-teacher LLM key
-- ============================================================

-- Every Generate or Refine call creates a new immutable row. Versions form a
-- linear chain via parent_version_id; rollback flips is_head without deleting.
CREATE TABLE IF NOT EXISTS lesson_plan_version (
    version_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    adapted_id          INTEGER NOT NULL,
    parent_version_id   INTEGER,
    version_number      INTEGER NOT NULL,
    is_head             INTEGER NOT NULL DEFAULT 0,
    instruction         TEXT,
    rendered_html       TEXT NOT NULL,
    plan_json           TEXT,
    model_used          VARCHAR(80),
    provider            VARCHAR(40),
    token_count         INTEGER,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (adapted_id)        REFERENCES adapted_lesson(adapted_id),
    FOREIGN KEY (parent_version_id) REFERENCES lesson_plan_version(version_id),
    UNIQUE(adapted_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_lpv_adapted ON lesson_plan_version(adapted_id);
CREATE INDEX IF NOT EXISTS idx_lpv_head    ON lesson_plan_version(adapted_id, is_head);

-- BYO LLM provider config per teacher. api_key_encrypted holds a Fernet token.
CREATE TABLE IF NOT EXISTS llm_provider_config (
    config_id           INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id          INTEGER NOT NULL,
    provider            VARCHAR(40) NOT NULL,
    model               VARCHAR(80),
    api_key_encrypted   TEXT NOT NULL,
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teacher(teacher_id),
    UNIQUE(teacher_id, provider)
);


-- ============================================================
-- PART 2: POPULATE WITH SAMPLE DATA
-- ============================================================

-- Institutions (NEW)
INSERT INTO institution (name, type, district) VALUES
    ('Lincoln Elementary', 'Elementary', 'Springfield District'),
    ('Riverside Academy', 'K-8', 'Riverside District'),
    ('Maplewood K-8', 'K-8', 'Maplewood District');

-- Teachers (updated with institution_id and role)
INSERT INTO teacher (first_name, last_name, email, institution_id, role) VALUES
    ('Maria', 'Hernandez', 'mhernandez@lincoln.edu', 1, 'teacher'),
    ('James', 'Walker', 'jwalker@riverside.edu', 2, 'teacher'),
    ('Priya', 'Sharma', 'psharma@maplewood.edu', 3, 'teacher'),
    ('Robert', 'Chen', 'rchen@lincoln.edu', 1, 'admin');

-- Student Clusters (from ADAPT project spreadsheet)
INSERT INTO student_cluster (cluster_name, cluster_description) VALUES
    ('Below Grade', 'Students read at a 1st grade level or below'),
    ('On Grade', 'Students read at a 2nd grade level'),
    ('Above Grade', 'Students read at a 3rd grade level or above'),
    ('Native Spanish Speaker', 'Students have been in the country for less than a year and speak Spanish as L1'),
    ('Attention Issues', 'Student is hyperactive, impulsive, struggles to sit still, has trouble focusing'),
    ('Indigenous Student', 'Student comes from a proud heritage as a Native American'),
    ('Urban Cluster', 'Black, low-SES, on grade level');

-- Students
INSERT INTO student (first_name, last_name, cluster_id, math_performance, ela_performance, learner_variability) VALUES
    ('John', 'Jones', 1, 'Below', 'Below', 'Needs visual supports and scaffolding'),
    ('Sally', 'Smith', 3, 'Above', 'Above', 'Ready for extension activities'),
    ('Maria', 'Rodriguez', 4, 'On Grade', 'Below', 'Spanish L1, needs bilingual support'),
    ('Jayden', 'Williams', 7, 'On Grade', 'On Grade', 'Responds well to culturally relevant content'),
    ('Dakota', 'Crow Feather', 6, 'On Grade', 'On Grade', 'Values connection to heritage and land'),
    ('Liam', 'Chen', 2, 'Above', 'On Grade', 'Typical learner, benefits from standard UDL'),
    ('Aiden', 'Murphy', 5, 'Below', 'On Grade', 'ADHD diagnosis, needs movement breaks'),
    ('Sofia', 'Gutierrez', 4, 'On Grade', 'Below', 'Spanish L1, arrived 6 months ago'),
    ('Emma', 'Taylor', 2, 'On Grade', 'On Grade', 'Consistent performer'),
    ('Noah', 'Jackson', 7, 'On Grade', 'Below', 'Urban background, benefits from real-world contexts'),
    ('Olivia', 'Brown', 3, 'Above', 'Above', 'Gifted program candidate'),
    ('Mason', 'Davis', 5, 'Below', 'Below', 'IEP for attention and processing speed');

-- Classes
INSERT INTO class (teacher_id, class_name, grade_band, subject, school_year) VALUES
    (1, '2nd Grade CS - Section A', 'K-2', 'Computer Science', 2026),
    (1, '2nd Grade CS - Section B', 'K-2', 'Computer Science', 2026),
    (2, '4th Grade CS', '3-5', 'Computer Science', 2026),
    (3, '1st Grade CS', 'K-2', 'Computer Science', 2026);

-- Enrollments
INSERT INTO enrollment (class_id, student_id) VALUES
    (1,1),(1,2),(1,3),(1,4),(1,5),(1,6),
    (2,7),(2,8),(2,9),(2,10),(2,11),(2,12);

-- Knowledge Bases (from ADAPT project spreadsheet)
INSERT INTO knowledge_base (kb_name, category, description, source_url) VALUES
    ('UDL (General)', 'Personalization', 'Universal Design for Learning in general', 'https://udlguidelines.cast.org/'),
    ('UDL (CS)', 'Personalization', 'Universal Design for Learning in CS', 'https://udl4cs.education.ufl.edu/'),
    ('CRP', 'Personalization', 'Culturally Responsive Pedagogy', 'https://culturallyresponsive.org/'),
    ('MLL', 'Personalization', 'Multilingual Learners strategies', 'https://wida.wisc.edu/'),
    ('IEP', 'Personalization', 'Individualized Education Program strategies', 'https://www.ablespace.io/'),
    ('SEL', 'Personalization', 'Social Emotional Learning (CASEL)', 'https://casel.org/'),
    ('Neurodiversity', 'Personalization', 'Neurodiversity-affirming instruction', 'https://transitionabilities.com/'),
    ('Scaffolding', 'Pedagogy', 'Prompting Ladder for scaffolded support', 'https://csteachers.org/'),
    ('Academic Readiness', 'Pedagogy', 'Depth of Knowledge (DOK)', 'https://www.edutopia.org/'),
    ('Tiering Lessons', 'Pedagogy', 'How to tier your lessons', 'https://theowlteacher.com/'),
    ('Differentiation', 'Pedagogy', 'Differentiation Rubrics', 'https://www.understood.org/'),
    ('CS Pedagogy', 'Pedagogy', 'Big Book of CS Pedagogy', 'https://www.raspberrypi.org/'),
    ('CS Content', 'Pedagogy', 'Big Book of CS Content', 'https://www.raspberrypi.org/'),
    ('Danielson', 'Pedagogy', 'Framework for Teaching', 'https://danielsongroup.org/'),
    ('AI-TPACK', 'Pedagogy', 'Technology Pedagogy and Content Knowledge for AI', 'https://www.mdpi.com/'),
    ('SAMR', 'Pedagogy', 'Substitution Augmentation Modification Redefinition', 'https://en.wikiversity.org/');

-- Cluster <-> Knowledge Base mappings (from Vectors sheet)
INSERT INTO cluster_kb (cluster_id, kb_id) VALUES
    (1,1),(1,2),(1,9),(1,10),     -- Below Grade -> UDL General, UDL CS, Academic Readiness, Tiering
    (2,1),(2,2),                   -- On Grade -> UDL General, UDL CS
    (3,1),(3,2),(3,9),(3,10),     -- Above Grade -> UDL General, UDL CS, Academic Readiness, Tiering
    (4,1),(4,2),(4,4),(4,3),      -- Spanish MLL -> UDL General, UDL CS, MLL, CRP
    (5,1),(5,2),(5,5),(5,7),      -- Attention -> UDL General, UDL CS, IEP, Neurodiversity
    (6,1),(6,2),(6,3),            -- Indigenous -> UDL General, UDL CS, CRP
    (7,1),(7,2),(7,3);            -- Urban -> UDL General, UDL CS, CRP

-- Lessons (from sample lessons in ADAPT project)
INSERT INTO lesson (title, grade_level, cs_topic, cs_standard, objectives) VALUES
    ('Agent Lion: ScratchJr', 'K-2', 'Sequencing & Algorithms', '1A-AP-10',
     'Students create a ScratchJr animation of the Agent Lion story using sequencing and algorithmic thinking'),
    ('Acorn Was a Little Wild', 'K-1', 'Algorithms with BeeBots', '1A-AP-08',
     'Students program BeeBots to navigate a grid representing the Acorn story'),
    ('Sharing Culture: Algorithms', '2-3', 'Algorithms', '1A-AP-11',
     'Students explore algorithms through culturally relevant sharing activities');

-- Adapted Lessons (AI-generated outputs)
INSERT INTO adapted_lesson (lesson_id, teacher_id, cluster_id, recommendations, adapted_plan, companion_materials) VALUES
    (1, 1, 4,
     'Use bilingual word banks for CS vocabulary. Provide visual step-by-step guides with Spanish labels. Include home culture connections through storytelling.',
     'Modified Agent Lion lesson with Spanish language scaffolds, visual supports, and paired programming with bilingual peers.',
     'Bilingual CS vocabulary cards, graphic organizer for story sequencing, parent letter in Spanish'),
    (1, 1, 1,
     'Provide graphic organizers for sequencing. Use UDL checkpoint 3.3 for scaffolded practice. Tier activities to DOK Level 1-2.',
     'Simplified Agent Lion lesson with pre-taught vocabulary, guided practice with visual models, and reduced complexity ScratchJr blocks.',
     'Picture-based sequencing cards, simplified ScratchJr block reference sheet, progress monitoring checklist'),
    (2, 1, 5,
     'Include movement breaks every 10 minutes. Use fidget-friendly materials during instruction. Provide clear visual timers.',
     'Acorn BeeBots lesson with built-in movement stations, chunked instructions, and choice-based extension activities.',
     'Visual timer cards, movement break activity cards, self-regulation check-in sheet'),
    (3, 2, 6,
     'Connect algorithm concepts to traditional practices like beadwork patterns. Include indigenous perspectives on problem-solving.',
     'Sharing Culture lesson adapted with indigenous storytelling traditions, nature-based algorithm examples, and community sharing protocols.',
     'Cultural algorithm examples poster, nature pattern worksheets, community sharing reflection journal');

-- Track which KBs were used per adapted lesson
INSERT INTO lesson_kb_used (adapted_id, kb_id) VALUES
    (1,1),(1,2),(1,3),(1,4),      -- Spanish adaptation: UDL General, UDL CS, CRP, MLL
    (2,1),(2,2),(2,9),(2,10),     -- Below grade: UDL General, UDL CS, Academic Readiness, Tiering
    (3,1),(3,2),(3,5),(3,7),      -- Attention: UDL General, UDL CS, IEP, Neurodiversity
    (4,1),(4,2),(4,3);            -- Indigenous: UDL General, UDL CS, CRP


-- ============================================================
-- PART 3: DEMO QUERIES
-- ============================================================

-- QUERY 1: Teacher's class roster with student clusters (4-table JOIN)
SELECT s.first_name || ' ' || s.last_name AS student_name,
       sc.cluster_name,
       s.ela_performance,
       s.math_performance,
       cl.class_name
FROM student s
JOIN enrollment e ON s.student_id = e.student_id
JOIN class cl ON e.class_id = cl.class_id
JOIN student_cluster sc ON s.cluster_id = sc.cluster_id
WHERE cl.teacher_id = 1
ORDER BY cl.class_name, sc.cluster_name;


-- QUERY 2: Students per cluster (GROUP BY + COUNT + GROUP_CONCAT)
SELECT sc.cluster_name,
       COUNT(s.student_id) AS student_count,
       GROUP_CONCAT(s.first_name, ', ') AS students
FROM student_cluster sc
LEFT JOIN student s ON sc.cluster_id = s.cluster_id
GROUP BY sc.cluster_id
ORDER BY student_count DESC;


-- QUERY 3: Knowledge bases per cluster (Many-to-Many JOIN)
SELECT sc.cluster_name,
       GROUP_CONCAT(kb.kb_name, ', ') AS knowledge_bases,
       COUNT(kb.kb_id) AS kb_count
FROM student_cluster sc
JOIN cluster_kb ckb ON sc.cluster_id = ckb.cluster_id
JOIN knowledge_base kb ON ckb.kb_id = kb.kb_id
GROUP BY sc.cluster_id
ORDER BY kb_count DESC;


-- QUERY 4: All adapted lessons with full context (Multi-table JOIN)
SELECT l.title AS base_lesson,
       t.last_name AS teacher,
       sc.cluster_name AS target_cluster,
       al.recommendations,
       al.generated_at
FROM adapted_lesson al
JOIN lesson l ON al.lesson_id = l.lesson_id
JOIN teacher t ON al.teacher_id = t.teacher_id
JOIN student_cluster sc ON al.cluster_id = sc.cluster_id
ORDER BY al.generated_at DESC;


-- QUERY 5: Most frequently cited knowledge bases (Aggregation)
SELECT kb.kb_name,
       kb.category,
       COUNT(lku.adapted_id) AS times_cited
FROM knowledge_base kb
JOIN lesson_kb_used lku ON kb.kb_id = lku.kb_id
GROUP BY kb.kb_id
ORDER BY times_cited DESC
LIMIT 8;


-- QUERY 6: Students in clusters with 4+ knowledge bases (Subquery)
SELECT s.first_name || ' ' || s.last_name AS student_name,
       sc.cluster_name,
       (SELECT COUNT(*) FROM cluster_kb ckb
        WHERE ckb.cluster_id = sc.cluster_id) AS available_kbs
FROM student s
JOIN student_cluster sc ON s.cluster_id = sc.cluster_id
WHERE sc.cluster_id IN (
    SELECT cluster_id FROM cluster_kb
    GROUP BY cluster_id
    HAVING COUNT(kb_id) >= 4
)
ORDER BY available_kbs DESC;

-- ============================================================
-- NEW ADMIN-LEVEL QUERIES (Institution-aware)
-- ============================================================

-- QUERY 7: Institution overview - all teachers with class/student counts
SELECT i.name AS institution_name,
       t.first_name || ' ' || t.last_name AS teacher_name,
       COUNT(DISTINCT cl.class_id) AS class_count,
       COUNT(DISTINCT e.student_id) AS student_count
FROM institution i
JOIN teacher t ON i.institution_id = t.institution_id
LEFT JOIN class cl ON t.teacher_id = cl.teacher_id
LEFT JOIN enrollment e ON cl.class_id = e.class_id
WHERE i.institution_id = 1
GROUP BY t.teacher_id
ORDER BY teacher_name;

-- QUERY 8: Institution-wide adaptation metrics
SELECT i.name AS institution_name,
       COUNT(DISTINCT al.adapted_id) AS total_adaptations,
       COUNT(DISTINCT t.teacher_id) AS active_teachers,
       COUNT(DISTINCT l.lesson_id) AS lessons_used
FROM institution i
JOIN teacher t ON i.institution_id = t.institution_id
JOIN adapted_lesson al ON t.teacher_id = al.teacher_id
JOIN lesson l ON al.lesson_id = l.lesson_id
WHERE i.institution_id = 1
GROUP BY i.institution_id;

-- QUERY 9: Class roster with institution context (5-table JOIN)
SELECT i.name AS institution,
       t.first_name || ' ' || t.last_name AS teacher,
       cl.class_name,
       s.first_name || ' ' || s.last_name AS student,
       sc.cluster_name
FROM student s
JOIN enrollment e ON s.student_id = e.student_id
JOIN class cl ON e.class_id = cl.class_id
JOIN teacher t ON cl.teacher_id = t.teacher_id
JOIN institution i ON t.institution_id = i.institution_id
JOIN student_cluster sc ON s.cluster_id = sc.cluster_id
ORDER BY i.name, teacher, cl.class_name;

-- QUERY 10: Cluster distribution across institution
SELECT i.name AS institution,
       sc.cluster_name,
       COUNT(DISTINCT s.student_id) AS student_count,
       COUNT(DISTINCT cl.class_id) AS classes_affected
FROM institution i
JOIN teacher t ON i.institution_id = t.institution_id
JOIN class cl ON t.teacher_id = cl.teacher_id
JOIN enrollment e ON cl.class_id = e.class_id
JOIN student s ON e.student_id = s.student_id
JOIN student_cluster sc ON s.cluster_id = sc.cluster_id
WHERE i.institution_id = 1
GROUP BY sc.cluster_id
ORDER BY student_count DESC;
