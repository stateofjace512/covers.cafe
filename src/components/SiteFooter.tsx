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
          <button onClick={() => navigate('/about')}>About</button>
          <button onClick={() => navigate('/privacy')}>Privacy</button>
          <button onClick={() => navigate('/terms')}>Terms</button>
        </nav>
        <span className="site-footer-copy">© {year}</span>
      </div>

      <style>{`
        .site-footer {
          margin-top: auto;
          margin-left: -14px;
          margin-right: -14px;
          margin-bottom: -10px;
        }

        .site-footer-inner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 4px 14px;
          flex-wrap: wrap;
          position: relative;
          overflow: hidden;
          /* Win95 statusbar: raised top edge */
          border-top: 2px solid #ffffff;
          background: #c0c0c0;
        }
        [data-theme="dark"] .site-footer-inner {
          background: var(--body-card-bg);
          border-top-color: #606060;
        }
        .site-footer-inner::before { display: none; }
        .site-footer-inner > * { position: relative; z-index: 1; }

        .site-footer-brand {
          display: flex;
          flex-direction: column;
          gap: 1px;
          margin-right: auto;
        }

        .site-footer-logo {
          font-size: 12px;
          font-weight: bold;
          color: var(--body-text);
          letter-spacing: 0;
        }

        .site-footer-tagline {
          font-size: 10px;
          color: var(--body-text-muted);
        }

        .site-footer-links {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .site-footer-links button {
          background: none;
          border: none;
          border-radius: 0;
          color: var(--body-text-muted);
          font-size: 11px;
          font-family: var(--font-body);
          cursor: pointer;
          padding: 2px 6px;
          box-shadow: none;
          transition: none;
          text-decoration: underline;
        }

        .site-footer-links button:hover {
          background: #000080;
          color: #ffffff;
          text-decoration: none;
        }

        .site-footer-copy {
          font-size: 11px;
          color: var(--body-text-muted);
        }

        @media (max-width: 900px) {
          .site-footer { margin-left: -10px; margin-right: -10px; margin-bottom: -8px; }
          .site-footer-inner { padding-left: 10px; padding-right: 10px; }
        }

        @media (max-width: 640px) {
          .site-footer { margin-left: -8px; margin-right: -8px; margin-bottom: -6px; }
          .site-footer-inner { justify-content: center; text-align: center; padding-left: 8px; padding-right: 8px; }
          .site-footer-brand { align-items: center; margin-right: 0; }
        }
      `}</style>
    </footer>
  );
}
