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
          margin-top: 40px;
          border-top: 2px solid var(--body-card-border);
          background: linear-gradient(180deg, var(--body-card-bg) 0%, var(--body-bg) 100%);
          background-image:
            linear-gradient(180deg, var(--body-card-bg) 0%, var(--body-bg) 100%),
            repeating-linear-gradient(
              90deg,
              transparent 0px,
              transparent 18px,
              rgba(100,50,10,0.03) 18px,
              rgba(100,50,10,0.03) 20px
            );
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.3);
        }

        .site-footer-inner {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 16px 24px;
          flex-wrap: wrap;
        }

        .site-footer-brand {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-right: auto;
        }

        .site-footer-logo {
          font-size: 21px;
          color: var(--body-text);
          letter-spacing: 0.5px;
        }

        [data-theme="dark"] .site-footer-logo { }

        .site-footer-tagline {
          font-size: 17px;
          color: var(--body-text-muted);
          letter-spacing: 0.3px;
        }

        .site-footer-links {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .site-footer-links button {
          background: none;
          border: 1px solid transparent;
          border-radius: 4px;
          color: var(--body-text-muted);
          font-size: 18px;
          font-family: var(--font-body);
          cursor: pointer;
          padding: 4px 10px;
          box-shadow: none;
          transition: background 0.1s, color 0.1s, border-color 0.1s;
        }

        .site-footer-links button:hover {
          background: var(--body-card-bg);
          border-color: var(--body-card-border);
          color: var(--accent);
        }

        .site-footer-copy {
          font-size: 17px;
          color: var(--body-text-muted);
          opacity: 0.7;
        }

        @media (max-width: 640px) {
          .site-footer-inner { justify-content: center; text-align: center; }
          .site-footer-brand { align-items: center; margin-right: 0; }
        }
      `}</style>
    </footer>
  );
}
