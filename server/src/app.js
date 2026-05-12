const express = require('express');
const cors = require('cors');
const config = require('./config');
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teachers');
const errorHandler = require('./middleware/errorHandler');
const { NotFoundError } = require('./errors');

const app = express();

// Middleware
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

// Routes
app.use('/api', indexRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/teachers', teacherRoutes);

// Catch-all 404 handler
app.use((req, res, next) => {
  next(new NotFoundError('Resource'));
});

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
