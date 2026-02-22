/**
 * AnonTermsModal - One-time terms agreement modal for anonymous commenters
 */

import React, { useState } from 'react';
import Modal from '../FooterModal.jsx';

export const ANON_TERMS_KEY = 'comment_terms_agreed';

export interface AnonTermsModalProps {
  onAccept: () => void;
}

export default function AnonTermsModal({ onAccept }: AnonTermsModalProps) {
  const [agreed, setAgreed] = useState(false);

  const handleAccept = () => {
    if (!agreed) return;
    localStorage.setItem(ANON_TERMS_KEY, 'true');
    onAccept();
  };

  return (
    <Modal
      disableClose
      showCloseButton={false}
      ariaLabel="Comment Terms & Conditions"
      useDefaultStyles={false}
      useDefaultBody={false}
      overlayClassName="skeuo-modal-backdrop"
      contentClassName="skeuo-modal-content"
    >
      {/* Header */}
      <div className="skeuo-modal-header">
        <p className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-0.5">
          Terms &amp; Conditions
        </p>
      </div>

      {/* Body */}
      <div className="skeuo-modal-body">
        <label className={`flex items-start gap-3 cursor-pointer select-none skeuo-content-panel skeuo-panel-hover-highlight p-3 rounded-lg mb-4 mt-4${agreed ? ' skeuo-glass-panel' : ''}`}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="peer sr-only"
          />
          <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-neutral-400 bg-white flex items-center justify-center peer-checked:bg-blue-600 peer-checked:border-blue-600">
            <svg
              className={agreed ? 'block' : 'hidden'}
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="none"
            >
              <path
                d="M16.7 5.7L8.2 14.2L3.3 9.3"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-sm text-neutral-700">
            I agree to the terms and conditions outlined in the{' '}
            <a
              href="/help/comment-terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              onClick={(e) => e.stopPropagation()}
            >
              Comment Terms &amp; Conditions
            </a>
          </span>
        </label>
      </div>

      {/* Footer */}
      <div className="skeuo-modal-footer">
        <button
          type="button"
          disabled={!agreed}
          onClick={handleAccept}
          className="skeuo-button block w-full text-left !text-sm !py-2 !px-4 tracking-[0.3em] uppercase"
          style={{
            opacity: agreed ? 0.8 : 0.4,
            cursor: agreed ? 'pointer' : 'not-allowed',
          }}
        >
          Continue to Comment
        </button>
      </div>
    </Modal>
  );
}
