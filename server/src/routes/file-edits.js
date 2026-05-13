const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const requireAuth = require('../middleware/auth');
const { editSourceFile, editedFilePath, sourceFilesForLesson } = require('../services/source-editor');
const db = require('../db');

// POST /api/file-edits — Request AI edit on a source file
router.post('/file-edits', requireAuth, async (req, res) => {
  const { lesson_id, source_path, instruction, cluster_id, kb_ids } = req.body;
  if (!lesson_id || !source_path || !instruction) {
    return res.status(400).json({ error: 'lesson_id, source_path, and instruction required' });
  }
  try {
    const result = await editSourceFile({
      teacherId: req.user.teacher_id,
      lessonId: lesson_id,
      sourcePath: source_path,
      instruction,
      clusterId: cluster_id || null,
      kbIds: kb_ids || [],
    });
    res.status(201).json(result);
  } catch (e) {
    if (e.message.includes('not found') || e.message.includes('unsupported')) {
      return res.status(404).json({ error: e.message });
    }
    if (e.message.includes('No LLM configured')) {
      return res.status(400).json({ error: e.message });
    }
    res.status(500).json({ error: e.message });
  }
});

// GET /api/lesson-file-edits/:filename — Download edited file
router.get('/lesson-file-edits/:filename', requireAuth, (req, res) => {
  try {
    const filePath = editedFilePath(req.params.filename);
    res.sendFile(filePath);
  } catch (e) {
    if (e.message.includes('not found') || e.message.includes('invalid')) {
      return res.status(404).json({ error: e.message });
    }
    res.status(500).json({ error: e.message });
  }
});

// GET /api/file-edits/lessons/:lesson_id/sources — List available source files for a lesson
router.get('/file-edits/lessons/:lesson_id/sources', requireAuth, (req, res) => {
  const lesson = db.prepare("SELECT * FROM lesson WHERE lesson_id = ?").get(parseInt(req.params.lesson_id));
  if (!lesson) return res.status(404).json({ error: 'lesson not found' });
  const files = sourceFilesForLesson(lesson);
  res.json(files);
});

module.exports = router;
