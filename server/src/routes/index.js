const express = require('express');
const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const authRoutes = require('./auth');
const teacherRoutes = require('./teachers');
const lessonsRouter = require('./lessons');
const clustersRouter = require('./clusters');
const knowledgeBasesRouter = require('./knowledge-bases');

router.use('/auth', authRoutes);
router.use('/teachers', teacherRoutes);
router.use('/lessons', lessonsRouter);
router.use('/clusters', clustersRouter);
router.use('/knowledge-bases', knowledgeBasesRouter);

module.exports = router;
