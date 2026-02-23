import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import GalleryIcon from '../components/GalleryIcon';
import UploadDownloadIcon from '../components/UploadDownloadIcon';
import FavoritesIcon from '../components/FavoritesIcon';
import TrophyIcon from '../components/TrophyIcon';
import DiamondIcon from '../components/DiamondIcon';
import { useAuth } from '../contexts/AuthContext';
import GalleryGrid from '../components/GalleryGrid';
import CoffeeCupIcon from '../components/CoffeeCupIcon';
import OfficialGallery from '../components/OfficialGallery';
import OfficialSearchResults from '../components/OfficialSearchResults';

export type GalleryTab = 'new' | 'top_rated' | 'acotw' | 'official';

const TABS: { id: GalleryTab; label: string; icon: React.ReactNode; title: string }[] = [
  { id: 'new',       label: 'New',       icon: <DiamondIcon size={13} />,    title: 'Recent Covers' },
  { id: 'top_rated', label: 'Top Rated', icon: <FavoritesIcon size={13} />, title: 'Top Rated' },
  { id: 'acotw',     label: 'ACOTW',     icon: <TrophyIcon size={13} />,    title: 'Album Cover Of The Week' },
  { id: 'official',  label: 'Official',  icon: <GalleryIcon size={13} />,   title: 'Official Covers' },
];

