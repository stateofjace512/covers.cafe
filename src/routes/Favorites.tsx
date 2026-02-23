import FavoritesIcon from '../components/FavoritesIcon';
import { useAuth } from '../contexts/AuthContext';
import GalleryGrid from '../components/GalleryGrid';

export default function Favorites() {
  const { user, openAuthModal } = useAuth();

  return (
    <div>
      <h1 className="section-title">
        <FavoritesIcon size={22} />
        Favorites
      </h1>
      {user ? (
        <GalleryGrid filter="favorites" />
      ) : (
        <div className="empty-state card">
          <FavoritesIcon size={48} style={{ opacity: 0.25, marginBottom: 14 }} />
          <h2 className="empty-title">Sign in to see your favorites</h2>
          <p className="empty-body">FavoritesIcon album covers from the gallery to save them here.</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn btn-primary" onClick={() => openAuthModal('login')}>Sign In</button>
            <button className="btn btn-secondary" onClick={() => openAuthModal('register')}>Create Account</button>
          </div>
        </div>
      )}
      <style>{`
        .empty-state { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 40px; max-width: 440px; }
        .empty-title { font-size: 20px; font-weight: bold; color: var(--body-text); margin-bottom: 10px; }
        .empty-body { font-size: 17px; color: var(--body-text-muted); line-height: 1.6; }
      `}</style>
    </div>
  );
}
