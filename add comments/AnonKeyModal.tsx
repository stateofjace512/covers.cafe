/**
 * AnonKeyModal - Shown once after an anonymous user's first successful comment.
 *
 * Displays the generated anon key (AK_<12digits>_<5letters>) and the
 * username assigned to this browser. Provides a download button that
 * saves a .txt file, and an "I've saved my key" dismiss button.
 *
 * Once dismissed, stores a localStorage flag so it never shows again
 * for this browser session.
 */

import React from 'react';
import { Download } from 'lucide-react';
import Modal from '../FooterModal.jsx';
// @ts-ignore
import EmbossedButton from '../EmbossedButton.jsx';

export const ANON_KEY_SAVED_KEY = 'comment_anon_key_saved';

export interface AnonKeyModalProps {
  anonKey: string;
  username: string;
  onDismiss: () => void;
}

export default function AnonKeyModal({ anonKey, username, onDismiss }: AnonKeyModalProps) {
  const handleDownload = () => {
    const content = [
      'MSTRJK Anonymous Comment Key',
      '==============================',
      '',
      `Anonymous Username: ${username}`,
      `Recovery Key:       ${anonKey}`,
      '',
      'Keep this key safe. It is the only way to manage your anonymous',
      'comments after you clear your browser data or switch devices.',
      '',
      `Generated: ${new Date().toISOString()}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mstrjk-anon-key-${anonKey}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDismiss = () => {
    localStorage.setItem(ANON_KEY_SAVED_KEY, 'true');
    onDismiss();
  };

  return (
    <Modal
      disableClose
      showCloseButton={false}
      ariaLabel="Anonymous comment key"
      useDefaultStyles={false}
      useDefaultBody={false}
      overlayClassName="skeuo-modal-backdrop"
      contentClassName="skeuo-modal-content"
    >
      {/* Header */}
      <div className="skeuo-modal-header">
        <p className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-0.5">
          Anonymous comments are permanent, but…
        </p>
      </div>

      {/* Body */}
      <div className="skeuo-modal-body" style={{ textAlign: 'left' }}>
        <div className="w-full space-y-4">
          <p className="text-sm text-neutral-600 leading-relaxed">
            The key below is the only way to manage your anonymous comments after
            you close your browser or clear your cache. Download or save this key
            somewhere safe to continue.
          </p>

          {/* Username */}
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Your Anonymous Username
            </p>
            <div className="departure-modal-url select-all" style={{ textAlign: 'left', fontFamily: 'Monaco, Courier New, monospace' }}>
              {username}
            </div>
          </div>

          {/* Key display */}
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Recovery Key
            </p>
            <div className="departure-modal-url select-all" style={{ textAlign: 'left', fontFamily: 'Monaco, Courier New, monospace', letterSpacing: '0.05em' }}>
              {anonKey}
            </div>
          </div>

          {/* Download */}
          <EmbossedButton
            as="button"
            onClick={handleDownload}
            className="w-full justify-center"
          >
            <Download className="w-4 h-4" />
            Download Key
          </EmbossedButton>
        </div>
      </div>

      {/* Footer */}
      <div className="skeuo-modal-footer">
        <EmbossedButton
          as="button"
          onClick={handleDismiss}
          className="w-full justify-center brand-radial-button"
        >
          I've saved my key
        </EmbossedButton>
      </div>
    </Modal>
  );
}
