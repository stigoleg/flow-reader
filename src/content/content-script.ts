import { extractContent, extractFromSelection } from '@/lib/extraction';
import type { MessageType } from '@/types';

chrome.runtime.onMessage.addListener((message: MessageType | { type: 'PING' }, _sender, sendResponse) => {
  // Simple ping to check if content script is loaded
  if (message.type === 'PING') {
    sendResponse({ type: 'PONG' });
    return true;
  }

  if (message.type === 'EXTRACT_CONTENT') {
    try {
      // Debug: log document state
      console.log('FlowReader: Extracting from', window.location.href);
      console.log('FlowReader: Document ready state:', document.readyState);
      console.log('FlowReader: Has documentElement:', !!document.documentElement);
      console.log('FlowReader: Has body:', !!document.body);
      
      const extractedDoc = extractContent(window.document, window.location.href);

      if (extractedDoc) {
        console.log('FlowReader: Extraction successful, blocks:', extractedDoc.blocks.length);
        sendResponse({ type: 'CONTENT_EXTRACTED', payload: extractedDoc });
      } else {
        console.log('FlowReader: Extraction returned null, trying selection');
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
