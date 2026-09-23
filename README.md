# AI Capsule

A cloud deployed AI prompt manager. Signed in users keep a private library of the prompts they use with
tools such as ChatGPT, Copilot, Gemini and Claude, together with a summary of the response, a usefulness
rating, review status, notes and optional screenshot evidence.

Built for CSE5006 Assignment 3. React frontend, Node.js and Express backend, SQLite storage, GitHub OAuth
login and an application JWT issued by Express and stored in a Secure, HttpOnly cookie named `token`.

---

## 1. Deployed application

| Item | Value |
| --- | --- |
| Public URL | `https://ai-capsule-sai.onrender.com` |
| Cloud platform | Render (free web service) |
| Health check | `https://ai-capsule-sai.onrender.com/api/health` |
| Region | Singapore |
| Repository | `https://github.com/Sai2321-K/ai-capsule` |


The React frontend and the Express API are served by a single Render web service from a single origin. That
avoids cross origin requests and third party cookie problems entirely, because the browser treats the app and
the API as the same site.

Render's free plan puts an idle service to sleep. The first request after a period of inactivity can take
around 30 to 50 seconds while the service wakes up. Later requests are fast.

---

## 2. Technology

| Component | Choice |
| --- | --- |
| Frontend | React 18 with React Router 6, built by Vite |
| Backend | Node.js 22 with Express 4 |
| Authentication | GitHub OAuth (web application flow) |
| Application session | JWT signed with HS256 by Express, stored in a Secure, HttpOnly cookie named `token` |
| Storage | SQLite via Node's built-in `node:sqlite` module (no native package to compile) |
| Deployment | Render, one web service serving both the frontend build and the API |

Firebase Authentication is not used. The GitHub OAuth access token is used once on the server to read the
public profile and is then discarded. It is never stored and never sent to the browser.

---

## 3. Project layout

```
ai-capsule/
├── package.json              root scripts and backend dependencies
├── render.yaml               Render blueprint (optional, for one click setup)
├── .env.example              environment variable names, no secret values
├── .nvmrc                    Node version pin
├── server/
│   ├── index.js              Express app, static hosting, SPA fallback, error handler
│   ├── config.js             environment variables, fails fast if JWT_SECRET is missing
│   ├── db.js                 SQLite connection and schema
│   ├── validation.js         pure input validation and normalisation
│   ├── auth/jwt.js           signs and verifies the application JWT, cookie options
│   ├── middleware/require-auth.js   JWT middleware used by every protected route
│   ├── routes/auth.js        GitHub OAuth start and callback, logout, session
│   ├── routes/capsules.js    CRUD for /api/capsules
│   └── scripts/init-db.js    creates the database file and table
├── client/
│   ├── index.html
│   ├── vite.config.js        dev proxy so the dev server shares the Express origin
│   └── src/
│       ├── main.jsx, App.jsx, api.js, auth.jsx, styles.css
│       ├── pages/            Landing, Login, Dashboard, NotFound
│       └── components/       Header, ProtectedRoute, CapsuleForm, CapsuleCard
├── scripts/
│   ├── smoke-test.js         automated end to end API and security checks
│   ├── check-auth.sh         the two required cURL checks (bash)
│   └── check-auth.ps1        the two required cURL checks (PowerShell)
└── test/
    └── validation.test.js    unit tests for the validation layer
```

---

## 4. Install and run locally

Requires Node.js 22.13 or newer (Node 22 LTS or Node 24) and npm. The database uses Node's built-in
`node:sqlite` module, so there is no native package to compile and no Python or Visual Studio build tools are
needed.

```bash
# 1. install backend dependencies
npm install

# 2. create your local environment file
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env

# 3. generate a JWT secret and paste it into .env as JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. create the SQLite database and table
npm run init-db

# 5. build the React frontend
npm run build

# 6. start the server
npm start
```

Then open `http://localhost:4000`.

For local GitHub login, create a GitHub OAuth App with:

- Homepage URL: `http://localhost:4000`
- Authorization callback URL: `http://localhost:4000/api/auth/github/callback`

and put the client ID and secret in `.env`. Keep `NODE_ENV=development` locally so the cookie is not marked
`Secure`, because plain `http://localhost` cannot receive a `Secure` cookie.

### Frontend development with hot reload

