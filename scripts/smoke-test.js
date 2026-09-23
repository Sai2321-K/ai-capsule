/*
 * smoke-test: end to end checks against a running AI Capsule instance.
 *
 *   node scripts/smoke-test.js                          -> http://localhost:4000
 *   node scripts/smoke-test.js https://your-app.onrender.com
 *
 * Public checks (health and the 401 tests) always run.
 * Authenticated checks run only when JWT_SECRET is available locally, because
 * the script signs its own test tokens instead of completing the OAuth flow.
 */
require('dotenv').config();

const BASE = (process.argv[2] || process.env.SMOKE_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const SECRET = (process.env.JWT_SECRET || '').trim();

// must match server/auth/jwt.js
const ISSUER = 'ai-capsule';
const AUDIENCE = 'ai-capsule-app';
const ALGORITHM = 'HS256';

let jwt = null;
try {
  jwt = require('jsonwebtoken');
} catch (err) {
  jwt = null;
}

const results = [];
function record(name, passed, detail) {
  results.push({ name, passed, detail });
  const mark = passed ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? `  (${detail})` : ''}`);
}
function check(name, condition, detail) {
  record(name, Boolean(condition), condition ? '' : detail || '');
}

async function call(path, { method = 'GET', cookie, body, rawBody } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined || rawBody !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (err) {
    json = null;
  }
  return { status: response.status, json, text, headers: response.headers };
}

function token(sub, overrides = {}) {
  const options = {
    algorithm: ALGORITHM,
    expiresIn: overrides.expiresIn || 3600,
    issuer: overrides.issuer || ISSUER,
    audience: overrides.audience || AUDIENCE,
  };
  return jwt.sign({ sub: String(sub), provider: 'test', login: `user-${sub}` }, overrides.secret || SECRET, options);
}

const SAMPLE = {
  project_name: 'Smoke Test Project',
  prompt_title: 'Smoke test prompt',
  prompt_version: 'v1',
  prompt_text: 'Explain why my Express route returns 401.',
  response_summary: 'The JWT cookie was missing.',
  category: 'Debugging',
  usefulness: 'Good',
  reviewed: 'Yes',
  improved: 'No',
  screenshot_url: 'https://example.com/shot.png',
  notes: 'Created by scripts/smoke-test.js',
};

async function publicChecks() {
  console.log('\n--- public checks ---');

  const health = await call('/api/health');
  check('GET /api/health returns 200', health.status === 200, `got ${health.status}`);
  check(
    'GET /api/health body is exactly { "status": "ok" }',
    health.json && health.json.status === 'ok' && Object.keys(health.json).length === 1,
    JSON.stringify(health.json)
  );

  // required cURL test 1
  const noAuth = await call('/api/capsules');
  check('cURL test 1: GET /api/capsules with no cookie returns 401', noAuth.status === 401, `got ${noAuth.status}`);
  check('cURL test 1: no capsule data leaked', !Array.isArray(noAuth.json), JSON.stringify(noAuth.json));

  // required cURL test 2
  const fake = await call('/api/capsules', { cookie: 'token=fake-token-123' });
  check('cURL test 2: GET /api/capsules with fake JWT returns 401', fake.status === 401, `got ${fake.status}`);
  check('cURL test 2: no capsule data leaked', !Array.isArray(fake.json), JSON.stringify(fake.json));

  const writes = [
    ['POST', '/api/capsules'],
    ['PUT', '/api/capsules/1'],
    ['DELETE', '/api/capsules/1'],
  ];
  for (const [method, path] of writes) {
    const noCookie = await call(path, { method, body: SAMPLE });
    check(`${method} ${path} with no cookie returns 401`, noCookie.status === 401, `got ${noCookie.status}`);
    const withFake = await call(path, { method, cookie: 'token=fake-token-123', body: SAMPLE });
    check(`${method} ${path} with fake JWT returns 401`, withFake.status === 401, `got ${withFake.status}`);
  }

  const unknown = await call('/api/does-not-exist');
  check('unknown API route returns JSON 404', unknown.status === 404 && unknown.json !== null, `got ${unknown.status}`);

  const landing = await call('/');
  check('public landing page loads', landing.status === 200, `got ${landing.status}`);

  const deepLink = await call('/dashboard');
  check('SPA deep link /dashboard is served by the app', deepLink.status === 200, `got ${deepLink.status}`);
}

async function authChecks() {
  console.log('\n--- authenticated checks ---');

  const userA = `smoke-a-${Date.now()}`;
  const userB = `smoke-b-${Date.now()}`;
  const cookieA = `token=${token(userA)}`;
  const cookieB = `token=${token(userB)}`;

  // rejected tokens
  const wrongSecret = await call('/api/capsules', {
    cookie: `token=${token(userA, { secret: `${SECRET}-wrong` })}`,
  });
  check('token signed with a different secret returns 401', wrongSecret.status === 401, `got ${wrongSecret.status}`);

  const expired = await call('/api/capsules', { cookie: `token=${token(userA, { expiresIn: -60 })}` });
  check('expired token returns 401', expired.status === 401, `got ${expired.status}`);

  const wrongIssuer = await call('/api/capsules', { cookie: `token=${token(userA, { issuer: 'someone-else' })}` });
  check('token with wrong issuer returns 401', wrongIssuer.status === 401, `got ${wrongIssuer.status}`);

  const wrongAudience = await call('/api/capsules', { cookie: `token=${token(userA, { audience: 'other-app' })}` });
  check('token with wrong audience returns 401', wrongAudience.status === 401, `got ${wrongAudience.status}`);

  const noneAlg = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(
    JSON.stringify({ sub: userA, iss: ISSUER, aud: AUDIENCE })
  ).toString('base64url')}.`;
  const algNone = await call('/api/capsules', { cookie: `token=${noneAlg}` });
  check('unsigned "alg: none" token returns 401', algNone.status === 401, `got ${algNone.status}`);

  const tampered = (() => {
    const parts = token(userA).split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    payload.sub = 'attacker';
    parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return parts.join('.');
  })();
  const tamperedResult = await call('/api/capsules', { cookie: `token=${tampered}` });
  check('tampered payload returns 401', tamperedResult.status === 401, `got ${tamperedResult.status}`);

  // read
  const listA = await call('/api/capsules', { cookie: cookieA });
  check('GET /api/capsules with a valid token returns 200', listA.status === 200, `got ${listA.status}`);
  check('GET /api/capsules returns an array', Array.isArray(listA.json), JSON.stringify(listA.json));
  check('a brand new user starts with no records', Array.isArray(listA.json) && listA.json.length === 0);

  // create
  const created = await call('/api/capsules', { method: 'POST', cookie: cookieA, body: SAMPLE });
  check('POST /api/capsules returns 201', created.status === 201, `got ${created.status}`);
  const id = created.json && created.json.id;
  check('created record has an id', Number.isInteger(id), JSON.stringify(created.json));
  check('created record is owned by the JWT subject', created.json && created.json.user_id === userA, created.json && created.json.user_id);
  check('reviewed "Yes" stored as 1', created.json && created.json.reviewed === 1);
  check('improved "No" stored as 0', created.json && created.json.improved === 0);
  check('created_at is set automatically', Boolean(created.json && created.json.created_at));

  // ownership cannot be forged from the body
  const injected = await call('/api/capsules', {
    method: 'POST',
    cookie: cookieA,
    body: { ...SAMPLE, user_id: userB, id: 999999, created_at: '1999-01-01 00:00:00' },
  });
  check('POST ignores user_id sent by the client', injected.json && injected.json.user_id === userA, injected.json && injected.json.user_id);
  check('POST ignores id sent by the client', injected.json && injected.json.id !== 999999);
  check('POST ignores created_at sent by the client', injected.json && !String(injected.json.created_at).startsWith('1999'));
  const injectedId = injected.json && injected.json.id;

  // validation
  const missing = await call('/api/capsules', { method: 'POST', cookie: cookieA, body: { project_name: 'only this' } });
  check('POST with missing required fields returns 400', missing.status === 400, `got ${missing.status}`);
  check('validation errors are itemised', Boolean(missing.json && Array.isArray(missing.json.details)));

  const badUrl = await call('/api/capsules', {
    method: 'POST',
    cookie: cookieA,
    body: { ...SAMPLE, screenshot_url: 'javascript:alert(1)' },
  });
  check('POST with a non http screenshot URL returns 400', badUrl.status === 400, `got ${badUrl.status}`);

  const badJson = await call('/api/capsules', { method: 'POST', cookie: cookieA, rawBody: '{not json' });
  check('malformed JSON body returns 400 JSON', badJson.status === 400 && badJson.json !== null, `got ${badJson.status}`);

  const badId = await call('/api/capsules/abc', { method: 'PUT', cookie: cookieA, body: SAMPLE });
  check('PUT with a non numeric id returns 400', badId.status === 400, `got ${badId.status}`);

  // read back
  const listAfter = await call('/api/capsules', { cookie: cookieA });
  check('GET now lists the created records', Array.isArray(listAfter.json) && listAfter.json.length === 2, `got ${listAfter.json && listAfter.json.length}`);
  check('every listed record belongs to the caller', Array.isArray(listAfter.json) && listAfter.json.every((row) => row.user_id === userA));

  const one = await call(`/api/capsules/${id}`, { cookie: cookieA });
  check('GET /api/capsules/:id returns the owned record', one.status === 200 && one.json && one.json.id === id, `got ${one.status}`);

  // update
  const updated = await call(`/api/capsules/${id}`, {
    method: 'PUT',
    cookie: cookieA,
    body: { ...SAMPLE, prompt_title: 'Updated by smoke test', prompt_version: 'v2', improved: 'Yes' },
  });
  check('PUT /api/capsules/:id returns 200', updated.status === 200, `got ${updated.status}`);
  check('PUT applied the change', updated.json && updated.json.prompt_title === 'Updated by smoke test');
  check('PUT kept the original owner', updated.json && updated.json.user_id === userA);
  check('PUT kept the original id', updated.json && updated.json.id === id);

  // cross user isolation
  const listB = await call('/api/capsules', { cookie: cookieB });
  check('user B cannot see user A records', Array.isArray(listB.json) && listB.json.length === 0, `got ${listB.json && listB.json.length}`);

  const readOther = await call(`/api/capsules/${id}`, { cookie: cookieB });
  check('user B cannot read a record owned by A', readOther.status === 404, `got ${readOther.status}`);

  const updateOther = await call(`/api/capsules/${id}`, { method: 'PUT', cookie: cookieB, body: SAMPLE });
  check('user B cannot update a record owned by A', updateOther.status === 404, `got ${updateOther.status}`);

  const deleteOther = await call(`/api/capsules/${id}`, { method: 'DELETE', cookie: cookieB });
  check('user B cannot delete a record owned by A', deleteOther.status === 404, `got ${deleteOther.status}`);

  const stillThere = await call(`/api/capsules/${id}`, { cookie: cookieA });
  check("user A's record survived user B's attempts", stillThere.status === 200, `got ${stillThere.status}`);

  // delete
  const removed = await call(`/api/capsules/${id}`, { method: 'DELETE', cookie: cookieA });
  check('DELETE /api/capsules/:id returns 200', removed.status === 200, `got ${removed.status}`);

  const gone = await call(`/api/capsules/${id}`, { cookie: cookieA });
  check('deleted record is gone', gone.status === 404, `got ${gone.status}`);

  const deleteTwice = await call(`/api/capsules/${id}`, { method: 'DELETE', cookie: cookieA });
  check('deleting the same record twice returns 404', deleteTwice.status === 404, `got ${deleteTwice.status}`);

  // cleanup
  if (injectedId) await call(`/api/capsules/${injectedId}`, { method: 'DELETE', cookie: cookieA });
  const finalList = await call('/api/capsules', { cookie: cookieA });
  check('test records cleaned up', Array.isArray(finalList.json) && finalList.json.length === 0, `left ${finalList.json && finalList.json.length}`);
}

async function main() {
  console.log(`AI Capsule smoke test against ${BASE}`);

  await publicChecks();

  if (!SECRET) {
    console.log('\nSkipping authenticated checks: JWT_SECRET is not set in this shell.');
    console.log('Run these against your local instance, or export the deployed JWT_SECRET temporarily.');
  } else if (!jwt) {
    console.log('\nSkipping authenticated checks: run npm install first.');
  } else {
    await authChecks();
  }

  const failed = results.filter((item) => !item.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log('Failed checks:');
    for (const item of failed) console.log(`  - ${item.name}${item.detail ? `: ${item.detail}` : ''}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('\nSmoke test could not run:', err && err.message ? err.message : err);
  console.error('Is the server running at', BASE, '?');
  process.exitCode = 1;
});
