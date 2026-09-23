// protected dashboard: CREATE, READ, UPDATE and DELETE against /api/capsules
import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '../components/Header.jsx';
import CapsuleForm from '../components/CapsuleForm.jsx';
import CapsuleCard from '../components/CapsuleCard.jsx';
import { useAuth } from '../auth.jsx';
import api from '../api';

export default function Dashboard() {
  const { user, logout, refresh } = useAuth();

  const [capsules, setCapsules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState([]);

  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [query, setQuery] = useState('');

  // 401 at any point means the session is gone, send the user back to login
  const handleError = useCallback(
    (err) => {
      if (err && err.status === 401) {
        refresh();
        return;
      }
      setError(err && err.message ? err.message : 'Something went wrong.');
    },
    [refresh]
  );

  // READ
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/api/capsules');
      setCapsules(Array.isArray(data) ? data : []);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function openCreate() {
    setEditing(null);
    setFieldErrors([]);
    setFormOpen(true);
  }

  function openEdit(capsule) {
    setEditing(capsule);
    setFieldErrors([]);
    setFormOpen(true);
    setConfirmId(null);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setFieldErrors([]);
  }

  // CREATE and UPDATE
  async function handleSubmit(values) {
    setSaving(true);
    setError(null);
    setFieldErrors([]);
    try {
      if (editing) {
        const updated = await api.put(`/api/capsules/${editing.id}`, values);
        setCapsules((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setNotice(`Capsule #${updated.id} updated.`);
      } else {
        const created = await api.post('/api/capsules', values);
        setCapsules((current) => [created, ...current]);
        setNotice(`Capsule #${created.id} created.`);
      }
      closeForm();
    } catch (err) {
      if (err && err.status === 400 && err.details) {
        setFieldErrors(err.details);
        setError('Please fix the highlighted fields.');
      } else {
        handleError(err);
      }
    } finally {
      setSaving(false);
    }
  }

  // DELETE
  async function handleDelete(id) {
    setDeletingId(id);
    setError(null);
    try {
      await api.del(`/api/capsules/${id}`);
      setCapsules((current) => current.filter((item) => item.id !== id));
      setNotice(`Capsule #${id} deleted.`);
      setConfirmId(null);
    } catch (err) {
      handleError(err);
    } finally {
      setDeletingId(null);
    }
  }

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return capsules;
    return capsules.filter((item) =>
      [item.prompt_title, item.project_name, item.prompt_text, item.category, item.notes]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [capsules, query]);

  return (
    <div className="page">
      <Header user={user} onLogout={logout} />

      <section className="dash-head">
        <div>
          <h1>Your capsules</h1>
          <p className="muted small">
            Signed in as {user && (user.name || user.login)} · {capsules.length}{' '}
            {capsules.length === 1 ? 'record' : 'records'}
          </p>
        </div>
        <div className="row gap center">
          <input
            className="search"
            type="search"
            placeholder="Filter your capsules"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="btn primary" onClick={openCreate}>
            New capsule
          </button>
          <button type="button" className="btn" onClick={load} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </section>

      {notice && <div className="alert success">{notice}</div>}
      {error && <div className="alert error">{error}</div>}

      {formOpen && (
        <CapsuleForm
          capsule={editing}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          busy={saving}
          serverErrors={fieldErrors}
        />
      )}

      {loading && <p className="muted">Loading your capsules...</p>}

      {!loading && capsules.length === 0 && (
        <div className="card empty">
          <h3>No capsules yet</h3>
          <p className="muted">Create your first record to start your prompt library.</p>
          <button type="button" className="btn primary" onClick={openCreate}>
            Create a capsule
          </button>
        </div>
      )}

      {!loading && capsules.length > 0 && visible.length === 0 && (
        <p className="muted">No capsule matches that filter.</p>
      )}

      <div className="list">
        {visible.map((capsule) => (
          <CapsuleCard
            key={capsule.id}
            capsule={capsule}
            onEdit={() => openEdit(capsule)}
            onDelete={() => setConfirmId(capsule.id)}
            confirming={confirmId === capsule.id}
            onConfirmDelete={() => handleDelete(capsule.id)}
            onCancelDelete={() => setConfirmId(null)}
            busy={deletingId === capsule.id}
          />
        ))}
      </div>
    </div>
  );
}