```bash
npm run dev:server      # terminal 1, Express on port 4000
npm run dev:client      # terminal 2, Vite on port 5173
```

Vite proxies `/api` to `http://localhost:4000`, so the cookie still works. Set `CLIENT_URL=http://localhost:5173`
in `.env` so the OAuth callback redirects back to the Vite dev server.

### Other scripts

```bash
npm test                # unit tests for the validation layer
npm run smoke           # end to end API and security checks against localhost
node scripts/smoke-test.js https://ai-capsule-sai.onrender.com   # public checks against the deployed app
```

---

## 5. Required pages and API routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Landing page explaining AI Capsule |
| `/login` | Public | Starts GitHub OAuth login |
| `/dashboard` | Protected | Shows the authenticated user's records |
| `GET /api/health` | Public | Returns `{ "status": "ok" }` |
| `GET /api/capsules` | Protected | Read own records |
| `POST /api/capsules` | Protected | Create own record |
| `PUT /api/capsules/:id` | Protected | Update own record |
| `DELETE /api/capsules/:id` | Protected | Delete own record |

Supporting routes used by the OAuth flow and the frontend session:

| Route | Access | Purpose |
| --- | --- | --- |
| `GET /api/auth/github` | Public | Redirects to GitHub with a CSRF `state` nonce |
| `GET /api/auth/github/callback` | Public | Exchanges the code, issues the application JWT, sets the cookie |
| `GET /api/me` | Protected | Returns the signed in user taken from the verified JWT |
| `POST /api/auth/logout` | Public | Clears the `token` cookie |

`GET /api/capsules/:id` also exists and is owner scoped. It is a convenience route and does not replace any
required route.

### How the React frontend talks to Express

Both are served from the same origin, so the frontend calls relative paths such as `/api/capsules` with no
base URL and no CORS configuration.

Every request in `client/src/api.js` uses `fetch` with `credentials: 'include'`, which makes the browser attach
the HttpOnly `token` cookie. The frontend never reads, parses or stores the JWT, because an HttpOnly cookie is
invisible to JavaScript by design. It learns whether a session exists by calling `GET /api/me`: a `200` means
signed in, a `401` means signed out.

On startup `client/src/auth.jsx` calls `/api/me` once and holds the result in React context.
`components/ProtectedRoute.jsx` redirects to `/login` when there is no user. If any API call later returns
`401`, for example because the token expired, the dashboard re-checks the session and the user is sent back to
the login page.

---

## 6. OAuth, JWT and backend protection

### The flow

1. The user clicks "Continue with GitHub" on `/login`, which is a full page navigation to `/api/auth/github`.
2. Express generates a random `state` value, stores it in a short lived HttpOnly cookie, and redirects the
   browser to `https://github.com/login/oauth/authorize`.
3. GitHub redirects back to `/api/auth/github/callback` with a `code` and the same `state`.
4. Express compares the returned `state` with the cookie. A mismatch aborts the login, which blocks CSRF on the
   callback.
5. Express exchanges the `code` for a GitHub access token using the client secret, server side only.
6. Express calls `https://api.github.com/user` once to read the profile, then discards the GitHub token.
7. **Express signs its own application JWT** with `JWT_SECRET` and sets it as the `token` cookie.
8. The browser is redirected to `/dashboard`.

The JWT in step 7 is the application JWT required by the assignment. It is not the GitHub access token.

### How the JWT is issued, stored and verified

**Issued** in `server/auth/jwt.js`:

```js
jwt.sign(
  { sub: String(user.id), provider, login, name, avatar_url },
  config.jwtSecret,
  { algorithm: 'HS256', expiresIn: config.jwtTtlSeconds, issuer: 'ai-capsule', audience: 'ai-capsule-app' }
);
```

`sub` is the GitHub numeric user ID. That value becomes the record owner.

**Stored** as a cookie with these options:

```js
{ httpOnly: true, secure: !isDevelopment, sameSite: 'lax', path: '/', maxAge: jwtTtlSeconds * 1000 }
```

- `httpOnly` means JavaScript cannot read it, which removes the XSS token theft risk of `localStorage`.
- `secure` is true whenever the app is not running in local development, so the deployed app only ever sends
  the cookie over HTTPS.
