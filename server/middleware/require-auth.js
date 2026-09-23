// requireAuth: guards every protected route
const config = require('../config');
const { verifyAppToken, clearCookieOptions } = require('../auth/jwt');

function unauthorized(res, message) {
  return res.status(401).json({ error: 'unauthorized', message });
}

function requireAuth(req, res, next) {
  const token = req.cookies ? req.cookies[config.cookieName] : null;

  // spec 9: no JWT -> 401, no protected data
  if (!token) {
    return unauthorized(res, 'Authentication required. Sign in to use this endpoint.');
  }

  let payload;
  try {
    payload = verifyAppToken(token);
  } catch (err) {
    // spec 9: invalid, tampered or expired JWT -> 401
    res.clearCookie(config.cookieName, clearCookieOptions());
    const message =
      err && err.name === 'TokenExpiredError'
        ? 'Session expired. Sign in again.'
        : 'Invalid session token.';
    return unauthorized(res, message);
  }

  // defensive: a validly signed token without a subject is still not a user
  if (!payload || !payload.sub) {
    res.clearCookie(config.cookieName, clearCookieOptions());
    return unauthorized(res, 'Invalid session token.');
  }

  // spec 6: identity comes from the verified JWT only, never from the request body
  req.user = {
    id: String(payload.sub),
    provider: payload.provider || null,
    login: payload.login || null,
    name: payload.name || null,
    avatar_url: payload.avatar_url || null,
  };

  return next();
}

module.exports = requireAuth;
