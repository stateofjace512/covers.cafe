import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import SiteFooter from './SiteFooter';

export default function AppShell({ children }: { children: ReactNode }) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <Header
        isMobileNavOpen={isMobileNavOpen}
        onToggleMobileNav={() => setIsMobileNavOpen((open) => !open)}
      />
      <Sidebar isMobileNavOpen={isMobileNavOpen} onNavigate={() => setIsMobileNavOpen(false)} />
      {isMobileNavOpen && <button className="mobile-nav-backdrop" aria-label="Close menu" onClick={() => setIsMobileNavOpen(false)} />}
      <main className="site-main"><div className="site-main-content">{children}</div><SiteFooter /></main>
    </div>
  );
}