- `sameSite: 'lax'` is required, because the cookie is set during a top level redirect back from GitHub. `strict`
  would drop the cookie on that navigation and the user would land on `/dashboard` signed out.

**Verified** in `server/middleware/require-auth.js`, which runs on every protected route:

```js
jwt.verify(token, config.jwtSecret, {
  algorithms: ['HS256'], issuer: 'ai-capsule', audience: 'ai-capsule-app'
});
```

The allowed algorithm list is pinned, so a forged token claiming `"alg": "none"` is rejected rather than
accepted without a signature. Issuer and audience are checked so a token minted for a different application
cannot be replayed here.

`server/routes/capsules.js` applies the middleware with `router.use(requireAuth)` before any route is declared,
so `GET`, `POST`, `PUT` and `DELETE` are all protected by construction. There is no route below that line that
can be reached without a valid JWT.

Any request with no cookie, an unparseable cookie, a wrong signature, an expired token, a wrong issuer or
audience, or a validly signed token with no `sub` receives `401 Unauthorized` and no capsule data.

### Ownership

`user_id` is only ever read from the verified JWT:

```js
req.user = { id: String(payload.sub), ... };   // require-auth.js
```

`server/validation.js` builds the column set that gets written and simply does not include `user_id`, `id` or
`created_at`, so those values are discarded if a client sends them. `POST` inserts `user_id: req.user.id`.
`GET`, `PUT` and `DELETE` all carry `user_id = ?` in the SQL `WHERE` clause, so a query for another user's row
matches zero rows. When zero rows match, the API returns `404 Not Found` rather than `403 Forbidden`, so one
user cannot use the status code to learn whether another user's record ID exists.

---

## 7. Environment variables

Names only. No values appear in this repository, and `.env` is listed in `.gitignore`.

| Name | Required | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | Yes | Secret used to sign and verify the application JWT |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth App client secret |
| `PUBLIC_URL` | Yes when deployed | Public origin, used to build the OAuth callback URL |
| `NODE_ENV` | Recommended | `production` when deployed, `development` locally |
| `PORT` | No | Set automatically by Render |
| `JWT_TTL_SECONDS` | No | JWT lifetime in seconds, default 7200 |
| `CLIENT_URL` | No | Only used when the React dev server runs on a different port |
| `DATABASE_FILE` | No | SQLite file path, default `./data/capsules.db` |

`server/config.js` exits with a clear message if `JWT_SECRET` is missing, so the application can never start
with an accidental default secret. No fallback secret exists anywhere in the source.

---

## 8. Database and storage

### Schema

```sql
CREATE TABLE IF NOT EXISTS capsules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  prompt_title TEXT NOT NULL,
  prompt_version TEXT,
  prompt_text TEXT NOT NULL,
  response_summary TEXT,
  category TEXT,
  usefulness TEXT,
  reviewed INTEGER DEFAULT 0,
  improved INTEGER DEFAULT 0,
  screenshot_url TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_capsules_user_id ON capsules(user_id);
```

### How it is created

`server/db.js` runs `CREATE TABLE IF NOT EXISTS` on every boot, and `server/index.js` calls it before the app
starts listening. Nothing manual is needed after deployment. `npm run init-db` runs the same code on its own if
you want to create the file before starting the server.

Every statement is a prepared statement with bound parameters, so user input is never concatenated into SQL.

### Ownership in storage

`user_id` holds the GitHub numeric user ID as text, taken from the verified JWT `sub` claim. An index on
`user_id` supports the owner filter that every query uses.

### Persistence: ephemeral on the free plan

**Storage on the deployed app is ephemeral.** Render's free web service has a temporary filesystem. The SQLite
file is recreated when the service restarts, redeploys or wakes from sleep, so saved capsules can disappear
after a restart. The schema is recreated automatically, so the application keeps working, but earlier rows are
gone.

This is accepted by the assignment specification for a Render deployment. Making storage persistent would mean
attaching a Render persistent disk or moving to a managed PostgreSQL instance, which is a configuration change
in `server/db.js` and the platform settings, not a change to the API or the authentication design.

---

## 9. Required cURL checks

These were run against the deployed URL on 23 September 2026. Helper scripts are included:
`scripts/check-auth.sh` for bash and `scripts/check-auth.ps1` for Windows PowerShell.

