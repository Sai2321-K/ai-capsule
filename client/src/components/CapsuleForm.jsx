// form: one component used for both CREATE and UPDATE
import { useEffect, useState } from 'react';

const CATEGORIES = ['Coding', 'Writing', 'Research', 'Debugging', 'Study', 'Other'];
const USEFULNESS = ['Good', 'Needs Improvement'];

const EMPTY = {
  project_name: '',
  prompt_title: '',
  prompt_version: '',
  prompt_text: '',
  response_summary: '',
  category: 'Coding',
  usefulness: 'Good',
  reviewed: false,
  improved: false,
  screenshot_url: '',
  notes: '',
};

function toFormValues(capsule) {
  if (!capsule) return { ...EMPTY };
  return {
    project_name: capsule.project_name || '',
    prompt_title: capsule.prompt_title || '',
    prompt_version: capsule.prompt_version || '',
    prompt_text: capsule.prompt_text || '',
    response_summary: capsule.response_summary || '',
    category: capsule.category || 'Coding',
    usefulness: capsule.usefulness || 'Good',
    reviewed: Number(capsule.reviewed) === 1,
    improved: Number(capsule.improved) === 1,
    screenshot_url: capsule.screenshot_url || '',
    notes: capsule.notes || '',
  };
}

export default function CapsuleForm({ capsule, onSubmit, onCancel, busy, serverErrors }) {
  const [values, setValues] = useState(() => toFormValues(capsule));
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setValues(toFormValues(capsule));
    setTouched(false);
  }, [capsule]);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  const missing = {
    project_name: !values.project_name.trim(),
    prompt_title: !values.prompt_title.trim(),
    prompt_text: !values.prompt_text.trim(),
  };
  const hasMissing = Object.values(missing).some(Boolean);

  function handleSubmit(event) {
    event.preventDefault();
    setTouched(true);
    if (hasMissing) return;
    onSubmit({
      ...values,
      reviewed: values.reviewed ? 1 : 0,
      improved: values.improved ? 1 : 0,
    });
  }

  function errorFor(field) {
    const fromServer = (serverErrors || []).find((item) => item.field === field);
    if (fromServer) return fromServer.message;
    if (touched && missing[field]) return 'This field is required.';
    return null;
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <h2>{capsule ? `Edit capsule #${capsule.id}` : 'New capsule'}</h2>

      <div className="grid-2">
        <label>
          <span>Project name *</span>
          <input
            type="text"
            value={values.project_name}
            onChange={(e) => update('project_name', e.target.value)}
            placeholder="SmartFarm Irrigation"
            maxLength={200}
          />
          {errorFor('project_name') && <em className="field-error">{errorFor('project_name')}</em>}
        </label>

        <label>
          <span>Prompt title *</span>
          <input
            type="text"
            value={values.prompt_title}
            onChange={(e) => update('prompt_title', e.target.value)}
            placeholder="Debug cloud deployment"
            maxLength={200}
          />
          {errorFor('prompt_title') && <em className="field-error">{errorFor('prompt_title')}</em>}
        </label>

        <label>
          <span>Prompt version</span>
          <input
            type="text"
            value={values.prompt_version}
            onChange={(e) => update('prompt_version', e.target.value)}
            placeholder="v1"
            maxLength={50}
          />
        </label>

        <label>
          <span>Category</span>
          <select value={values.category} onChange={(e) => update('category', e.target.value)}>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <span>Prompt text *</span>
        <textarea
          rows={5}
          value={values.prompt_text}
          onChange={(e) => update('prompt_text', e.target.value)}
          placeholder="Why does my Node server fail to start on Render?"
          maxLength={20000}
        />
        {errorFor('prompt_text') && <em className="field-error">{errorFor('prompt_text')}</em>}
      </label>

      <label>
        <span>Response summary</span>
        <textarea
          rows={3}
          value={values.response_summary}
          onChange={(e) => update('response_summary', e.target.value)}
          placeholder="Check the start command and the PORT variable."
          maxLength={5000}
        />
      </label>

      <div className="grid-2">
        <label>
          <span>Usefulness</span>
          <select value={values.usefulness} onChange={(e) => update('usefulness', e.target.value)}>
            {USEFULNESS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Screenshot evidence URL</span>
          <input
            type="url"
            value={values.screenshot_url}
            onChange={(e) => update('screenshot_url', e.target.value)}
            placeholder="https://example.com/screenshot.png"
            maxLength={2000}
          />
          {errorFor('screenshot_url') && <em className="field-error">{errorFor('screenshot_url')}</em>}
        </label>
      </div>

      <label>
        <span>Notes</span>
        <textarea
          rows={2}
          value={values.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Tested and worked."
          maxLength={5000}
        />
      </label>

      <div className="checks">
        <label className="check">
          <input type="checkbox" checked={values.reviewed} onChange={(e) => update('reviewed', e.target.checked)} />
          <span>Reviewed</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={values.improved} onChange={(e) => update('improved', e.target.checked)} />
          <span>Improved</span>
        </label>
      </div>

      <div className="row gap">
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Saving...' : capsule ? 'Save changes' : 'Create capsule'}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
