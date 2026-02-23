import { useNavigate } from 'react-router-dom';
import DiscIcon from '../components/DiscIcon';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="not-found-page">
      <div className="not-found-inner">
        <div className="not-found-icon"><DiscIcon size={52} /></div>
        <h1 className="not-found-code">404</h1>
        <p className="not-found-headline">This record doesn't exist.</p>
        <p className="not-found-sub">
          The page you're looking for has been moved, deleted, or never pressed in the first place.
        </p>
        <button className="btn not-found-btn" onClick={() => navigate('/')}>
          Back to Gallery
        </button>
      </div>

      <style>{`
        .not-found-page {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          min-height: 400px;
          padding: 40px 24px;
        }
        .not-found-inner {
          text-align: center;
          max-width: 380px;
        }
        .not-found-icon {
          color: var(--body-text-muted);
          margin-bottom: 16px;
          opacity: 0.5;
        }
        .not-found-code {
          font-size: 72px;
          font-weight: bold;
          color: var(--body-text);
          line-height: 1;
          margin: 0 0 10px;
          letter-spacing: -2px;
          text-shadow: 0 2px 0 rgba(255,255,255,0.5), 0 -1px 0 rgba(0,0,0,0.1);
        }
        [data-theme="dark"] .not-found-code { text-shadow: none; }
        .not-found-headline {
          font-size: 18px;
          font-weight: bold;
          color: var(--body-text);
          margin: 0 0 10px;
        }
        .not-found-sub {
          font-size: 14px;
          color: var(--body-text-muted);
          line-height: 1.65;
          margin: 0 0 28px;
        }
        .not-found-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          font-size: 14px;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
}