### Test 1, no authentication

```bash
curl -i https://ai-capsule-sai.onrender.com/api/capsules
```

Result obtained:

```
HTTP/1.1 401 Unauthorized
Date: Wed, 23 Sep 2026 08:58:18 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
rndr-id: 61bdc420-a9f6-406b
Server: cloudflare
x-render-origin-server: Render

{"error":"unauthorized","message":"Authentication required. Sign in to use this endpoint."}
```

### Test 2, fake or invalid JWT

```bash
curl -i -H "Cookie: token=fake-token-123" https://ai-capsule-sai.onrender.com/api/capsules
```

Result obtained:

```
HTTP/1.1 401 Unauthorized
Date: Wed, 23 Sep 2026 08:58:19 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
rndr-id: 7045ea40-6c15-420b
Server: cloudflare
Set-Cookie: token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax
x-render-origin-server: Render

{"error":"unauthorized","message":"Invalid session token."}
```

Both return `401 Unauthorized` and neither returns any capsule data. Test 2 proves the backend verifies the
token signature rather than only checking that a cookie is present: the value `fake-token-123` is a cookie, but
it is not a valid JWT, so `jwt.verify` rejects it.

Two further details are visible in the Test 2 response. The server clears the bad cookie, and the `Set-Cookie`
header it sends back shows the exact attributes this application uses in production: `HttpOnly`, `Secure` and
`SameSite=Lax`.

### Public health check

```bash
curl -i https://ai-capsule-sai.onrender.com/api/health
```

Result obtained:

```
HTTP/1.1 200 OK
Date: Wed, 23 Sep 2026 08:58:19 GMT
Content-Type: application/json; charset=utf-8
Server: cloudflare
x-render-origin-server: Render

{"status":"ok"}
```

## 10. AI assisted development

### Tools used

Claude (Anthropic) was used for project setup, React components, Express routes, SQLite queries, OAuth/JWT
integration, cloud deployment, CSS, testing and debugging.

### Problems found and corrected in AI generated code and configuration

**1. The database driver would not install on Windows.** The first version used the `better-sqlite3` npm
package. On my machine, running Node 24 on Windows, `npm install` failed with `gyp ERR! find Python` and
`No prebuilt binaries found (target=24.19.0 ... platform=win32)`. `better-sqlite3` is a native C++ addon: when
no prebuilt binary matches the exact Node version and platform, npm falls back to compiling it from source,
which needs Python and the Visual Studio C++ build tools. The same risk existed on Render whenever its Node
version moved ahead of the package's prebuilt binaries.

I replaced it with Node's built-in `node:sqlite` module (`DatabaseSync`). It is part of Node itself, so there is
nothing to download or compile on Windows, macOS or Render. The API is close enough that only `server/db.js`
changed: `db.pragma(...)` became `db.exec('PRAGMA ...')`. I verified the behaviours the routes depend on
before switching: an owner scoped `UPDATE` matches zero rows for another user, an update with identical values
still reports one changed row (so it does not produce a false 404), and `node:sqlite` throws on JavaScript
booleans and on unknown named parameters, which the validation layer and its unit tests already guard against.
The start scripts pass `--disable-warning=ExperimentalWarning` because Node 22 labels the module experimental.

**2. The Render build would have failed.** The first version of the build configuration used:

```json
"build": "npm --prefix client install && npm --prefix client run build"
```

This works locally but fails on Render. Render sets `NODE_ENV=production` for Node services, and npm skips
`devDependencies` when `NODE_ENV` is `production`. Vite and `@vitejs/plugin-react` are devDependencies of the
client, so on Render they were never installed and the build step failed with `vite: not found`, which left the
service with no `client/dist` folder to serve.

The fix was to install the client's dev dependencies explicitly:

```json
"build": "npm --prefix client install --include=dev && npm --prefix client run build"
```

**3. The cookie's `sameSite` setting would have broken login.** `strict` looks like the safer choice, but the
`token` cookie is set during the top level redirect coming back from `github.com`. With `strict` the browser
does not send or retain the cookie on that cross site navigation, so the user lands on `/dashboard` and is
immediately bounced back to `/login`. `lax` is the correct value here: it still blocks the cookie on cross site
subrequests such as a form POST from another domain, but it allows it on a top level navigation, which is
exactly what the OAuth callback is.

