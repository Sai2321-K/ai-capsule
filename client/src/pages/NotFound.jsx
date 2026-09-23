import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page">
      <div className="centered">
        <div className="card">
          <h1>Page not found</h1>
          <p className="muted">That page does not exist.</p>
          <Link className="btn primary" to="/">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
