// public landing page, explains AI Capsule
import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useAuth } from '../auth.jsx';

export default function Landing() {
  const { user, logout } = useAuth();

  return (
    <div className="page">
      <Header user={user} onLogout={logout} />

      <section className="hero">
        <h1>Your prompts, kept and improved.</h1>
        <p className="lead">
          AI Capsule is a private prompt library. Save the prompts that actually worked, record what the model
          answered, rate how useful it was, and come back to improve it next time.
        </p>
        <div className="row gap">
          {user ? (
            <Link to="/dashboard" className="btn primary big">
              Open my dashboard
            </Link>
          ) : (
            <Link to="/login" className="btn primary big">
              Sign in with GitHub
            </Link>
          )}
          <a className="btn big" href="/api/health" target="_blank" rel="noreferrer">
            Check API health
          </a>
        </div>
      </section>

      <section className="features">
        <div className="card feature">
          <h3>Keep every useful prompt</h3>
          <p>Store the project, title, version, prompt text and a summary of the response in one record.</p>
        </div>
        <div className="card feature">
          <h3>Review and improve</h3>
          <p>Mark a prompt as reviewed or improved, rate its usefulness and attach screenshot evidence.</p>
        </div>
        <div className="card feature">
          <h3>Private to you</h3>
          <p>
            Sign in with GitHub. The server issues its own session token and every capsule route only ever returns
            your own records.
          </p>
        </div>
      </section>

      <footer className="foot muted small">
        AI Capsule · CSE5006 Assignment 3 · React, Node/Express, SQLite, GitHub OAuth, JWT
      </footer>
    </div>
  );
}
