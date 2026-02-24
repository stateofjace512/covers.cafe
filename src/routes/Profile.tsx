import { useNavigate } from 'react-router-dom';
import UserIcon from '../components/UserIcon';
import GearIcon from '../components/GearIcon';
import { useAuth } from '../contexts/AuthContext';
import GalleryGrid from '../components/GalleryGrid';
import AchievementBadges from '../components/AchievementBadges';
import { getAvatarSrc } from '../lib/media';

export default function Profile() {
  const { user, profile, openAuthModal } = useAuth();
  const navigate = useNavigate();

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
        <style>{` .empty-state { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 40px; max-width: 440px; } .empty-title { font-size: 23px; color: var(--body-text); margin-bottom: 10px; } .empty-body { font-size: 20px; color: var(--body-text-muted); line-height: 1.6; } `}</style>
      </div>
    );
  }

  return (
    <div>
      <div className="profile-card card">
        <div className="profile-header">
          <div className="profile-avatar">
            {profile && getAvatarSrc(profile)
              ? <img src={getAvatarSrc(profile)!} alt="avatar" className="profile-avatar-img" />
              : <UserIcon size={40} style={{ opacity: 0.4 }} />
            }
          </div>
          <div className="profile-info">
            <h1 className="profile-name">{profile?.display_name ?? profile?.username ?? user.email?.split('@')[0]}</h1>
            {profile?.username && <p className="profile-username">@{profile.username}</p>}
            {profile?.bio && <p className="profile-bio">{profile.bio}</p>}
            {profile?.website && <a href={profile.website} className="profile-website" target="_blank" rel="noopener noreferrer">{profile.website}</a>}
          </div>
          <button className="btn btn-secondary profile-edit-btn" onClick={() => navigate('/profile/edit')}>
            <GearIcon size={14} /> Edit Profile
          </button>
        </div>

        {/* Achievements */}
        <AchievementBadges userId={user.id} />
      </div>

      <section style={{ marginTop: 28 }}>
        <h2 className="section-title"><UserIcon size={20} /> My Uploads</h2>
        <GalleryGrid filter="mine" />
      </section>

      <style>{`
        .profile-card { max-width: 640px; }
        .profile-header { display: flex; align-items: flex-start; gap: 18px; flex-wrap: wrap; }

        .profile-info { flex: 1; min-width: 0; }
        
        .profile-name {
          font-size: 25px;
          color: var(--body-text);
        }
        
        .profile-avatar {
          width: 80px;
          height: 80px;
          border-radius: 0;
          flex-shrink: 0;
        
          background: #c07f55;
          border: 2px solid;
          border-color: #c07f55 #ffffff #ffffff #c07f55;
        
          box-shadow: none;
          display: flex;
          align-items: center;
          justify-content: center;
        
          color: #dea77d;
          overflow: hidden;
        }
        
        .profile-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        [data-theme="dark"] .profile-name { }
        .profile-username { font-size: 19px; color: var(--body-text-muted); margin-top: 2px; }
        .profile-bio { font-size: 20px; color: var(--body-text); margin-top: 8px; line-height: 1.5; }
        .profile-website { font-size: 19px; color: var(--accent); margin-top: 6px; display: block; }
        .profile-edit-btn { flex-shrink: 0; display: flex; align-items: center; gap: 6px; }
      `}</style>
    </div>
  );
}
