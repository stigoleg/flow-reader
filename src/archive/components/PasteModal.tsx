/**
 * Paste Modal
 * 
 * Modal dialog for pasting text content.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface PasteModalProps {
  onClose: () => void;
  onSubmit: (text: string) => void;
}

export default function PasteModal({ onClose, onSubmit }: PasteModalProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const isMac = useMemo(() => navigator.platform.toUpperCase().includes('MAC'), []);
  const pasteShortcut = isMac ? '⌘V' : 'Ctrl+V';
  
  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);
  
  useEscapeKey(onClose);
  
  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text);
    }
  };
  
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paste-modal-title"
      >
        <div className="modal-header">
          <h2 id="paste-modal-title" className="modal-title">Paste Text</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="modal-body">
          <p className="text-sm opacity-70 mb-3">
            Paste any text you want to read. Press {pasteShortcut} or right-click to paste.
          </p>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your text here..."
            className="w-full h-48 p-3 rounded-lg resize-none focus:outline-none focus:ring-2 transition-colors"
            style={{
              backgroundColor: 'var(--reader-bg)',
              color: 'var(--reader-text)',
              border: '1px solid rgba(128, 128, 128, 0.3)',
            }}
            onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 2px var(--reader-link)'}
            onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
          />
        </div>
        
        <div className="modal-footer">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ 
              backgroundColor: 'rgba(128, 128, 128, 0.1)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ 
              backgroundColor: 'var(--reader-link)',
              color: 'white',
            }}
          >
            Start Reading
          </button>
        </div>
      </div>
    </div>
  );
}
