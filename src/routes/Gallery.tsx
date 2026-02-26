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
      {/* Hero  -  only show when no search */}
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

      
    </div>
  );
}
