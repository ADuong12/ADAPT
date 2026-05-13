const express = require('express');
const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const authRoutes = require('./auth');
const teacherRoutes = require('./teachers');
const settingsRouter = require('./settings');
const lessonsRouter = require('./lessons');
const clustersRouter = require('./clusters');
const knowledgeBasesRouter = require('./knowledge-bases');
const adminRouter = require('./admin');

router.use('/auth', authRoutes);
router.use('/teachers', teacherRoutes);
router.use('/teachers', settingsRouter);
router.use('/lessons', lessonsRouter);
router.use('/clusters', clustersRouter);
router.use('/knowledge-bases', knowledgeBasesRouter);
router.use('/institutions', adminRouter);

// NOTE: This route registration modifies server/src/routes/index.js.
// If Plan 03-02 and Plan 03-03 execute in parallel, apply this registration sequentially —
// do not overwrite the other plan's registration line.
const adaptationsRouter = require('./adaptations');
router.use('/', adaptationsRouter);

// NOTE: Route file file-edits.js is created in Plan 03-03.
// Route registration is deferred to that plan to avoid MODULE_NOT_FOUND on startup.
// See Plan 03-03 Task 2 for file-edits registration.

module.exports = router;
