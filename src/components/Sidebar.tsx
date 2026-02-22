import {
  ArrowUpFromLine,
  ArrowDownToLine,
  User,
  Star,
  Image,
  Coffee,
  Cog,
  UserRoundCog,
  UserRound,
} from 'lucide-react';

type NavItem = {
  label: string;
  icon: React.ReactNode;
  href: string;
  section?: string;
};

const NAV: NavItem[] = [
  { section: 'Discover', label: 'Gallery', icon: <Image size={18} />, href: '/' },
  { label: 'Artists', icon: <UserRound size={18} />, href: '/artists' },
  { label: 'Favorites', icon: <Star size={18} />, href: '/favorites' },
  { section: 'My Account', label: 'Upload', icon: <ArrowUpFromLine size={18} />, href: '/upload' },
  { label: 'Downloads', icon: <ArrowDownToLine size={18} />, href: '/downloads' },
  { label: 'Profile', icon: <User size={18} />, href: '/profile' },
  { label: 'Edit Profile', icon: <UserRoundCog size={18} />, href: '/profile/edit' },
  { section: 'More', label: 'Settings', icon: <Cog size={18} />, href: '/settings' },
  { label: 'Coffee', icon: <Coffee size={18} />, href: '/coffee' },
];

export default function Sidebar({ currentPath }: { currentPath: string }) {
  return (
    <aside className="site-sidebar" role="navigation" aria-label="Main navigation">
      {/* User panel */}
      <div className="sidebar-user-panel">
        <div className="sidebar-avatar">
          <User size={26} />
        </div>
        <div className="sidebar-user-info">
          <span className="sidebar-user-name">Guest</span>
          <a href="/login" className="sidebar-user-action">Sign in &rsaquo;</a>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map((item) => {
          const isActive =
            item.href === '/'
              ? currentPath === '/'
              : currentPath.startsWith(item.href);

          return (
            <div key={item.href}>
              {item.section && (
                <div className="sidebar-section-label">{item.section}</div>
              )}
              <a
                href={item.href}
                className={`sidebar-nav-item${isActive ? ' sidebar-nav-item--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                <span className="sidebar-nav-label">{item.label}</span>
                {isActive && <span className="sidebar-nav-pip" />}
              </a>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <span className="sidebar-footer-text">covers.cafe</span>
        <span className="sidebar-footer-version">v0.1</span>
      </div>

      <style>{`
        /* ---- User panel ---- */
        .sidebar-user-panel {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 16px 14px;
          border-bottom: 1px solid var(--sidebar-border);
          background: linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 100%);
          box-shadow: 0 2px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.08);
        }

        .sidebar-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: linear-gradient(145deg, var(--sidebar-bg-light), var(--sidebar-bg-dark));
          border: 2px solid var(--sidebar-border);
          box-shadow: 0 2px 5px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--sidebar-text-muted);
          flex-shrink: 0;
        }

        .sidebar-user-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .sidebar-user-name {
          font-size: 14px;
          font-weight: bold;
          color: var(--sidebar-text);
          text-shadow: 0 1px 0 rgba(255,255,255,0.3);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sidebar-user-action {
          font-size: 12px;
          color: var(--accent);
          text-decoration: none;
          font-weight: bold;
        }

        .sidebar-user-action:hover {
          color: var(--accent-light);
          text-decoration: underline;
        }

        /* ---- Nav ---- */
        .sidebar-nav {
          padding: 10px 0;
        }

        .sidebar-section-label {
          font-size: 10px;
          font-weight: bold;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: var(--sidebar-text-muted);
          padding: 14px 16px 4px;
          text-shadow: 0 1px 0 rgba(255,255,255,0.3);
        }

        [data-theme="dark"] .sidebar-section-label {
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }

        .sidebar-nav-item {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 9px 16px;
          color: var(--sidebar-text);
          text-decoration: none;
          font-size: 14px;
          font-weight: bold;
          letter-spacing: 0.1px;
          border-left: 3px solid transparent;
          position: relative;
          transition: background 0.12s, color 0.12s, border-color 0.12s;
        }

        .sidebar-nav-item:hover {
          background: var(--sidebar-hover-bg);
          color: var(--sidebar-text);
          text-decoration: none;
          border-left-color: rgba(115, 73, 42, 0.4);
        }

        .sidebar-nav-item--active {
          background: linear-gradient(90deg, var(--sidebar-active-bg) 0%, rgba(115,73,42,0.85) 100%);
          color: var(--sidebar-active-text) !important;
          border-left-color: #f0a060;
          text-shadow: 0 1px 2px rgba(0,0,0,0.4);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.15);
        }

        .sidebar-nav-item--active:hover {
          background: linear-gradient(90deg, var(--sidebar-active-bg) 0%, rgba(115,73,42,0.9) 100%);
        }

        .sidebar-nav-icon {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          width: 20px;
          justify-content: center;
        }

        .sidebar-nav-label {
          flex: 1;
        }

        .sidebar-nav-pip {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #f0a060;
          box-shadow: 0 0 6px rgba(240,160,96,0.6);
          flex-shrink: 0;
        }

        /* ---- Footer ---- */
        .sidebar-footer {
          margin-top: auto;
          border-top: 1px solid var(--sidebar-border);
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(0deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0) 100%);
          position: sticky;
          bottom: 0;
        }

        .sidebar-footer-text {
          font-size: 11px;
          font-weight: bold;
          color: var(--sidebar-text-muted);
          letter-spacing: 0.3px;
        }

        .sidebar-footer-version {
          font-size: 10px;
          color: var(--sidebar-text-muted);
          background: rgba(0,0,0,0.12);
          padding: 2px 6px;
          border-radius: 3px;
          border: 1px solid var(--sidebar-border);
        }
      `}</style>
    </aside>
  );
}
