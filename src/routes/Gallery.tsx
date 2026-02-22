import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Image, ArrowUpFromLine, Star, Trophy, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import GalleryGrid from '../components/GalleryGrid';
import CoffeeCupIcon from '../components/CoffeeCupIcon';

export type GalleryTab = 'new' | 'top_rated' | 'acotw';

const TABS: { id: GalleryTab; label: string; icon: React.ReactNode; title: string }[] = [
  { id: 'new',       label: 'New',       icon: <Sparkles size={13} />, title: 'Recent Covers' },
  { id: 'top_rated', label: 'Top Rated', icon: <Star size={13} />,     title: 'Top Rated' },
  { id: 'acotw',     label: 'ACOTW',     icon: <Trophy size={13} />,   title: 'Album Cover Of The Week' },
];

export default function Gallery() {
  const { user, openAuthModal } = useAuth();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q');
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
            <div className="hero-stats">
              <span className="hero-pill">Fresh uploads</span>
              <span className="hero-pill">Top rated picks</span>
              <span className="hero-pill">Weekly spotlight</span>
            </div>
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
          <Image size={20} />
          {searchQuery ? `Results for "${searchQuery}"` : activeTitle}
        </h2>
        <GalleryGrid filter="all" tab={searchQuery ? 'new' : activeTab} />
      </section>

      <style>{`
        .hero-banner {
          background: linear-gradient(135deg, var(--header-bg) 0%, var(--sidebar-bg-dark) 60%, var(--header-bg-dark) 100%);
          border: 1px solid var(--body-card-border); border-radius: 8px;
          padding: 32px 32px 16px; margin-bottom: 32px; 
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
        .hero-content { position: relative; z-index: 1; max-width: 620px; }
        .hero-title {
          font-size: 32px; font-weight: bold; color: #fff8f0;
          text-shadow: 0 2px 6px rgba(0,0,0,0.5); margin-bottom: 10px; letter-spacing: -0.5px;
        }
        .hero-subtitle {
          font-size: 15px; color: rgba(255,248,240,0.82);
          margin-bottom: 14px; line-height: 1.6; text-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        .hero-stats { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
        .hero-pill { font-size: 11px; font-weight: bold; letter-spacing: 0.3px; padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.1); color: rgba(255,248,240,0.95); text-transform: uppercase; }
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
          border: none; border-radius: 6px 6px 6px 6px;
          font-size: 12px; font-weight: bold; font-family: inherit;
          cursor: pointer;
          background: transparent;
          color: rgba(255,248,240,0.55);
          transition: color 0.15s, background 0.15s;
          position: relative; bottom: 0;
        }
        .hero-tab:hover { color: rgba(255,248,240,0.9); background: rgba(255,255,255,0.08); }
        .hero-tab--active {
          color: #fff8f0;
          background: rgba(255,255,255,0.12);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  );
}