### How OAuth login, JWT verification and protected API behaviour were verified

- Completed the full GitHub login in a browser on the deployed URL and confirmed the redirect to `/dashboard`.
- Opened DevTools, Application, Cookies, and confirmed the cookie is named `token` and shows `HttpOnly` and
  `Secure` ticked. Confirmed `document.cookie` in the console does not contain it.
- Ran the two required cURL checks against the deployed URL and got `401` for both.
- Ran `node scripts/smoke-test.js`, which additionally proves `401` for a token signed with a different secret,
  an expired token, a token with the wrong issuer, a token with the wrong audience, an unsigned `"alg": "none"`
  token, and a token whose payload was edited after signing.
- Confirmed `POST`, `PUT` and `DELETE` on `/api/capsules` also return `401` with no cookie and with
  `token=fake-token-123`.

### How CRUD behaviour and user data ownership were verified

- Performed CREATE, READ, UPDATE and DELETE through the deployed dashboard in the browser.
- Ran `scripts/smoke-test.js`, which signs two different test tokens for two different users and checks that:
  user B's list does not contain user A's records; user B reading, updating or deleting user A's record ID all
  return `404`; user A's record is untouched afterwards; a `user_id` supplied in the request body is ignored and
  the record is still owned by the JWT subject; a deleted record returns `404` afterwards.
- Ran `npm test`, which unit tests the validation layer, including that `user_id`, `id` and `created_at` sent by
  a client are discarded.
- Signed in from a second GitHub account and confirmed the dashboard showed an empty list rather than the first
  account's capsules.

### One implementation decision explained

**Serving React and Express from a single Render service and a single origin, rather than deploying the
frontend and backend separately.**

Two services would mean the browser sends the `token` cookie cross site. That requires `SameSite=None; Secure`
on the cookie, a CORS configuration with `credentials: true` and an explicit allowed origin, and it makes the
cookie a third party cookie, which browsers including Safari and Chrome's newer defaults restrict or block
outright. Sessions would then work in one browser and silently fail in another.

With one service, the app and the API are the same site. The cookie stays `SameSite=Lax`, no CORS middleware is
needed at all, and there is one URL for the marker to test. The cost is that a frontend change requires
rebuilding and redeploying the whole service, which is not a meaningful downside for an application this size.

Express serves `client/dist` as static files and falls back to `index.html` for any non `/api` path, so React
Router handles `/`, `/login` and `/dashboard` and a direct visit or refresh on `/dashboard` still works. The
fallback is registered after a JSON `404` handler for `/api`, so a mistyped API path returns JSON rather than
the HTML page.

---

## 11. One honest limitation

**Saved capsules do not survive a restart of the deployed application.** The Render free web service has a
temporary filesystem, so the SQLite database file at `data/capsules.db` is lost whenever the service restarts,
redeploys or wakes from sleep. The table is recreated automatically and the application continues to work
normally, but records created before the restart are gone.

This is a storage limitation, not an application logic limitation. The same code runs against a persistent
database by pointing `DATABASE_FILE` at a mounted Render persistent disk, or by replacing the `node:sqlite`
calls in `server/db.js` with a PostgreSQL client. The API contract, the authentication flow and the ownership
rules do not change.

A second, smaller limitation: the JWT lasts two hours and there is no refresh token, so a user who leaves the
dashboard open for longer is returned to the login page on their next action.

---

## 12. Security notes

- No secret value appears in this repository. `.env` is git ignored and only `.env.example`, which lists names
  with empty or placeholder values, is committed.
- The application refuses to start without `JWT_SECRET`. There is no fallback secret in the source.
- The JWT is stored only in a Secure, HttpOnly cookie. `localStorage`, `sessionStorage` and
  `Authorization: Bearer` headers are not used anywhere.
- The JWT algorithm is pinned to HS256 on verification, and issuer and audience are checked.
- The OAuth callback validates a `state` nonce.
- The GitHub access token is used once on the server and is never stored or sent to the browser.
- All SQL uses prepared statements with bound parameters.
- Route parameters are validated as positive integers before they reach the database.
- Request bodies are capped at 1 MB and every field has a length limit.
- `screenshot_url` must parse as an `http` or `https` URL, which blocks `javascript:` URLs.
