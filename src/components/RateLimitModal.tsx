import { useEffect, useState } from 'react';
import CoffeeCupIcon from './CoffeeCupIcon';
import { getRateLimitState } from '../lib/rateLimit';

interface Props {
  action: string;
  onClose: () => void;
}

export default function RateLimitModal({ action, onClose }: Props) {
  const [retryAfterMs, setRetryAfterMs] = useState(() => getRateLimitState(action).retryAfterMs);

  useEffect(() => {
    const id = window.setInterval(() => {
      const state = getRateLimitState(action);
      setRetryAfterMs(state.retryAfterMs);
      if (!state.blocked) onClose();
    }, 250);
    return () => window.clearInterval(id);
  }, [action, onClose]);

  const isReady = retryAfterMs <= 0;
  const handleClose = () => onClose();
  const waitSeconds = Math.ceil(retryAfterMs / 1000);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && isReady) handleClose(); }}>
      <div className="modal-box rate-limit-modal" role="alertdialog" aria-modal="true">
        <div className="rate-limit-emoji"><CoffeeCupIcon size={72} /></div>
        <h2 className="rate-limit-title">Pls calm down!</h2>
        {isReady
          ? <p className="rate-limit-body">Ok, you're good to go!</p>
          : <p className="rate-limit-body">Take it a little slower, we're old! Try again in about {waitSeconds}s.</p>
        }
        <button className="btn btn-primary" onClick={handleClose} disabled={!isReady} style={{ marginTop: 8 }}>
          Ok, my bad
        </button>
      </div>

      
    </div>
  );
}
