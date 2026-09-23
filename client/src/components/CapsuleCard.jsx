// card: shows every stored field so the video can prove the record model
function formatDate(value) {
  if (!value) return 'unknown';
  // sqlite CURRENT_TIMESTAMP is "YYYY-MM-DD HH:MM:SS" in UTC
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function YesNo({ value }) {
  const yes = Number(value) === 1;
  return <span className={`pill ${yes ? 'pill-yes' : 'pill-no'}`}>{yes ? 'Yes' : 'No'}</span>;
}

export default function CapsuleCard({ capsule, onEdit, onDelete, confirming, onConfirmDelete, onCancelDelete, busy }) {
  return (
    <article className="card capsule">
      <header className="capsule-head">
        <div>
          <h3>{capsule.prompt_title}</h3>
          <p className="muted small">
            #{capsule.id} · {capsule.project_name}
            {capsule.prompt_version ? ` · ${capsule.prompt_version}` : ''}
          </p>
        </div>
        <div className="tags">
          {capsule.category && <span className="tag">{capsule.category}</span>}
          {capsule.usefulness && <span className="tag alt">{capsule.usefulness}</span>}
        </div>
      </header>

      <div className="block">
        <span className="label">Prompt</span>
        <pre className="prompt">{capsule.prompt_text}</pre>
      </div>

      {capsule.response_summary && (
        <div className="block">
          <span className="label">Response summary</span>
          <p>{capsule.response_summary}</p>
        </div>
      )}

      {capsule.notes && (
        <div className="block">
          <span className="label">Notes</span>
          <p>{capsule.notes}</p>
        </div>
      )}

      <div className="meta">
        <span>
          Reviewed <YesNo value={capsule.reviewed} />
        </span>
        <span>
          Improved <YesNo value={capsule.improved} />
        </span>
        {capsule.screenshot_url && (
          <a href={capsule.screenshot_url} target="_blank" rel="noreferrer">
            Screenshot evidence
          </a>
        )}
        <span className="muted small">Created {formatDate(capsule.created_at)}</span>
      </div>

      <footer className="row gap">
        {confirming ? (
          <>
            <span className="muted small">Delete this capsule?</span>
            <button type="button" className="btn danger" onClick={onConfirmDelete} disabled={busy}>
              {busy ? 'Deleting...' : 'Yes, delete'}
            </button>
            <button type="button" className="btn" onClick={onCancelDelete} disabled={busy}>
              Keep it
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={onEdit}>
              Edit
            </button>
            <button type="button" className="btn danger-outline" onClick={onDelete}>
              Delete
            </button>
          </>
        )}
      </footer>
    </article>
  );
}
