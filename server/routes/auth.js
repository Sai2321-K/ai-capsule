// auth: GitHub OAuth web application flow, then this backend issues its own JWT
const express = require('express');
const crypto = require('crypto');
const config = require('../config');
const requireAuth = require('../middleware/require-auth');
const {
  signAppToken,
  authCookieOptions,
  clearCookieOptions,
  stateCookieOptions,
} = require('../auth/jwt');

const router = express.Router();

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const USER_AGENT = 'ai-capsule';

// urls: PUBLIC_URL wins when set, otherwise fall back to the incoming request host
function baseUrl(req) {
  return config.publicUrl || `${req.protocol}://${req.get('host')}`;
}
function appUrl(req) {
  return config.clientUrl || baseUrl(req);
}
function callbackUrl(req) {
  return `${baseUrl(req)}/api/auth/github/callback`;
}
function loginError(req, res, code) {
  return res.redirect(`${appUrl(req)}/login?error=${encodeURIComponent(code)}`);
}

function oauthConfigured() {
  return Boolean(config.github.clientId && config.github.clientSecret);
}

// step 1: send the user to GitHub with a CSRF state nonce
router.get('/github', (req, res) => {
  if (!oauthConfigured()) {
    return res.status(500).json({
      error: 'oauth_not_configured',
      message: 'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are not set on the server.',
    });
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(config.stateCookieName, state, stateCookieOptions());

  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: callbackUrl(req),
    scope: 'read:user',
    state,
    allow_signup: 'true',
  });
  res.redirect(`${GITHUB_AUTHORIZE_URL}?${params.toString()}`);
});

// step 2: GitHub redirects back, we exchange the code and mint the application JWT
router.get('/github/callback', async (req, res, next) => {
  try {
    if (!oauthConfigured()) return loginError(req, res, 'oauth_not_configured');

    const { code, state, error } = req.query;
    const expectedState = req.cookies ? req.cookies[config.stateCookieName] : null;
    res.clearCookie(config.stateCookieName, clearCookieOptions());

    if (error) return loginError(req, res, String(error)); // user cancelled on GitHub
    if (!code) return loginError(req, res, 'missing_code');
    if (!state || !expectedState || String(state) !== String(expectedState)) {
      return loginError(req, res, 'invalid_state');
    }

    // exchange: the client secret stays server side
    const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code: String(code),
        redirect_uri: callbackUrl(req),
      }),
    });

    const tokenBody = await tokenResponse.json().catch(() => null);
    if (!tokenResponse.ok || !tokenBody || tokenBody.error || !tokenBody.access_token) {
      console.error('[auth] token exchange failed', tokenResponse.status, tokenBody && tokenBody.error);
      return loginError(req, res, 'token_exchange_failed');
    }

    // profile: the GitHub access token is used here only and is never stored or sent to the browser
    const profileResponse = await fetch(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': USER_AGENT,
      },
    });

    if (!profileResponse.ok) {
      console.error('[auth] profile fetch failed', profileResponse.status);
      return loginError(req, res, 'profile_fetch_failed');
    }

    const profile = await profileResponse.json().catch(() => null);
    if (!profile || profile.id === undefined || profile.id === null) {
      return loginError(req, res, 'profile_fetch_failed');
    }

    // spec 9: our own application JWT, in a Secure HttpOnly cookie named token
    const token = signAppToken({
      id: profile.id,
      provider: 'github',
      login: profile.login,
      name: profile.name || profile.login,
      avatarUrl: profile.avatar_url,
    });
    res.cookie(config.cookieName, token, authCookieOptions());

    return res.redirect(`${appUrl(req)}/dashboard`);
  } catch (err) {
    return next(err);
  }
});

// session: lets the React app know who is signed in
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// logout: clears the token cookie
router.post('/logout', (req, res) => {
  res.clearCookie(config.cookieName, clearCookieOptions());
  res.json({ ok: true });
});

module.exports = router;
