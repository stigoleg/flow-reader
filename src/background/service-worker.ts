import type { FlowDocument, MessageType } from '@/types';
import { runMigrations, initializeDefaultStorage } from '@/lib/migrations';
import { syncScheduler, setupSyncAlarmListener } from '@/lib/sync/sync-scheduler';

/**
 * Service worker for FlowReader extension
 * Handles background orchestration and message passing
 */

// Store extracted document temporarily for passing to reader page
let pendingDocument: FlowDocument | null = null;

// Set up sync alarm listener
setupSyncAlarmListener();

// Initialize sync scheduler on service worker startup
// This ensures sync works even after browser restart (not just install/update)
(async () => {
  try {
    await syncScheduler.initialize();
    console.log('FlowReader: Sync scheduler initialized on startup');
  } catch (error) {
    console.error('FlowReader: Failed to initialize sync scheduler on startup:', error);
  }
})();

// Handle extension install and update events
chrome.runtime.onInstalled.addListener(async (details) => {
  // Create context menu on every install/update
  chrome.contextMenus.create({
    id: 'open-in-flowreader',
    title: 'Open in FlowReader',
    contexts: ['page', 'selection'],
  });
  
  // Debug: Log registered commands
  chrome.commands.getAll((commands) => {
    for (const { name, shortcut } of commands) {
      if (shortcut === '') {
        console.warn(`FlowReader: Command "${name}" has no shortcut assigned! Check chrome://extensions/shortcuts`);
      } else {
        console.log(`FlowReader: Command "${name}" registered with shortcut: ${shortcut}`);
      }
    }
  });

  // Handle installation and updates
  try {
    if (details.reason === 'install') {
      // First install: initialize with defaults
      console.log('FlowReader: First install - initializing storage');
      await initializeDefaultStorage();
    } else if (details.reason === 'update') {
      // Extension update: run migrations to update schema
      console.log(`FlowReader: Updated from ${details.previousVersion} - running migrations`);
      await runMigrations();
    }
    
    // Initialize sync scheduler (for both install and update)
    await syncScheduler.initialize();
  } catch (error) {
    console.error('FlowReader: Error during install/update handling:', error);
  }
});

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'open-in-flowreader' && tab?.id) {
    await extractAndOpenReader(tab.id, info.selectionText);
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message: MessageType, sender, sendResponse) => {
  switch (message.type) {
    case 'OPEN_READER':
      // If document is provided, use it directly
      if (message.document) {
        pendingDocument = message.document;
        openReaderPage();
        sendResponse({ success: true });
      } else if (sender.tab?.id) {
        // If no document but sent from a content script, extract from that tab
        extractAndOpenReader(sender.tab.id).then(() => {
          sendResponse({ success: true });
        }).catch(error => {
          sendResponse({ error: error.message });
        });
        return true; // Keep channel open for async response
      } else {
        sendResponse({ success: false, error: 'No document or tab' });
      }
      return false; // Synchronous response already sent

    case 'GET_PENDING_DOCUMENT':
      sendResponse(pendingDocument);
      pendingDocument = null; // Clear after retrieval
      return false; // Synchronous response
    
    case 'EXTRACT_FROM_URL':
      // Re-extract content from a URL (for reopening web documents)
      extractFromUrl(message.url).then(doc => {
        sendResponse(doc);
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // Keep channel open for async response
    
    case 'EXTRACT_FROM_URL_AND_OPEN':
      // Re-extract content from a URL and open in reader
      extractFromUrl((message as { type: 'EXTRACT_FROM_URL_AND_OPEN'; url: string }).url).then(doc => {
        if (doc) {
          pendingDocument = doc;
          openReaderPage();
        }
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // Keep channel open for async response
    
    case 'OPEN_ARCHIVE':
      // Open or focus the Archive page
      openOrFocusArchiveTab().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // Keep channel open for async response
    
    default:
      // Unknown message type - don't keep channel open
      return false;
  }
});

// Listen for keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  console.log('FlowReader: Command received:', command);
  if (command === 'open-archive') {
    // Open or focus the Archive page
    await openOrFocusArchiveTab();
  } else if (command === 'open-reader') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('FlowReader: Active tab:', tab?.id, tab?.url);
      if (tab?.id) {
        await extractAndOpenReader(tab.id);
      } else {
        console.error('FlowReader: No active tab found for keyboard shortcut');
      }
    } catch (error) {
      console.error('FlowReader: Error handling keyboard shortcut:', error);
    }
  }
});

// Listen for extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await extractAndOpenReader(tab.id);
  }
});

/**
 * Check if a URL is restricted (can't inject content scripts)
 */
function isRestrictedUrl(url: string): boolean {
  return (
    !url ||
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('moz-extension://') ||
    url.startsWith('file://') // file:// requires explicit permission
  );
}

/**
 * Inject content script into a tab and wait for it to be ready
 * Note: The content script path is transformed by the build process,
 * so we need to use the same path pattern as in manifest.json
 */
async function injectContentScript(tabId: number): Promise<boolean> {
  try {
    // First, check if we can access this tab at all
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || isRestrictedUrl(tab.url)) {
      console.warn('Cannot inject into restricted URL:', tab.url);
      return false;
    }

    // Use scripting API to inject the content script
    // The crxjs plugin handles the path transformation, but for manual injection
    // we need to use the actual built path. Since we can't know the hash,
    // we'll inject the extraction code directly as a function.
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Signal that we're ready to receive messages
        // The actual content script should already be loaded via manifest
        console.log('FlowReader: Content script injection attempted');
      },
    });
    
    // Wait a bit for the script to initialize
    await new Promise((resolve) => setTimeout(resolve, 100));
    return true;
  } catch (error) {
    console.warn('Failed to inject content script:', error);
    return false;
  }
}

