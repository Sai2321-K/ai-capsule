// guard: no valid session means no dashboard and no capsule data
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="centered">
        <div className="card">
          <p className="muted">Checking your session...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return children;
}
