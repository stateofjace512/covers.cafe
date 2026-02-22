import { useSearchParams } from 'react-router-dom';
import { Image, ArrowUpFromLine } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import GalleryGrid from '../components/GalleryGrid';

export default function Gallery() {
  const { user, openAuthModal } = useAuth();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q');

  return (
    <div>
      {/* Hero — only show when no search */}
      {!searchQuery && (
        <div className="hero-banner">
          <div className="hero-content">
            <h1 className="hero-title">Discover Album Art</h1>
            <p className="hero-subtitle">
              A community-driven gallery for album cover art — created, collected, and shared by music lovers.
            </p>
            <div className="hero-actions">
              {user ? (
                <a href="/upload" className="btn btn-primary" onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/upload'); window.dispatchEvent(new PopStateEvent('popstate')); }}>
                  <ArrowUpFromLine size={15} />
                  Upload a Cover
                </a>
              ) : (
                <button className="btn btn-primary" onClick={() => openAuthModal('register')}>
                  <ArrowUpFromLine size={15} />
                  Join &amp; Upload
                </button>
              )}
            </div>
          </div>
          <div className="hero-badge-strip">
            <span className="badge">New</span>
            <span className="badge">Community</span>
            <span className="badge">Free</span>
          </div>
        </div>
      )}

      <section>
        <h2 className="section-title">
          <Image size={20} />
          {searchQuery ? `Results for "${searchQuery}"` : 'Recent Covers'}
        </h2>
        <GalleryGrid filter="all" />
      </section>

      <style>{`
        .hero-banner {
          background: linear-gradient(135deg, var(--header-bg) 0%, var(--sidebar-bg-dark) 60%, var(--header-bg-dark) 100%);
          border: 1px solid var(--body-card-border); border-radius: 8px;
          padding: 32px 32px 0; margin-bottom: 32px;
          box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.12);
          position: relative; overflow: hidden;
        }
        .hero-banner::before {
          content: ''; position: absolute; inset: 0;
          background:
            repeating-linear-gradient(
              135deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px,
              transparent 1px, transparent 20px
            );
          pointer-events: none;
        }
        .hero-content { position: relative; z-index: 1; max-width: 520px; }
        .hero-title {
          font-size: 32px; font-weight: bold; color: #fff8f0;
          text-shadow: 0 2px 6px rgba(0,0,0,0.5); margin-bottom: 10px; letter-spacing: -0.5px;
        }
        .hero-subtitle {
          font-size: 15px; color: rgba(255,248,240,0.75);
          margin-bottom: 22px; line-height: 1.6; text-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        .hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }
        .hero-badge-strip {
          position: relative; z-index: 1;
          display: flex; gap: 8px;
          padding: 14px 0 16px;
          border-top: 1px solid rgba(255,255,255,0.1); margin-top: 24px;
        }
      `}</style>
    </div>
  );
}
