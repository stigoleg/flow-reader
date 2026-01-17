/**
 * Passphrase Modal
 * 
 * Modal for entering or creating an encryption passphrase for cloud sync.
 */

import { useState } from 'react';

interface PassphraseModalProps {
  isNewSetup: boolean;
  onSubmit: (passphrase: string) => void;
  onCancel: () => void;
}

export function PassphraseModal({ isNewSetup, onSubmit, onCancel }: PassphraseModalProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      return;
    }

    if (isNewSetup && passphrase !== confirmPassphrase) {
      setError('Passphrases do not match');
      return;
    }

    onSubmit(passphrase);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        className="rounded-xl p-6 max-w-md w-full shadow-2xl border border-current/20" 
        style={{ backgroundColor: 'var(--bg-color, #1a1a2e)', color: 'var(--text-color, #eaeaea)' }}
      >
        <h3 className="text-lg font-semibold mb-2">
          {isNewSetup ? 'Create Encryption Passphrase' : 'Enter Passphrase'}
        </h3>
        <p className="text-sm opacity-70 mb-4">
          {isNewSetup 
            ? 'Choose a strong passphrase to encrypt your sync data. You will need this passphrase on all your devices.'
            : 'Enter your passphrase to decrypt and sync your data.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 opacity-70">Passphrase</label>
            <div className="relative">
              <input
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => { setPassphrase(e.target.value); setError(''); }}
                placeholder="Enter passphrase"
                autoFocus
                className="w-full px-3 py-2 pr-10 rounded-lg border border-current/20 bg-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showPassphrase ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {isNewSetup && (
            <div>
              <label className="block text-sm mb-1 opacity-70">Confirm Passphrase</label>
              <input
                type={showPassphrase ? 'text' : 'password'}
                value={confirmPassphrase}
                onChange={(e) => { setConfirmPassphrase(e.target.value); setError(''); }}
                placeholder="Confirm passphrase"
                className="w-full px-3 py-2 rounded-lg border border-current/20 bg-transparent"
              />
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg border border-current/20 hover:border-current/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-current/10 hover:bg-current/20 font-medium"
            >
              {isNewSetup ? 'Create & Connect' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
