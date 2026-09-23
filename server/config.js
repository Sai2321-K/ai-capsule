// config: every secret comes from environment variables, none are committed
require('dotenv').config();

const path = require('path');

const nodeEnv = process.env.NODE_ENV || 'production';
const isDev = nodeEnv === 'development';

function trimSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

// spec 9: JWT_SECRET must exist, no fallback secret is shipped in the repo
const jwtSecret = (process.env.JWT_SECRET || '').trim();
if (!jwtSecret) {
  console.error(
    '\n[config] Missing required environment variable JWT_SECRET.\n' +
      '  Local:    copy .env.example to .env and set JWT_SECRET.\n' +
      '  Deployed: add JWT_SECRET in your cloud platform environment settings.\n'
  );
  process.exit(1);
}
if (jwtSecret.length < 16) {
  console.warn('[config] JWT_SECRET is shorter than 16 characters. Use a long random value.');
}

const config = {
  nodeEnv,
  isDev,
  port: Number(process.env.PORT) || 4000,

  // jwt
  jwtSecret,
  jwtTtlSeconds: Number(process.env.JWT_TTL_SECONDS) || 7200,
  jwtIssuer: 'ai-capsule',
  jwtAudience: 'ai-capsule-app',

  // spec 9: cookie name must be exactly "token"
  cookieName: 'token',
  stateCookieName: 'oauth_state',

  // urls
  publicUrl: trimSlash(process.env.PUBLIC_URL),
  clientUrl: trimSlash(process.env.CLIENT_URL),

  // oauth
  github: {
    clientId: (process.env.GITHUB_CLIENT_ID || '').trim(),
    clientSecret: (process.env.GITHUB_CLIENT_SECRET || '').trim(),
  },

  // storage
  dbFile: process.env.DATABASE_FILE || path.join(__dirname, '..', 'data', 'capsules.db'),
};

module.exports = config;
