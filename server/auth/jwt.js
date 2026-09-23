// jwt: the APPLICATION token, signed and verified by this Express backend
// note: this is not the GitHub OAuth access token, which never leaves the server
const jwt = require('jsonwebtoken');
const config = require('../config');

const ALGORITHM = 'HS256';

// sign: called only after a successful OAuth callback
function signAppToken(user) {
  const payload = {
    sub: String(user.id), // owner identity from the OAuth provider
    provider: user.provider,
    login: user.login || null,
    name: user.name || null,
    avatar_url: user.avatarUrl || null,
  };
  return jwt.sign(payload, config.jwtSecret, {
    algorithm: ALGORITHM,
    expiresIn: config.jwtTtlSeconds,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });
}

// verify: algorithm pinned so an "alg: none" or asymmetric token cannot bypass the check
function verifyAppToken(token) {
  return jwt.verify(token, config.jwtSecret, {
    algorithms: [ALGORITHM],
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });
}

// cookie: HttpOnly always, Secure whenever not running in local development
function authCookieOptions() {
  return {
    httpOnly: true,
    secure: !config.isDev,
    sameSite: 'lax', // lax so the cookie survives the GitHub redirect back to us
    path: '/',
    maxAge: config.jwtTtlSeconds * 1000,
  };
}

function clearCookieOptions() {
  return { httpOnly: true, secure: !config.isDev, sameSite: 'lax', path: '/' };
}

// state cookie: short lived CSRF nonce for the OAuth round trip
function stateCookieOptions() {
  return { httpOnly: true, secure: !config.isDev, sameSite: 'lax', path: '/', maxAge: 10 * 60 * 1000 };
}

module.exports = {
  ALGORITHM,
  signAppToken,
  verifyAppToken,
  authCookieOptions,
  clearCookieOptions,
  stateCookieOptions,
};
