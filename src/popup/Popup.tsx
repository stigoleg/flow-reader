import { useState, useMemo } from 'react';
import { extractFromPaste } from '@/lib/extraction';

export default function Popup() {
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);

  // Detect platform for shortcut hint
  const isMac = useMemo(() => navigator.platform.toUpperCase().includes('MAC'), []);
  const archiveShortcut = isMac ? '⌘+Shift+F' : 'Ctrl+Shift+F';
  const readerShortcut = isMac ? '⌘+Shift+R' : 'Ctrl+Shift+R';

  const handleOpenArchive = async () => {
    await chrome.runtime.sendMessage({ type: 'OPEN_ARCHIVE' });
    window.close();
  };

  const handleReadPage = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab.id) {
        // Send message to content script to extract content
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONTENT' });
        
        if (response.type === 'CONTENT_EXTRACTED') {
          // Open reader with the document
          await chrome.runtime.sendMessage({ type: 'OPEN_READER', document: response.payload });
          window.close();
        } else {
          alert('Could not extract article content. Try selecting text first.');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to read page. Make sure you are on a regular web page.');
    }
  };

  const handlePasteAndRead = async () => {
    if (!pasteText.trim()) {
      return;
    }

    const document = extractFromPaste(pasteText);
    await chrome.runtime.sendMessage({ type: 'OPEN_READER', document });
    window.close();
  };

  return (
    <div className="p-4 bg-white text-gray-900">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">FlowReader</h1>
        <p className="text-xs text-gray-500">Read faster, understand better</p>
      </header>

      <div className="space-y-2">
        {/* Open Archive */}
        <button
          onClick={handleOpenArchive}
          className="w-full flex items-center gap-3 p-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="font-medium">Open Archive</span>
        </button>

        {/* Read Current Page */}
        <button
          onClick={handleReadPage}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span>Read This Page</span>
        </button>

        {/* Paste and Read Toggle */}
        <button
          onClick={() => setShowPaste(!showPaste)}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span>Paste and Read</span>
        </button>

        {/* Paste Text Area */}
        {showPaste && (
          <div className="space-y-2 pt-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your text here..."
              className="w-full h-32 p-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-gray-900"
            />
            <button
              onClick={handlePasteAndRead}
              disabled={!pasteText.trim()}
              className="w-full p-2 rounded-lg bg-gray-800 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
            >
              Start Reading
            </button>
          </div>
        )}
      </div>

      {/* Keyboard shortcut hints */}
      <div className="mt-4 text-xs text-center text-gray-400 space-y-1">
        <p>{archiveShortcut} - Open Archive</p>
        <p>{readerShortcut} - Read current page</p>
      </div>
    </div>
  );
}
