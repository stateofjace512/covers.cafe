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

      
    </div>
  );
}
