import { useNavigate } from 'react-router-dom';
import { User, UserRoundCog } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import GalleryGrid from '../components/GalleryGrid';

export default function Profile() {
  const { user, profile, openAuthModal } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div>
        <h1 className="section-title"><User size={22} /> Profile</h1>
        <div className="empty-state card">
          <User size={48} style={{ opacity: 0.25, marginBottom: 14 }} />
          <h2 className="empty-title">Sign in to view your profile</h2>
          <p className="empty-body">Your uploads and stats will appear here.</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn btn-primary" onClick={() => openAuthModal('login')}>Sign In</button>
            <button className="btn btn-secondary" onClick={() => openAuthModal('register')}>Create Account</button>
          </div>
        </div>
        <style>{` .empty-state { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 40px; max-width: 440px; } .empty-title { font-size: 20px; font-weight: bold; color: var(--body-text); margin-bottom: 10px; } .empty-body { font-size: 14px; color: var(--body-text-muted); line-height: 1.6; } `}</style>
      </div>
    );
  }

  return (
    <div>
      <div className="profile-card card">
        <div className="profile-header">
          <div className="profile-avatar">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" className="profile-avatar-img" />
              : <User size={40} style={{ opacity: 0.4 }} />
            }
          </div>
          <div className="profile-info">
            <h1 className="profile-name">{profile?.display_name ?? profile?.username ?? user.email?.split('@')[0]}</h1>
            {profile?.username && <p className="profile-username">@{profile.username}</p>}
            {profile?.bio && <p className="profile-bio">{profile.bio}</p>}
            {profile?.website && <a href={profile.website} className="profile-website" target="_blank" rel="noopener noreferrer">{profile.website}</a>}
          </div>
          <button className="btn btn-secondary profile-edit-btn" onClick={() => navigate('/profile/edit')}>
            <UserRoundCog size={14} /> Edit Profile
          </button>
        </div>
      </div>

      <section style={{ marginTop: 28 }}>
        <h2 className="section-title"><User size={20} /> My Uploads</h2>
        <GalleryGrid filter="mine" />
      </section>

      <style>{`
        .profile-card { max-width: 640px; }
        .profile-header { display: flex; align-items: flex-start; gap: 18px; flex-wrap: wrap; }
        .profile-avatar {
          width: 80px; height: 80px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(145deg, var(--sidebar-bg-light), var(--sidebar-bg-dark));
          border: 3px solid var(--body-card-border);
          box-shadow: var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; color: var(--body-text-muted);
        }
        .profile-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .profile-info { flex: 1; min-width: 0; }
        .profile-name {
          font-size: 22px; font-weight: bold; color: var(--body-text);
          text-shadow: 0 1px 0 rgba(255,255,255,0.4);
        }
        [data-theme="dark"] .profile-name { text-shadow: none; }
        .profile-username { font-size: 13px; color: var(--body-text-muted); margin-top: 2px; }
        .profile-bio { font-size: 14px; color: var(--body-text); margin-top: 8px; line-height: 1.5; }
        .profile-website { font-size: 13px; color: var(--accent); margin-top: 6px; display: block; }
        .profile-edit-btn { flex-shrink: 0; display: flex; align-items: center; gap: 6px; }
      `}</style>
    </div>
  );
}
