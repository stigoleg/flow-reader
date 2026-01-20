import { useEffect, useState } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface HelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ['Space'], description: 'Play / Pause' },
  { keys: ['→', 'J'], description: 'Next word/sentence/block' },
  { keys: ['←', 'K'], description: 'Previous word/sentence/block' },
  { keys: ['↑'], description: 'Increase speed (+10 WPM)' },
  { keys: ['↓'], description: 'Decrease speed (-10 WPM)' },
  { keys: ['Shift', '↑'], description: 'Increase speed (+50 WPM)' },
  { keys: ['Shift', '↓'], description: 'Decrease speed (-50 WPM)' },
  { keys: ['M'], description: 'Cycle reading mode' },
  { keys: ['B'], description: 'Toggle Bionic mode' },
  { keys: ['G'], description: 'Cycle granularity (Pacing mode)' },
  { keys: ['['], description: 'Previous chapter (books)' },
  { keys: [']'], description: 'Next chapter (books)' },
  { keys: ['T'], description: 'Toggle table of contents (books)' },
  { keys: ['Home'], description: 'Jump to start' },
  { keys: ['End'], description: 'Jump to end' },
  { keys: ['0-9'], description: 'Jump to 0%-90% of document' },
  { keys: ['PgUp'], description: 'Skip 10 blocks back' },
  { keys: ['PgDn'], description: 'Skip 10 blocks forward' },
  { keys: ['N'], description: 'Toggle notes panel' },
  { keys: ['Ctrl', 'F'], description: 'Search in document' },
  { keys: ['?'], description: 'Show this help' },
  { keys: ['Esc'], description: 'Close reader / overlay' },
];

export default function HelpOverlay({ isOpen, onClose }: HelpOverlayProps) {
  useEscapeKey(onClose, isOpen);
  
  // Also close on '?' key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md rounded-xl shadow-2xl z-[201] overflow-hidden fade-in"
        style={{
          backgroundColor: 'var(--reader-bg)',
          color: 'var(--reader-text)',
          border: '1px solid rgba(128, 128, 128, 0.3)',
        }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Keyboard Shortcuts</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full opacity-60 hover:opacity-100 transition-opacity"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Shortcuts list */}
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {SHORTCUTS.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm opacity-80">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, keyIndex) => (
                    <span key={keyIndex}>
                      <kbd
                        className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded text-xs font-mono"
                        style={{
                          backgroundColor: 'rgba(128, 128, 128, 0.15)',
                          border: '1px solid rgba(128, 128, 128, 0.3)',
                          boxShadow: '0 1px 0 rgba(128, 128, 128, 0.3)',
                        }}
                      >
                        {key}
                      </kbd>
                      {keyIndex < shortcut.keys.length - 1 && (
                        <span className="text-xs opacity-40 mx-1">or</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div className="mt-6 pt-4 border-t border-current/10 text-center">
            <p className="text-xs opacity-50">
              Press <kbd className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'rgba(128, 128, 128, 0.15)' }}>?</kbd> or <kbd className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'rgba(128, 128, 128, 0.15)' }}>Esc</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// Hook to manage help overlay state
export function useHelpOverlay() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
