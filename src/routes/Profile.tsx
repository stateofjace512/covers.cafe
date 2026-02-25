import { Navigate } from 'react-router-dom';
import UserIcon from '../components/UserIcon';
import { useAuth } from '../contexts/AuthContext';

export default function Profile() {
  const { user, profile, openAuthModal } = useAuth();

  if (!user) {
    return (
      <div>
        <h1 className="section-title"><UserIcon size={22} /> Profile</h1>
        <div className="empty-state card">
          <UserIcon size={48} style={{ opacity: 0.25, marginBottom: 14 }} />
          <h2 className="empty-title">Sign in to view your profile</h2>
          <p className="empty-body">Your uploads and stats will appear here.</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn btn-primary" onClick={() => openAuthModal('login')}>Sign In</button>
            <button className="btn btn-secondary" onClick={() => openAuthModal('register')}>Create Account</button>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to the full user profile view so owners see exactly what others see
  if (profile?.username) {
    return <Navigate to={'/users/' + profile.username} replace />;
  }

  // Fallback while profile loads
  return <p className="text-muted">Loading…</p>;
}
