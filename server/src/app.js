const express = require('express');
const cors = require('cors');
const config = require('./config');
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');

const app = express();

// Middleware
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

// Routes
app.use('/api', indexRoutes);
app.use('/api/auth', authRoutes);

// Placeholder error handler (replaced in Plan 3)
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const response = { error: err.message || 'Internal server error', status };
  if (err.detail) response.detail = err.detail;
  if (config.nodeEnv !== 'production' && status === 500) response.stack = err.stack;
  res.status(status).json(response);
});

module.exports = app;
