const config = require('./config');
const app = require('./app');
const { initSchema } = require('./db/init');
const { seedAdminPassword } = require('./db/seed');

// Initialize database schema and seed data
initSchema();
seedAdminPassword();

// Start server
app.listen(config.port, () => {
  console.log(`ADAPT server running on http://localhost:${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});
