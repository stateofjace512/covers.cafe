import { useNavigate } from 'react-router-dom';

export default function SiteFooter() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <span className="site-footer-logo">covers.cafe</span>
          <span className="site-footer-tagline">your cover art community</span>
        </div>
        <nav className="site-footer-links">
          <button onClick={() => navigate('/privacy')}>Privacy</button>
          <button onClick={() => navigate('/terms')}>Terms</button>
        </nav>
        <span className="site-footer-copy">© {year}</span>
      </div>

      
    </footer>
  );
}
