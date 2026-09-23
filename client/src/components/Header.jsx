import { Link } from 'react-router-dom';

export default function Header({ user, onLogout }) {
  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <span className="brand-mark">AC</span>
        <span>AI Capsule</span>
      </Link>
      {user ? (
        <div className="row gap center">
          {user.avatar_url && <img className="avatar" src={user.avatar_url} alt="" />}
          <span className="muted small">{user.name || user.login}</span>
          <button type="button" className="btn" onClick={onLogout}>
            Log out
          </button>
        </div>
      ) : (
        <Link to="/login" className="btn primary">
          Sign in
        </Link>
      )}
    </header>
  );
}
