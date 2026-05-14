const fs = require('fs');
const path = require('path');

// Read ENCRYPTION_KEY from server/.env manually
const envPath = path.resolve(__dirname, '..', 'server', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^(\w+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const db = require(path.resolve(__dirname, '..', 'server', 'src', 'db'));
const { encrypt } = require(path.resolve(__dirname, '..', 'server', 'src', 'services', 'crypto'));

const TEACHER_ID = 4; // rchen

// Prepared statements (better-sqlite3 style)
const insertLesson = db.prepare('INSERT INTO lesson (title, grade_level, cs_topic, cs_standard, objectives) VALUES (?, ?, ?, ?, ?)');
const insertClass = db.prepare('INSERT INTO class (teacher_id, class_name, grade_band, subject, school_year) VALUES (?, ?, ?, ?, ?)');
const insertStudent = db.prepare('INSERT INTO student (first_name, last_name, cluster_id, math_performance, ela_performance, learner_variability) VALUES (?, ?, ?, ?, ?, ?)');
const insertEnrollment = db.prepare('INSERT INTO enrollment (class_id, student_id) VALUES (?, ?)');
const insertAdapted = db.prepare('INSERT INTO adapted_lesson (lesson_id, teacher_id, cluster_id, recommendations, adapted_plan, companion_materials) VALUES (?, ?, ?, ?, ?, ?)');
const insertVersion = db.prepare(`INSERT INTO lesson_plan_version (adapted_id, parent_version_id, version_number, is_head, instruction, rendered_html, plan_json, model_used, provider, token_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertKbUsed = db.prepare('INSERT INTO lesson_kb_used (adapted_id, kb_id) VALUES (?, ?)');
const insertFeedback = db.prepare('INSERT INTO adaptation_feedback (adapted_id, rating, comments) VALUES (?, ?, ?)');
const insertRagLog = db.prepare('INSERT INTO rag_context_log (adapted_id, kb_chunks_used, token_count, context_layers) VALUES (?, ?, ?, ?)');
const insertLlmConfig = db.prepare('INSERT INTO llm_provider_config (teacher_id, provider, model, api_key_encrypted, is_active) VALUES (?, ?, ?, ?, ?)');
const updateAdapted = db.prepare('UPDATE adapted_lesson SET recommendations = ?, adapted_plan = ?, companion_materials = ? WHERE adapted_id = ?');

function seed(db) {
  // ── 1. Lessons ──────────────────────────────────────────────────
  const lessons = [
    { title: 'BeeBots Navigation: Acorn Story', grade: 'K-1', topic: 'Algorithms', standard: '1A-AP-08', objectives: 'Program BeeBots to navigate a grid representing the Acorn story' },
    { title: 'ScratchJr Storytelling: Agent Lion', grade: 'K-2', topic: 'Sequencing & Algorithms', standard: '1A-AP-10', objectives: 'Create a ScratchJr animation telling the Agent Lion story with sequencing and events' },
    { title: 'Sharing Culture Through Code', grade: '2-3', topic: 'Algorithms & Culture', standard: '1A-AP-11', objectives: 'Explore algorithms through culturally relevant sharing activities' },
    { title: 'Looping with Patterns', grade: '2-3', topic: 'Loops', standard: '1A-AP-09', objectives: 'Identify repeating patterns and represent them using loops' },
    { title: 'Debugging Detective', grade: '3-5', topic: 'Debugging', standard: '1A-AP-14', objectives: 'Practice finding and fixing bugs in simple programs' },
    { title: 'Data Detectives: Sorting', grade: '3-5', topic: 'Data', standard: '1A-DA-07', objectives: 'Collect, organize, and visualize data about classmates' },
    { title: 'Robot Helpers: Conditionals', grade: '3-5', topic: 'Conditionals', standard: '1A-AP-12', objectives: 'Design simple conditional rules for robot helpers' },
  ];

  const lessonIds = [];
  for (const l of lessons) {
    const r = insertLesson.run(l.title, l.grade, l.topic, l.standard, l.objectives);
    lessonIds.push(r.lastInsertRowid);
  }
  console.log(`Inserted ${lessonIds.length} new lessons`);

  // ── 2. Classes for rchen ────────────────────────────────────────
  const classes = [
    { name: '3rd Grade CS - Section A', grade: '3-5', subject: 'Computer Science', year: 2026 },
    { name: '3rd Grade CS - Section B', grade: '3-5', subject: 'Computer Science', year: 2026 },
    { name: '4th Grade CS', grade: '3-5', subject: 'Computer Science', year: 2026 },
  ];

  const classIds = [];
  for (const c of classes) {
    const r = insertClass.run(TEACHER_ID, c.name, c.grade, c.subject, c.year);
    classIds.push(r.lastInsertRowid);
  }
  console.log(`Inserted ${classIds.length} classes for rchen`);

  // ── 3. Students ─────────────────────────────────────────────────
  const students = [
    { first: 'Aiden', last: 'Martinez', cluster: 5, math: 'Below', ela: 'On Grade', notes: 'ADHD, benefits from movement breaks and clear visual timers' },
    { first: 'Sofia', last: 'Nguyen', cluster: 4, math: 'On Grade', ela: 'Below', notes: 'Vietnamese L1, arrived 4 months ago, needs bilingual scaffolding' },
    { first: 'Jayden', last: 'Williams', cluster: 7, math: 'On Grade', ela: 'On Grade', notes: 'Responds well to culturally relevant content and real-world connections' },
    { first: 'Dakota', last: 'Black Elk', cluster: 6, math: 'Above', ela: 'On Grade', notes: 'Lakota heritage, values storytelling and land-based learning' },
    { first: 'Emma', last: 'Johnson', cluster: 2, math: 'On Grade', ela: 'On Grade', notes: 'Consistent performer, benefits from peer collaboration' },
    { first: 'Liam', last: 'Chen', cluster: 2, math: 'Above', ela: 'On Grade', notes: 'Bilingual Mandarin-English, quick to grasp abstract concepts' },
    { first: 'Olivia', last: 'Brown', cluster: 3, math: 'Above', ela: 'Above', notes: 'Gifted program candidate, ready for extension activities' },
    { first: 'Noah', last: 'Jackson', cluster: 7, math: 'On Grade', ela: 'Below', notes: 'Urban background, benefits from real-world contexts and mentoring' },
    { first: 'Mia', last: 'Rodriguez', cluster: 4, math: 'Below', ela: 'Below', notes: 'Spanish L1, needs visual supports and home-language bridging' },
    { first: 'Ethan', last: 'Davis', cluster: 1, math: 'Below', ela: 'Below', notes: 'Needs graphic organizers, scaffolded practice, and reduced complexity' },
    { first: 'Isabella', last: 'Taylor', cluster: 3, math: 'Above', ela: 'Above', notes: 'Self-directed learner, enjoys open-ended creative projects' },
    { first: 'Lucas', last: 'Anderson', cluster: 5, math: 'On Grade', ela: 'On Grade', notes: 'Dyslexic, benefits from audio supports and extended time' },
    { first: 'Charlotte', last: 'Thomas', cluster: 1, math: 'Below', ela: 'On Grade', notes: 'Processing speed challenges, benefits from chunked instructions' },
    { first: 'Benjamin', last: 'White', cluster: 2, math: 'On Grade', ela: 'On Grade', notes: 'Typical learner, thrives with hands-on activities' },
    { first: 'Amelia', last: 'Harris', cluster: 6, math: 'On Grade', ela: 'Above', notes: 'Cherokee heritage, interested in cultural representation in tech' },
  ];

  const studentIds = [];
  for (const s of students) {
    const r = insertStudent.run(s.first, s.last, s.cluster, s.math, s.ela, s.notes);
    studentIds.push(r.lastInsertRowid);
  }
  console.log(`Inserted ${studentIds.length} students`);

  // ── 4. Enrollments ──────────────────────────────────────────────
  for (let i = 0; i < 5; i++) insertEnrollment.run(classIds[0], studentIds[i]);
  for (let i = 5; i < 10; i++) insertEnrollment.run(classIds[1], studentIds[i]);
  for (let i = 10; i < 15; i++) insertEnrollment.run(classIds[2], studentIds[i]);
  console.log('Enrolled students');

  // ── 5. Adapted lessons ──────────────────────────────────────────
  const adaptations = [
    { lesson: lessonIds[0], cluster: 4, recs: 'Use bilingual word banks for BeeBot commands. Provide visual step-by-step guides with Spanish labels.', plan: 'Modified BeeBot navigation lesson with Spanish language scaffolds, visual supports, and paired programming with bilingual peers.', materials: 'Bilingual BeeBot command cards, visual direction posters, graphic organizer for navigation sequences' },
    { lesson: lessonIds[0], cluster: 1, recs: 'Provide graphic organizers for sequencing. Use UDL checkpoint 3.3 for scaffolded practice. Tier activities to DOK Level 1-2.', plan: 'Simplified BeeBot lesson with pre-taught vocabulary, guided practice with visual models, and reduced complexity commands.', materials: 'Picture-based sequencing cards, simplified BeeBot command reference, progress monitoring checklist' },
    { lesson: lessonIds[1], cluster: 5, recs: 'Include movement breaks every 10 minutes. Use fidget-friendly materials during instruction. Provide clear visual timers and chunked instructions.', plan: 'Agent Lion ScratchJr lesson with built-in movement stations, chunked instruction slides, and choice-based extension activities.', materials: 'Visual timer cards, movement break activity cards, self-regulation check-in sheet' },
    { lesson: lessonIds[1], cluster: 2, recs: 'Maintain standard pacing with enrichment opportunities. Include peer teaching moments. Provide open-ended creative extensions.', plan: 'Standard Agent Lion ScratchJr lesson with enrichment options including custom character design and peer code review.', materials: 'Advanced ScratchJr block reference, peer review rubric, creative extension menu' },
    { lesson: lessonIds[2], cluster: 6, recs: 'Connect algorithm concepts to traditional practices like beadwork patterns. Include Indigenous perspectives on problem-solving.', plan: 'Sharing Culture lesson adapted with Indigenous storytelling traditions, nature-based algorithm examples, and community sharing protocols.', materials: 'Cultural algorithm examples poster, nature pattern worksheets, community sharing reflection journal' },
    { lesson: lessonIds[2], cluster: 7, recs: 'Frame algorithms through urban navigation and community mapping. Connect to real-world problem-solving in students neighborhoods.', plan: 'Sharing Culture lesson with urban navigation algorithms, community mapping activities, and real-world problem scenarios.', materials: 'Community map templates, urban navigation cards, real-world problem scenario bank' },
    { lesson: lessonIds[3], cluster: 3, recs: 'Challenge students to find complex patterns in music and art. Introduce nested loops and pattern optimization.', plan: 'Advanced looping lesson exploring Fibonacci patterns in nature, musical loops, and art. Students create complex nested loop programs.', materials: 'Pattern exploration journal, Fibonacci in nature gallery, musical loop worksheet' },
    { lesson: lessonIds[4], cluster: 5, recs: 'Use visual debugging checklists. Pair students with peer debuggers. Celebrate the debugging process as problem-solving.', plan: 'Debugging Detective lesson with visual bug-hunting worksheets, paired debugging sessions, and a class bug bash activity.', materials: 'Visual debugging checklist, bug identification cards, paired debugging protocol' },
    { lesson: lessonIds[5], cluster: 4, recs: 'Use visual data representations. Provide sentence frames for data interpretation. Allow native language for initial discussions.', plan: 'Data Detectives lesson with picture-based data collection, visual graphing tools, and bilingual discussion supports.', materials: 'Picture-based survey cards, visual graph templates, bilingual data interpretation frames' },
    { lesson: lessonIds[6], cluster: 2, recs: 'Use real-world conditional scenarios. Provide choice in robot helper designs. Include peer testing and iteration.', plan: 'Robot Helpers lesson with everyday conditional scenarios. Students design and test conditional rules for classroom robot helpers.', materials: 'Conditional scenario cards, robot design template, peer testing rubric' },
  ];

  const adaptedIds = [];
  for (const a of adaptations) {
    const r = insertAdapted.run(a.lesson, TEACHER_ID, a.cluster, a.recs, a.plan, a.materials);
    adaptedIds.push(r.lastInsertRowid);
  }
  console.log(`Created ${adaptedIds.length} adapted lessons`);

  // ── 6. Versions ─────────────────────────────────────────────────
  for (let i = 0; i < adaptedIds.length; i++) {
    const a = adaptations[i];
    const adaptedId = adaptedIds[i];

    // V1: initial
    const v1 = insertVersion.run(
      adaptedId, null, 1, 0, null,
      `<html><body><h1>Initial Draft: ${a.plan.substring(0, 50)}...</h1><p>${a.recs}</p><p>Materials: ${a.materials}</p></body></html>`,
      JSON.stringify({ recommendations: a.recs.split('. ').filter(Boolean), plan_steps: a.plan.split('. ').filter(Boolean), companion_materials: a.materials.split('. ').filter(Boolean) }),
      'nvidia/nemotron-3-super-120b-a12b:free', 'openrouter', 1200 + Math.floor(Math.random() * 800)
    );

    // V2: refined (head)
    const instructions = ['Add more visual supports', 'Simplify language', 'Include movement breaks', 'Add peer collaboration', 'Connect to home culture'];
    const instruction = instructions[i % 5];
    insertVersion.run(
      adaptedId, v1.lastInsertRowid, 2, 1, instruction,
      `<html><body><h1>Refined: ${a.plan.substring(0, 50)}...</h1><p><strong>Refinement:</strong> ${instruction}</p><p>${a.recs}</p><p>Updated materials: ${a.materials}</p></body></html>`,
      JSON.stringify({ recommendations: a.recs.split('. ').filter(Boolean), plan_steps: a.plan.split('. ').filter(Boolean), companion_materials: a.materials.split('. ').filter(Boolean) }),
      'nvidia/nemotron-3-super-120b-a12b:free', 'openrouter', 1400 + Math.floor(Math.random() * 600)
    );
  }
  console.log(`Created ${adaptedIds.length * 2} versions`);

  // ── 7. KB mappings ──────────────────────────────────────────────
  const kbMappings = [
    [1, 2, 3, 4], [1, 2, 9, 10], [1, 2, 5, 7], [1, 2],
    [1, 2, 3], [1, 2, 3], [1, 2, 9, 10], [1, 2, 5, 7],
    [1, 2, 3, 4], [1, 2],
  ];
  for (let i = 0; i < adaptedIds.length; i++) {
    for (const kbId of kbMappings[i]) {
      insertKbUsed.run(adaptedIds[i], kbId);
    }
  }
  console.log('Linked KBs');

  // ── 8. Feedback ──────────────────────────────────────────────────
  const feedbacks = [
    { id: 0, rating: 5, comment: 'The bilingual scaffolds worked perfectly for my Spanish-speaking students.' },
    { id: 1, rating: 4, comment: 'Visual supports were helpful. Would like more simplified vocabulary lists.' },
    { id: 2, rating: 5, comment: 'Movement breaks were essential for my attention-challenged students.' },
    { id: 3, rating: 4, comment: 'Good enrichment options. Peer teaching moments were very effective.' },
    { id: 4, rating: 5, comment: 'Students loved connecting beadwork to algorithms. Culturally affirming!' },
    { id: 6, rating: 4, comment: 'Advanced students enjoyed the geometric art challenge.' },
    { id: 7, rating: 5, comment: 'Growth mindset approach to debugging changed how students view errors.' },
  ];
  for (const f of feedbacks) {
    insertFeedback.run(adaptedIds[f.id], f.rating, f.comment);
  }
  console.log(`Inserted ${feedbacks.length} feedback entries`);

  // ── 9. RAG logs ─────────────────────────────────────────────────
  for (let i = 0; i < adaptedIds.length; i++) {
    insertRagLog.run(
      adaptedIds[i],
      JSON.stringify(kbMappings[i].map(kbId => ({ kb_id: kbId, section: 'Auto-retrieved', distance: +(0.15 + Math.random() * 0.25).toFixed(3) }))),
      1200 + Math.floor(Math.random() * 800),
      JSON.stringify({ lesson: true, cluster: true, students: true, kb_chunks: kbMappings[i].length, previous_version: i % 2 === 1 })
    );
  }
  console.log('Inserted RAG logs');

  // ── 10. LLM config for rchen ────────────────────────────────────
  const existing = db.prepare('SELECT config_id FROM llm_provider_config WHERE teacher_id = ? AND provider = ?').get(TEACHER_ID, 'openrouter');
  const encryptedKey = encrypt('sk-or-v1-demo-placeholder-key-123456789');
  if (existing) {
    db.prepare('UPDATE llm_provider_config SET model = ?, api_key_encrypted = ?, is_active = 1 WHERE config_id = ?').run('nvidia/nemotron-3-super-120b-a12b:free', encryptedKey, existing.config_id);
    console.log('Updated existing LLM config');
  } else {
    insertLlmConfig.run(TEACHER_ID, 'openrouter', 'nvidia/nemotron-3-super-120b-a12b:free', encryptedKey, 1);
    console.log('Added LLM config');
  }

  // ── 11. Update adapted summaries ────────────────────────────────
  for (let i = 0; i < adaptedIds.length; i++) {
    const a = adaptations[i];
    updateAdapted.run(
      JSON.stringify(a.recs.split('. ').filter(Boolean)),
      JSON.stringify(a.plan.split('. ').filter(Boolean)),
      JSON.stringify(a.materials.split('. ').filter(Boolean)),
      adaptedIds[i]
    );
  }
  console.log('Updated summaries');
}

const tx = db.transaction(seed);
tx(db);

console.log('\nDone! rchen (teacher_id=4) now has:');
console.log('  - 7 new lessons (IDs 4-10)');
console.log('  - 3 classes');
console.log('  - 15 students enrolled');
console.log('  - 10 adapted lessons with 2 versions each');
console.log('  - 7 feedback entries');
console.log('  - LLM config (OpenRouter + Nemotron)');