/**
 * Try to communicate with the content script, injecting if necessary
 */
async function sendMessageToContentScript(
  tabId: number, 
  message: { type: string }
): Promise<MessageType | null> {
  // First, try sending the message directly (content script might already be loaded)
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response;
  } catch {
    // Content script not ready - this is common for tabs opened before extension install
    console.log('FlowReader: Content script not responding, attempting injection...');
  }

  // Try to inject the content script
  const injected = await injectContentScript(tabId);
  if (!injected) {
    console.warn('FlowReader: Could not inject content script. Try refreshing the page.');
    return null;
  }

  // Wait a bit more and try sending the message again
  await new Promise((resolve) => setTimeout(resolve, 200));
  
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response;
  } catch {
    console.error('FlowReader: Content script still not responding after injection. Please refresh the page.');
    return null;
  }
}

/**
 * Extract content from the active tab and open reader
 */
async function extractAndOpenReader(tabId?: number, selectionText?: string): Promise<void> {
  try {
    // Get the active tab if no tabId provided
    if (!tabId) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabId = tab.id;
    }

    if (!tabId) {
      console.error('No active tab found');
      return;
    }

    // If we have selection text from context menu, use it directly
    if (selectionText && selectionText.trim().length > 50) {
      pendingDocument = {
        metadata: {
          title: 'Selected Text',
          source: 'selection',
          createdAt: Date.now(),
        },
        blocks: selectionText.split(/\n\n+/).filter(p => p.trim()).map((content, index) => ({
          type: 'paragraph' as const,
          content: content.trim(),
          id: `block-${index}`,
        })),
        plainText: selectionText,
      };
      openReaderPage();
      return;
    }

    // Get the current tab URL to check if we can inject
    const tab = await chrome.tabs.get(tabId);
    const url = tab.url || '';
    
    // Can't extract from restricted URLs
    if (isRestrictedUrl(url)) {
      console.warn('Cannot extract from restricted URL:', url);
      // Show the reader page with an error message instead
      openReaderPage();
      return;
    }

    // Try to extract content
    const response = await sendMessageToContentScript(tabId, { type: 'EXTRACT_CONTENT' });

    if (!response) {
      console.error('Could not communicate with content script');
      // Set a flag so reader knows to show a helpful message
      pendingDocument = null;
      openReaderPage();
      return;
    }

    if (response.type === 'CONTENT_EXTRACTED') {
      pendingDocument = response.payload;
      openReaderPage();
    } else if (response.type === 'EXTRACTION_FAILED') {
      console.error('Extraction failed:', response.error);
      // Open reader anyway - user can paste or import content
      openReaderPage();
    }
  } catch (error) {
    console.error('Error extracting content:', error);
    // Open reader anyway so user can still use it
    openReaderPage();
  }
}

/**
 * Open the reader page in a new tab
 */
function openReaderPage(): void {
  const readerUrl = chrome.runtime.getURL('src/reader/index.html');
  chrome.tabs.create({ url: readerUrl });
}

/**
 * Open the Archive page in a new tab, or focus it if already open
 */
async function openOrFocusArchiveTab(): Promise<void> {
  const archiveUrl = chrome.runtime.getURL('src/archive/index.html');
  
  // Check if archive tab already exists
  const tabs = await chrome.tabs.query({ url: archiveUrl });
  
  if (tabs.length > 0 && tabs[0].id) {
    // Focus existing tab
    await chrome.tabs.update(tabs[0].id, { active: true });
    if (tabs[0].windowId) {
      await chrome.windows.update(tabs[0].windowId, { focused: true });
    }
    
    // Send message to focus search (when already on Archive)
    try {
      await chrome.tabs.sendMessage(tabs[0].id, { type: 'FOCUS_SEARCH' });
    } catch {
      // Tab might not be ready to receive messages, ignore
    }
  } else {
    // Open new tab
    await chrome.tabs.create({ url: archiveUrl });
  }
}

/**
 * Extract content from a URL by opening it in a background tab
 * Used for reopening recent web documents
 */
async function extractFromUrl(url: string): Promise<FlowDocument | null> {
  // Check if URL is valid and not restricted
  if (!url || isRestrictedUrl(url)) {
    throw new Error('Cannot extract from this URL');
  }

  // Create a tab with the URL (in background)
  const tab = await chrome.tabs.create({ url, active: false });
  
  if (!tab.id) {
    throw new Error('Failed to create tab');
  }

  // Wait for the page to load
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Page load timeout'));
    }, 15000);

    const listener = (tabId: number, info: { status?: string }) => {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeout);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });

  try {
    // Extract content from the tab
    const response = await sendMessageToContentScript(tab.id, { type: 'EXTRACT_CONTENT' });

    if (response?.type === 'CONTENT_EXTRACTED') {
      return response.payload;
    } else {
      throw new Error('Failed to extract content');
    }
  } finally {
    // Close the background tab
    if (tab.id) {
      chrome.tabs.remove(tab.id);
    }
  }
}

// Export for type checking
export type { MessageType };
