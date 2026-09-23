// public login page, starts the OAuth flow on the Express backend
import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useAuth } from '../auth.jsx';

const ERROR_TEXT = {
  access_denied: 'You cancelled the GitHub sign in.',
  invalid_state: 'The login request expired or did not match. Please try again.',
  missing_code: 'GitHub did not return an authorization code. Please try again.',
  token_exchange_failed: 'The server could not exchange the GitHub code for a token.',
  profile_fetch_failed: 'The server could not read your GitHub profile.',
  oauth_not_configured: 'GitHub OAuth is not configured on the server.',
};

export default function Login() {
  const { user, loading, logout } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const errorCode = params.get('error');

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="page">
      <Header user={user} onLogout={logout} />

      <div className="centered">
        <div className="card login">
          <h1>Sign in</h1>
          <p className="muted">
            AI Capsule uses GitHub OAuth. After GitHub confirms who you are, this application issues its own session
            token and stores it in a secure cookie.
          </p>

          {errorCode && (
            <div className="alert error">
              {ERROR_TEXT[errorCode] || `Sign in failed (${errorCode}).`}
            </div>
          )}

          {/* full page navigation, not fetch, because the OAuth flow is a browser redirect */}
          <a className="btn primary big full" href="/api/auth/github">
            Continue with GitHub
          </a>

          <p className="muted small">
            We only read your public GitHub profile. Your GitHub access token never leaves the server and is never
            stored.
          </p>
          <Link to="/" className="muted small">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
