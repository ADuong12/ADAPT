require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const path = require('path');

const config = {
  rootDir: path.resolve(__dirname, '..', '..'),
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
};

module.exports = config;
