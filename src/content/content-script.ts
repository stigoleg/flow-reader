import { extractContent, extractFromSelection } from '@/lib/extraction';
import type { MessageType } from '@/types';

// KEYBOARD SHORTCUTS (fallback for when Chrome command shortcuts don't work)

/**
 * Check if the user is in an input field where we shouldn't capture shortcuts
 */
function isInInputField(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;
  
  const tagName = activeElement.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  
  // Check for contenteditable
  if (activeElement.getAttribute('contenteditable') === 'true') {
    return true;
  }
  
  return false;
}

/**
 * Handle keyboard shortcuts
 * Ctrl+Shift+F (Cmd+Shift+F on Mac) -> Open Archive
 * Ctrl+Shift+R (Cmd+Shift+R on Mac) -> Read Current Page
 */
function handleKeyDown(event: KeyboardEvent): void {
  // Skip if in input field
  if (isInInputField()) return;
  
  // Check for Ctrl+Shift (or Cmd+Shift on Mac)
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifierKey = isMac ? event.metaKey : event.ctrlKey;
  
  if (!modifierKey || !event.shiftKey) return;
  
  // Ctrl/Cmd+Shift+F -> Open Archive
  if (event.key.toLowerCase() === 'f') {
    event.preventDefault();
    event.stopPropagation();
    chrome.runtime.sendMessage({ type: 'OPEN_ARCHIVE' });
    return;
  }
  
  // Ctrl/Cmd+Shift+R -> Read Current Page
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    event.stopPropagation();
    chrome.runtime.sendMessage({ type: 'OPEN_READER' });
    return;
  }
}

// Register keyboard listener
document.addEventListener('keydown', handleKeyDown, { capture: true });


chrome.runtime.onMessage.addListener((message: MessageType | { type: 'PING' }, _sender, sendResponse) => {
  // Simple ping to check if content script is loaded
  if (message.type === 'PING') {
    sendResponse({ type: 'PONG' });
    return true;
  }

  if (message.type === 'EXTRACT_CONTENT') {
    try {
      const extractedDoc = extractContent(window.document, window.location.href);

      if (extractedDoc) {
        sendResponse({ type: 'CONTENT_EXTRACTED', payload: extractedDoc });
      } else {
        const selection = window.getSelection()?.toString();
        if (selection && selection.length > 100) {
          const fallbackDoc = extractFromSelection(selection, window.location.href);
          sendResponse({ type: 'CONTENT_EXTRACTED', payload: fallbackDoc });
        } else {
          sendResponse({
            type: 'EXTRACTION_FAILED',
            error: 'Could not extract article content. Try selecting text first.',
          });
        }
      }
    } catch (error) {
      console.error('FlowReader: Extraction error:', error);
      sendResponse({
        type: 'EXTRACTION_FAILED',
        error: error instanceof Error ? error.message : 'Unknown extraction error',
      });
    }

    return true;
  }
});

chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' });
