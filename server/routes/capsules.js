// capsules: full CRUD, every route protected and scoped to the JWT owner
const express = require('express');
const { db } = require('../db');
const requireAuth = require('../middleware/require-auth');
const { parseId, normalizeCapsuleInput } = require('../validation');

const router = express.Router();

// spec 9: GET, POST, PUT and DELETE all run through the JWT middleware
router.use(requireAuth);

const COLUMNS = `id, user_id, project_name, prompt_title, prompt_version, prompt_text,
  response_summary, category, usefulness, reviewed, improved, screenshot_url, notes, created_at`;

function invalidId(res) {
  return res.status(400).json({ error: 'invalid_id', message: 'Capsule id must be a positive integer.' });
}

function notFound(res) {
  // 404 rather than 403 so one user cannot probe whether another user's id exists
  return res.status(404).json({ error: 'not_found', message: 'Capsule not found for this user.' });
}

function validationFailed(res, errors) {
  return res.status(400).json({ error: 'validation_failed', message: 'Some fields are invalid.', details: errors });
}

// READ all: only rows owned by the verified JWT subject
router.get('/', (req, res) => {
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM capsules WHERE user_id = ? ORDER BY datetime(created_at) DESC, id DESC`)
    .all(req.user.id);
  res.json(rows);
});

// READ one: owner scoped
router.get('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return invalidId(res);
  const row = db.prepare(`SELECT ${COLUMNS} FROM capsules WHERE id = ? AND user_id = ?`).get(id, req.user.id);
  if (!row) return notFound(res);
  res.json(row);
});

// CREATE: owner is taken from the JWT, never from the request body
router.post('/', (req, res) => {
  const { values, errors } = normalizeCapsuleInput(req.body);
  if (errors.length) return validationFailed(res, errors);

  const info = db
    .prepare(
      `INSERT INTO capsules
        (user_id, project_name, prompt_title, prompt_version, prompt_text, response_summary,
         category, usefulness, reviewed, improved, screenshot_url, notes)
       VALUES
        (@user_id, @project_name, @prompt_title, @prompt_version, @prompt_text, @response_summary,
         @category, @usefulness, @reviewed, @improved, @screenshot_url, @notes)`
    )
    .run({ ...values, user_id: req.user.id });

  const row = db.prepare(`SELECT ${COLUMNS} FROM capsules WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json(row);
});

// UPDATE: the WHERE clause carries user_id, so another user's row can never match
router.put('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return invalidId(res);

  const { values, errors } = normalizeCapsuleInput(req.body);
  if (errors.length) return validationFailed(res, errors);

  const result = db
    .prepare(
      `UPDATE capsules SET
         project_name = @project_name,
         prompt_title = @prompt_title,
         prompt_version = @prompt_version,
         prompt_text = @prompt_text,
         response_summary = @response_summary,
         category = @category,
         usefulness = @usefulness,
         reviewed = @reviewed,
         improved = @improved,
         screenshot_url = @screenshot_url,
         notes = @notes
       WHERE id = @id AND user_id = @user_id`
    )
    .run({ ...values, id, user_id: req.user.id });

  if (result.changes === 0) return notFound(res);

  const row = db.prepare(`SELECT ${COLUMNS} FROM capsules WHERE id = ? AND user_id = ?`).get(id, req.user.id);
  res.json(row);
});

// DELETE: same ownership guard
router.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return invalidId(res);

  const result = db.prepare('DELETE FROM capsules WHERE id = ? AND user_id = ?').run(id, req.user.id);
  if (result.changes === 0) return notFound(res);

  res.json({ deleted: true, id });
});

module.exports = router;