export default function Gallery() {
  const { user, openAuthModal } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchQuery = searchParams.get('q');
  const searchSource = searchParams.get('source') === 'official' ? 'official' : 'fan';
  const [activeTab, setActiveTab] = useState<GalleryTab>('new');

  const activeTitle = TABS.find((t) => t.id === activeTab)?.title ?? 'Recent Covers';

  return (
    <div>
      {/* Hero — only show when no search */}
      {!searchQuery && (
        <div className="hero-banner">
          <div className="hero-content">
            <h1 className="hero-title">Discover Album Art</h1>
            <p className="hero-subtitle">
              Too many album covers. Never enough coffee. <CoffeeCupIcon size={18} style={{ verticalAlign: 'middle', display: 'inline-block' }} />
            </p>
            <div className="hero-actions">
              {user ? (
                <a href="/upload" className="btn btn-primary" onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/upload'); window.dispatchEvent(new PopStateEvent('popstate')); }}>
                  <UploadDownloadIcon size={15} />
                  Upload a Cover
                </a>
              ) : (
                <button className="btn btn-primary" onClick={() => openAuthModal('register')}>
                  <UploadDownloadIcon size={15} />
                  Join &amp; Upload
                </button>
              )}
            </div>
          </div>
          <div className="hero-tab-strip">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`hero-tab${activeTab === tab.id ? ' hero-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <section>
        <h2 className="section-title">
          <GalleryIcon size={20} />
          {searchQuery ? `Results for "${searchQuery}"` : activeTitle}
        </h2>

        {searchQuery && (
          <div className="search-source-toggle" role="tablist" aria-label="Search source">
            <button
              role="tab"
              aria-selected={searchSource === 'fan'}
              className={`search-source-btn${searchSource === 'fan' ? ' search-source-btn--active' : ''}`}
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.delete('source');
                navigate(`/?${params.toString()}`);
              }}
            >
              Fan Art
            </button>
            <button
              role="tab"
              aria-selected={searchSource === 'official'}
              className={`search-source-btn${searchSource === 'official' ? ' search-source-btn--active' : ''}`}
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.set('source', 'official');
                navigate(`/?${params.toString()}`);
              }}
            >
              Official
            </button>
          </div>
        )}

        {!searchQuery && activeTab === 'official' ? (
          <OfficialGallery />
        ) : searchQuery && searchSource === 'official' ? (
          <OfficialSearchResults searchQuery={searchQuery} />
        ) : (
          <GalleryGrid filter="all" tab={searchQuery ? 'new' : activeTab} />
        )}
      </section>

      <style>{`
        .hero-banner {
          background-image:
            linear-gradient(var(--skeu-hero-tint), var(--skeu-hero-tint)),
            var(--skeu-hero);
          background-size: 100% 100%, cover;
          background-position: center, center;
          border: 1px solid var(--body-card-border); border-radius: 8px;
          padding: 32px 32px 16px; margin-bottom: 32px;
          box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.12);
          position: relative; overflow: hidden;
        }
        .hero-content { position: relative; z-index: 1; max-width: 620px; }
        .hero-title {
          font-size: 32px; color: #fff8f0; margin-bottom: 10px; letter-spacing: -0.5px;
        }
        .hero-subtitle {
          font-size: 21px; color: rgba(255,248,240,0.82);
          margin-bottom: 14px; line-height: 1.6;
        }
        .hero-stats { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
        .hero-pill { font-size: 17px; letter-spacing: 0.3px; padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.1); color: rgba(255,248,240,0.95); text-transform: uppercase; }
        .hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }
        .hero-tab-strip {
          position: relative; z-index: 1;
          display: flex; gap: 8px;
          padding: 14px 0 4px;
          border-top: 1px solid rgba(255,255,255,0.12); margin-top: 18px;
        }
        .hero-tab {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 16px 9px;
          border: none; border-radius: 6px;
          font-size: 18px; font-family: inherit;
          cursor: pointer;
          color: rgba(255,248,240,0.55);
          transition: color 0.15s, background 0.15s;
          position: relative; bottom: 0;
          background-image:
            linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%),
            linear-gradient(rgba(115,73,42,0.6), rgba(115,73,42,0.6)),
            var(--skeu-theme-btn);
          background-size: 100% 50%, 100% 100%, cover;
          background-position: top, center, center;
          background-repeat: no-repeat, no-repeat, no-repeat;
        }
        [data-theme="dark"] .hero-tab {
          background-image:
            linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%),
            linear-gradient(rgba(56,37,22,0.6), rgba(56,37,22,0.6)),
            var(--skeu-theme-btn);
          background-size: 100% 50%, 100% 100%, cover;
          background-position: top, center, center;
          background-repeat: no-repeat, no-repeat, no-repeat;
        }
        .hero-tab:hover {
          color: rgba(255,248,240,0.9);
          background-image:
            linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 100%),
            linear-gradient(rgba(115,73,42,0.5), rgba(115,73,42,0.5)),
            var(--skeu-theme-btn);
          background-size: 100% 50%, 100% 100%, cover;
          background-position: top, center, center;
          background-repeat: no-repeat, no-repeat, no-repeat;
        }
        [data-theme="dark"] .hero-tab:hover {
          background-image:
            linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 100%),
            linear-gradient(rgba(56,37,22,0.45), rgba(56,37,22,0.45)),
            var(--skeu-theme-btn);
          background-size: 100% 50%, 100% 100%, cover;
          background-position: top, center, center;
          background-repeat: no-repeat, no-repeat, no-repeat;
        }
        .hero-tab--active {
          color: #fff8f0;
          background-image:
            linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 100%),
            linear-gradient(rgba(115,73,42,0.4), rgba(115,73,42,0.4)),
            var(--skeu-theme-btn);
          background-size: 100% 50%, 100% 100%, cover;
          background-position: top, center, center;
          background-repeat: no-repeat, no-repeat, no-repeat;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
        }
        [data-theme="dark"] .hero-tab--active {
          background-image:
            linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.03) 100%),
            linear-gradient(rgba(56,37,22,0.35), rgba(56,37,22,0.35)),
            var(--skeu-theme-btn);
          background-size: 100% 50%, 100% 100%, cover;
          background-position: top, center, center;
          background-repeat: no-repeat, no-repeat, no-repeat;
        }

        .search-source-toggle {
          display: inline-flex;
          gap: 6px;
          margin-bottom: 14px;
          border: 1px solid var(--body-card-border);
          border-radius: 8px;
          padding: 4px;
          background: var(--body-card-bg);
        }
        .search-source-btn {
          border: 1px solid transparent;
          border-radius: 6px;
          background: transparent;
          color: var(--body-text-muted);
          padding: 6px 12px;
          font-size: 16px;
          font-family: var(--font-body);
          cursor: pointer;
        }
        .search-source-btn--active {
          color: var(--body-text);
          border-color: var(--body-card-border);
          background: var(--sidebar-bg);
          box-shadow: var(--shadow-sm);
        }
      `}</style>
    </div>
  );
}
