// entry: single Express app serving the built React frontend and the API from one origin
const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');

const config = require('./config');
const { initDb } = require('./db');
const requireAuth = require('./middleware/require-auth');
const authRoutes = require('./routes/auth');
const capsuleRoutes = require('./routes/capsules');

initDb();

const app = express();

// proxy: Render and Azure terminate TLS in front of the app, so req.protocol stays https
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

// spec 5: public health check, exact response shape
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);

// session: same payload as /api/auth/me, kept for the frontend
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// spec 5: protected CRUD, exact paths
app.use('/api/capsules', capsuleRoutes);

// unknown api route: JSON 404, never the SPA html
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not_found', message: `No API route for ${req.method} ${req.originalUrl}` });
});

// static: the Vite build output
const clientDist = path.join(__dirname, '..', 'client', 'dist');
const clientIndex = path.join(clientDist, 'index.html');
const hasClientBuild = fs.existsSync(clientIndex);

if (hasClientBuild) {
  app.use(express.static(clientDist, { index: false, maxAge: config.isDev ? 0 : '1h' }));
  // spa fallback: /, /login and /dashboard are all served by React Router
  app.get('*', (req, res) => {
    res.sendFile(clientIndex);
  });
} else {
  app.get('*', (req, res) => {
    res
      .status(503)
      .type('html')
      .send('<h1>AI Capsule</h1><p>Frontend build missing. Run <code>npm run build</code> and restart.</p>');
  });
}

// errors: always JSON for API paths
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid_json', message: 'Request body is not valid JSON.' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'payload_too_large', message: 'Request body is too large.' });
  }

  console.error('[error]', err && err.stack ? err.stack : err);
  return res.status(500).json({ error: 'server_error', message: 'Unexpected server error.' });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`[ai-capsule] listening on port ${config.port} (${config.nodeEnv})`);
    console.log(`[ai-capsule] database: ${config.dbFile}`);
    if (!hasClientBuild) console.warn('[ai-capsule] client/dist not found, run npm run build');
    if (!config.github.clientId || !config.github.clientSecret) {
      console.warn('[ai-capsule] GitHub OAuth is not configured, /api/auth/github will return 500');
    }
  });
}

module.exports = app;
