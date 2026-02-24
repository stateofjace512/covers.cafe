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

export type GalleryTab = 'new' | 'top_rated' | 'acotw';

const TABS: { id: GalleryTab; label: string; icon: React.ReactNode; title: string }[] = [
  { id: 'new',       label: 'New',       icon: <DiamondIcon size={13} />,    title: 'Recent Covers' },
  { id: 'top_rated', label: 'Top Rated', icon: <FavoritesIcon size={13} />, title: 'Top Rated' },
  { id: 'acotw',     label: 'ACOTW',     icon: <TrophyIcon size={13} />,    title: 'Album Cover Of The Week' },
];

export default function Gallery() {
  const { user, openAuthModal } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchQuery = searchParams.get('q');
  const searchSource = searchParams.get('source') === 'official' ? 'official' : 'fan';
  const [activeTab, setActiveTab] = useState<GalleryTab>('new');
  const [browseSource, setBrowseSource] = useState<'fan' | 'official'>('fan');

  // Unified source: URL param when searching, state when browsing
  const activeSource = searchQuery ? searchSource : browseSource;

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
          {searchQuery
            ? (activeSource === 'official' ? 'Official' : 'Fan Art')
            : (activeSource === 'official' ? 'Official Covers' : activeTitle)}
        </h2>

        <div className="search-source-toggle" role="tablist" aria-label="Content source">
          <button
            role="tab"
            aria-selected={activeSource === 'fan'}
            className={`search-source-btn${activeSource === 'fan' ? ' search-source-btn--active' : ''}`}
            onClick={() => {
              if (searchQuery) {
                const params = new URLSearchParams(searchParams);
                params.delete('source');
                navigate(`/?${params.toString()}`);
              } else {
                setBrowseSource('fan');
              }
            }}
          >
            Fan Art
          </button>
          <button
            role="tab"
            aria-selected={activeSource === 'official'}
            className={`search-source-btn${activeSource === 'official' ? ' search-source-btn--active' : ''}`}
            onClick={() => {
              if (searchQuery) {
                const params = new URLSearchParams(searchParams);
                params.set('source', 'official');
                navigate(`/?${params.toString()}`);
              } else {
                setBrowseSource('official');
              }
            }}
          >
            Official
          </button>
        </div>

        {activeSource === 'official' ? (
          searchQuery
            ? <OfficialSearchResults searchQuery={searchQuery} />
            : <OfficialGallery />
        ) : (
          <GalleryGrid filter="all" tab={searchQuery ? 'new' : activeTab} />
        )}
      </section>

      <style>{`
        /* Win95 application window panel for the hero area */
        .hero-banner {
          background-image: none;
          background: var(--body-card-bg);
          border: 2px solid; border-color: #ffffff #c07f55 #c07f55 #ffffff;
          padding: 0; margin-bottom: 12px;
          position: relative; overflow: hidden;
          box-shadow: none;
        }
        [data-theme="dark"] .hero-banner { border-color: #6b3d1f #2a1505 #2a1505 #6b3d1f; }
        /* Win95 title bar inside hero */
        .hero-banner::before {
          content: 'covers.cafe \u2014  Album Cover Gallery';
          display: flex; align-items: center; height: 22px;
          background: linear-gradient(90deg, #5a3620 0%, #73492a 35%, #8a5a35 100%);
          color: #ffffff; font-size: 11px; font-weight: bold;
          font-family: "MS Sans Serif", Tahoma, Arial, sans-serif;
          padding: 0 8px;
        }
        .hero-content { padding: 10px 12px 8px; max-width: 620px; }
        .hero-title { font-size: 15px; font-weight: bold; color: var(--body-text); margin-bottom: 3px; }
        .hero-subtitle { font-size: 12px; color: var(--body-text-muted); margin-bottom: 8px; line-height: 1.4; }
        .hero-stats { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 8px; }
        /* Win95 status bar segments */
        .hero-pill {
          font-size: 10px; padding: 1px 6px;
          border: 2px solid; border-color: #c07f55 #ffffff #ffffff #c07f55;
          background: var(--body-card-bg); color: var(--body-text);
          text-transform: uppercase; letter-spacing: 0.3px;
        }
        .hero-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        /* Win95 property sheet tab strip */
        .hero-tab-strip {
          display: flex; gap: 0;
          padding: 6px 12px 0;
          border-top: 1px solid var(--body-border);
        }
        .hero-tab {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 12px;
          border: 2px solid; border-color: #ffffff #c07f55 transparent #ffffff;
          border-bottom: none;
          font-size: 11px; font-family: var(--font-body);
          cursor: pointer; color: var(--body-text-muted);
          background: var(--body-card-bg); background-image: none;
          margin-right: 2px; position: relative; bottom: -2px;
          transition: none;
        }
        [data-theme="dark"] .hero-tab { border-color: #6b3d1f #2a1505 transparent #6b3d1f; background-image: none; }
        .hero-tab:hover { color: var(--body-text); background: #d0d0d0; background-image: none; }
        [data-theme="dark"] .hero-tab:hover { background: #50280f; background-image: none; }
        .hero-tab--active {
          color: var(--body-text); font-weight: bold;
          background: var(--body-card-bg); background-image: none;
          border-bottom: 2px solid var(--body-card-bg); z-index: 1; box-shadow: none;
        }
        [data-theme="dark"] .hero-tab--active { background: var(--body-card-bg); background-image: none; border-bottom-color: var(--body-card-bg); }
        /* Win95 segmented toggle for search source */
        .search-source-toggle {
          display: inline-flex; gap: 0;
          margin-bottom: 10px;
          border: 2px solid; border-color: #c07f55 #ffffff #ffffff #c07f55;
          background: var(--body-card-bg);
        }
        .search-source-btn {
          border: none; border-right: 1px solid var(--body-border);
          background: transparent; color: var(--body-text-muted);
          padding: 3px 10px; font-size: 11px; font-family: var(--font-body); cursor: pointer;
        }
        .search-source-btn:last-child { border-right: none; }
        .search-source-btn--active { background: var(--accent); color: #ffffff; box-shadow: none; }
      `}</style>
    </div>
  );
}
