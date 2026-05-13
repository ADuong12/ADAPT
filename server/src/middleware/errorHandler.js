const config = require('../config');

function errorHandler(err, req, res, next) {
  // Determine status from error type
  const status = err.status || 500;
  
  // Build standardized error envelope per D-10
  const response = {
    error: err.message || 'Internal server error',
    status
  };
  
  // Include detail if present
  if (err.detail) {
    response.detail = err.detail;
  }
  
  // SEC-05: Only include stack trace in development for 500 errors
  if (config.nodeEnv !== 'production' && status === 500) {
    response.stack = err.stack;
  }
  
  // Log 500 errors for debugging (but never log request bodies with potential secrets)
  if (status === 500) {
    console.error(`[ERROR] ${req.method} ${req.path} — ${err.message}`);
    if (config.nodeEnv !== 'production') {
      console.error(err.stack);
    }
  }
  
  res.status(status).json(response);
}

module.exports = errorHandler;
