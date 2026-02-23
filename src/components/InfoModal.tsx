import type { ReactNode } from 'react';

interface InfoModalProps {
  /** Large emoji displayed at the top of the modal */
  emoji?: string;
  /** Or a custom React icon/element instead of an emoji */
  icon?: ReactNode;
  title: string;
  body: ReactNode;
  /** Primary action button (e.g. "Resize for me") */
  primaryLabel?: string;
  onPrimary?: () => void;
  /** Secondary / dismiss button (e.g. "Cancel") */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Called when clicking the backdrop or pressing Escape */
  onClose: () => void;
}

/**
 * Site-wide informodal — a friendly overlay that explains why something failed
 * or asks the user to confirm an action, in a tone that matches the covers.cafe
 * personality (warm, casual, slightly self-deprecating).
 *
 * Usage example:
 *   <InfoModal
 *     emoji="💪"
 *     title="Woah there!"
 *     body="That file is too powerful for us…"
 *     primaryLabel="Resize for me"
 *     onPrimary={handleResize}
 *     secondaryLabel="Cancel"
 *     onSecondary={handleCancel}
 *     onClose={handleCancel}
 *   />
 */
export default function InfoModal({
  emoji,
  icon,
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onClose,
}: InfoModalProps) {
  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-box info-modal" role="alertdialog" aria-modal="true">
        {(emoji || icon) && (
          <div className="info-modal-icon">
            {emoji ? <span className="info-modal-emoji">{emoji}</span> : icon}
          </div>
        )}
        <h2 className="info-modal-title">{title}</h2>
        <p className="info-modal-body">{body}</p>
        <div className="info-modal-actions">
          {primaryLabel && onPrimary && (
            <button className="btn btn-primary" onClick={onPrimary}>
              {primaryLabel}
            </button>
          )}
          {secondaryLabel && (onSecondary || onClose) && (
            <button className="btn btn-secondary" onClick={onSecondary ?? onClose}>
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .info-modal {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 40px 36px;
          max-width: 360px;
          gap: 10px;
        }
        .info-modal-icon { line-height: 0; margin-bottom: 4px; }
        .info-modal-emoji {
          font-size: 56px;
          line-height: 1;
          display: block;
        }
        .info-modal-title {
          font-size: 22px;
          font-weight: bold;
          color: var(--body-text);
          text-shadow: 0 1px 0 rgba(255,255,255,0.4);
          margin: 0;
        }
        [data-theme="dark"] .info-modal-title { text-shadow: none; }
        .info-modal-body {
          font-size: 18px;
          color: var(--body-text-muted);
          line-height: 1.55;
          margin: 0;
        }
        .info-modal-actions {
          display: flex;
          gap: 10px;
          margin-top: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}
