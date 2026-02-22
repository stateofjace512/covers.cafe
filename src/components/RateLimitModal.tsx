import { resetRateLimit } from '../lib/rateLimit';

interface Props {
  action: string;
  onClose: () => void;
}

export default function RateLimitModal({ action, onClose }: Props) {
  const handleClose = () => {
    resetRateLimit(action);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="modal-box rate-limit-modal" role="alertdialog" aria-modal="true">
        <div className="rate-limit-emoji">☕</div>
        <h2 className="rate-limit-title">Pls calm down!</h2>
        <p className="rate-limit-body">Take it a little slower, we're old!</p>
        <button className="btn btn-primary" onClick={handleClose} style={{ marginTop: 8 }}>
          Ok, my bad
        </button>
      </div>

      <style>{`
        .rate-limit-modal {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; padding: 40px 36px; max-width: 320px;
          gap: 6px;
        }
        .rate-limit-emoji { font-size: 48px; line-height: 1; margin-bottom: 4px; }
        .rate-limit-title {
          font-size: 22px; font-weight: bold; color: var(--body-text);
          text-shadow: 0 1px 0 rgba(255,255,255,0.4);
        }
        [data-theme="dark"] .rate-limit-title { text-shadow: none; }
        .rate-limit-body { font-size: 15px; color: var(--body-text-muted); line-height: 1.5; }
      `}</style>
    </div>
  );
}
