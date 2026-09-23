// validation: pure functions, no dependencies, unit tested in test/validation.test.js

const FIELD_LIMITS = {
  project_name: 200,
  prompt_title: 200,
  prompt_version: 50,
  prompt_text: 20000,
  response_summary: 5000,
  category: 100,
  usefulness: 100,
  screenshot_url: 2000,
  notes: 5000,
};

const REQUIRED_FIELDS = ['project_name', 'prompt_title', 'prompt_text'];

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'y', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'n', 'off', '']);

// id: only positive integers, blocks path injection and NaN lookups
function parseId(raw) {
  const text = String(raw == null ? '' : raw).trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}

// text: strings pass through, numbers and booleans are coerced, objects are rejected
function readText(value, field, errors) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  errors.push({ field, message: `${field} must be text.` });
  return '';
}

// flag: accepts Yes/No, true/false, 1/0 and stores SQLite 0 or 1
function readFlag(value, field, errors) {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') {
    if (value === 0 || value === 1) return value;
    errors.push({ field, message: `${field} must be Yes or No.` });
    return 0;
  }
  if (typeof value === 'string') {
    const key = value.trim().toLowerCase();
    if (TRUE_VALUES.has(key)) return 1;
    if (FALSE_VALUES.has(key)) return 0;
  }
  errors.push({ field, message: `${field} must be Yes or No.` });
  return 0;
}

// url: optional, but when present it must be a real http(s) URL
function readUrl(value, field, errors) {
  const text = readText(value, field, errors);
  if (!text) return null;
  if (text.length > FIELD_LIMITS[field]) {
    errors.push({ field, message: `${field} must be ${FIELD_LIMITS[field]} characters or fewer.` });
    return null;
  }
  let parsed;
  try {
    parsed = new URL(text);
  } catch (err) {
    errors.push({ field, message: `${field} must be a valid http:// or https:// URL.` });
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    errors.push({ field, message: `${field} must be a valid http:// or https:// URL.` });
    return null;
  }
  return text;
}

function checkLength(value, field, errors) {
  if (value && value.length > FIELD_LIMITS[field]) {
    errors.push({ field, message: `${field} must be ${FIELD_LIMITS[field]} characters or fewer.` });
  }
  return value;
}

// normalize: builds the exact column set we write, client supplied id/user_id/created_at are ignored
function normalizeCapsuleInput(body) {
  const errors = [];
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {};

  const values = {
    project_name: checkLength(readText(source.project_name, 'project_name', errors), 'project_name', errors),
    prompt_title: checkLength(readText(source.prompt_title, 'prompt_title', errors), 'prompt_title', errors),
    prompt_version: checkLength(readText(source.prompt_version, 'prompt_version', errors), 'prompt_version', errors),
    prompt_text: checkLength(readText(source.prompt_text, 'prompt_text', errors), 'prompt_text', errors),
    response_summary: checkLength(readText(source.response_summary, 'response_summary', errors), 'response_summary', errors),
    category: checkLength(readText(source.category, 'category', errors), 'category', errors),
    usefulness: checkLength(readText(source.usefulness, 'usefulness', errors), 'usefulness', errors),
    reviewed: readFlag(source.reviewed, 'reviewed', errors),
    improved: readFlag(source.improved, 'improved', errors),
    screenshot_url: readUrl(source.screenshot_url, 'screenshot_url', errors),
    notes: checkLength(readText(source.notes, 'notes', errors), 'notes', errors),
  };

  for (const field of REQUIRED_FIELDS) {
    if (!values[field]) {
      errors.push({ field, message: `${field} is required.` });
    }
  }

  // optional text columns store NULL rather than empty string
  for (const field of ['prompt_version', 'response_summary', 'category', 'usefulness', 'notes']) {
    if (values[field] === '') values[field] = null;
  }

  return { values, errors };
}

module.exports = {
  FIELD_LIMITS,
  REQUIRED_FIELDS,
  parseId,
  readText,
  readFlag,
  readUrl,
  normalizeCapsuleInput,
};
