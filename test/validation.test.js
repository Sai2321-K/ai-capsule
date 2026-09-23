// unit tests for the pure validation layer, run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const { parseId, readFlag, readUrl, normalizeCapsuleInput } = require('../server/validation');

const VALID = {
  project_name: 'SmartFarm Irrigation',
  prompt_title: 'Debug cloud deployment',
  prompt_text: 'Why does my Node server fail to start?',
};

test('parseId accepts positive integers only', () => {
  assert.strictEqual(parseId('1'), 1);
  assert.strictEqual(parseId(' 42 '), 42);
  assert.strictEqual(parseId('0'), null);
  assert.strictEqual(parseId('-3'), null);
  assert.strictEqual(parseId('1.5'), null);
  assert.strictEqual(parseId('abc'), null);
  assert.strictEqual(parseId('1; DROP TABLE capsules'), null);
  assert.strictEqual(parseId(undefined), null);
  assert.strictEqual(parseId('99999999999999999999'), null);
});

test('readFlag maps Yes/No, booleans and 1/0 to SQLite integers', () => {
  const errors = [];
  assert.strictEqual(readFlag('Yes', 'reviewed', errors), 1);
  assert.strictEqual(readFlag('no', 'reviewed', errors), 0);
  assert.strictEqual(readFlag(true, 'reviewed', errors), 1);
  assert.strictEqual(readFlag(false, 'reviewed', errors), 0);
  assert.strictEqual(readFlag(1, 'reviewed', errors), 1);
  assert.strictEqual(readFlag(0, 'reviewed', errors), 0);
  assert.strictEqual(readFlag(undefined, 'reviewed', errors), 0);
  assert.strictEqual(errors.length, 0);
  readFlag('maybe', 'reviewed', errors);
  assert.strictEqual(errors.length, 1);
});

test('readUrl rejects anything that is not http or https', () => {
  const errors = [];
  assert.strictEqual(readUrl('https://example.com/a.png', 'screenshot_url', errors), 'https://example.com/a.png');
  assert.strictEqual(readUrl('', 'screenshot_url', errors), null);
  assert.strictEqual(errors.length, 0);
  readUrl('javascript:alert(1)', 'screenshot_url', errors);
  readUrl('not a url', 'screenshot_url', errors);
  assert.strictEqual(errors.length, 2);
});

test('required fields are enforced', () => {
  const { errors } = normalizeCapsuleInput({});
  const fields = errors.map((e) => e.field).sort();
  assert.deepStrictEqual(fields, ['project_name', 'prompt_text', 'prompt_title']);
});

test('whitespace only values count as missing', () => {
  const { errors } = normalizeCapsuleInput({ ...VALID, prompt_title: '    ' });
  assert.ok(errors.some((e) => e.field === 'prompt_title'));
});

test('client supplied user_id, id and created_at are ignored', () => {
  const { values, errors } = normalizeCapsuleInput({
    ...VALID,
    user_id: 'someone-else',
    id: 999,
    created_at: '1999-01-01 00:00:00',
  });
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(values.user_id, undefined);
  assert.strictEqual(values.id, undefined);
  assert.strictEqual(values.created_at, undefined);
});

test('optional text columns become null, not empty string', () => {
  const { values } = normalizeCapsuleInput(VALID);
  assert.strictEqual(values.prompt_version, null);
  assert.strictEqual(values.response_summary, null);
  assert.strictEqual(values.category, null);
  assert.strictEqual(values.usefulness, null);
  assert.strictEqual(values.notes, null);
  assert.strictEqual(values.screenshot_url, null);
  assert.strictEqual(values.reviewed, 0);
  assert.strictEqual(values.improved, 0);
});

test('over long values are rejected', () => {
  const { errors } = normalizeCapsuleInput({ ...VALID, project_name: 'x'.repeat(201) });
  assert.ok(errors.some((e) => e.field === 'project_name'));
});

test('object values are rejected instead of being stringified', () => {
  const { errors } = normalizeCapsuleInput({ ...VALID, notes: { evil: true } });
  assert.ok(errors.some((e) => e.field === 'notes'));
});

test('a non object body does not throw', () => {
  const { errors } = normalizeCapsuleInput(null);
  assert.ok(errors.length >= 3);
  const fromArray = normalizeCapsuleInput([1, 2, 3]);
  assert.ok(fromArray.errors.length >= 3);
});

test('a fully populated record normalizes cleanly', () => {
  const { values, errors } = normalizeCapsuleInput({
    project_name: ' SmartFarm ',
    prompt_title: ' Debug ',
    prompt_version: 'v2',
    prompt_text: ' Why does it fail? ',
    response_summary: 'Check start command',
    category: 'Coding',
    usefulness: 'Good',
    reviewed: 'Yes',
    improved: 'No',
    screenshot_url: 'https://example.com/s.png',
    notes: 'Tested and worked',
  });
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(values.project_name, 'SmartFarm');
  assert.strictEqual(values.prompt_text, 'Why does it fail?');
  assert.strictEqual(values.reviewed, 1);
  assert.strictEqual(values.improved, 0);
});

test('the normalized key set exactly matches the SQL bind parameters', () => {
  // guards against node:sqlite unknown named parameter errors and silent NULL binds
  const { values } = normalizeCapsuleInput(VALID);
  assert.deepStrictEqual(Object.keys(values).sort(), [
    'category',
    'improved',
    'notes',
    'project_name',
    'prompt_text',
    'prompt_title',
    'prompt_version',
    'response_summary',
    'reviewed',
    'screenshot_url',
    'usefulness',
  ]);
});

test('flags are always numbers, never booleans, for SQLite binding', () => {
  const { values } = normalizeCapsuleInput({ ...VALID, reviewed: true, improved: false });
  assert.strictEqual(typeof values.reviewed, 'number');
  assert.strictEqual(typeof values.improved, 'number');
});
