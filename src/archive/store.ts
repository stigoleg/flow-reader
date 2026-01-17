/**
 * Archive Store
 * 
 * Zustand store for managing archive page state.
 */

import { create } from 'zustand';
import type { ArchiveItem, ArchiveItemType, FlowDocument } from '@/types';
import { 
  queryRecents, 
  removeRecent, 
  clearRecents,
  addRecent,
  mapSourceToType,
  getSourceLabel,
  deduplicateArchive,
  getRecent,
} from '@/lib/recents-service';
import { extractFromPdf } from '@/lib/pdf-handler';
import { extractFromDocx } from '@/lib/docx-handler';
import { extractFromEpub } from '@/lib/epub-handler';
import { extractFromMobi } from '@/lib/mobi-handler';
import { extractFromPaste } from '@/lib/extraction';
import { syncService } from '@/lib/sync/sync-service';

// =============================================================================
// TYPES
// =============================================================================

export type FilterType = 'all' | ArchiveItemType | 'books';

export interface ArchiveState {
  // Data
  items: ArchiveItem[];
  isLoading: boolean;
  error: string | null;
  
  // Sync state
  syncEnabled: boolean;
  
  // UI state
  searchQuery: string;
  activeFilter: FilterType;
  focusedItemIndex: number;
  
  // Modals
  isPasteModalOpen: boolean;
  isClearDialogOpen: boolean;
  isDragging: boolean;
  
  // Context menu
  contextMenuItemId: string | null;
  contextMenuPosition: { x: number; y: number } | null;
  
  // Settings
  isSettingsOpen: boolean;
  
  // Actions
  loadItems: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: FilterType) => void;
  setFocusedItemIndex: (index: number) => void;
  openItem: (item: ArchiveItem) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  importFile: (file: File) => Promise<void>;
  importPaste: (text: string) => Promise<void>;
  setPasteModalOpen: (open: boolean) => void;
  setClearDialogOpen: (open: boolean) => void;
  setDragging: (dragging: boolean) => void;
  showContextMenu: (itemId: string, position: { x: number; y: number }) => void;
  hideContextMenu: () => void;
  focusSearch: () => void;
  toggleSettings: () => void;
}

// =============================================================================
// FILE HANDLING
// =============================================================================

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.epub', '.mobi', '.azw', '.azw3'];

function isSupportedFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  const normalized = lower.replace(/\.zip$/, '');
  return SUPPORTED_EXTENSIONS.some(ext => normalized.endsWith(ext));
}

function getFileType(filename: string): 'pdf' | 'docx' | 'epub' | 'mobi' | null {
  const lower = filename.toLowerCase();
  const normalized = lower.replace(/\.zip$/, '');
  if (normalized.endsWith('.pdf')) return 'pdf';
  if (normalized.endsWith('.docx')) return 'docx';
  if (normalized.endsWith('.epub')) return 'epub';
  if (normalized.endsWith('.mobi') || normalized.endsWith('.azw') || normalized.endsWith('.azw3')) return 'mobi';
  return null;
}

// =============================================================================
// STORE
// =============================================================================

export const useArchiveStore = create<ArchiveState>((set, get) => ({
  // Initial state
  items: [],
  isLoading: true,
  error: null,
  syncEnabled: false,
  searchQuery: '',
  activeFilter: 'all',
  focusedItemIndex: 0,
  isPasteModalOpen: false,
  isClearDialogOpen: false,
  isDragging: false,
  contextMenuItemId: null,
  contextMenuPosition: null,
  isSettingsOpen: false,
  
  // Actions
  loadItems: async () => {
    set({ isLoading: true, error: null });
    try {
      // First, run deduplication to clean up any duplicates from previous syncs
      await deduplicateArchive();
      
      // Load items and sync config in parallel
      const [items, syncConfig] = await Promise.all([
        queryRecents(),
        syncService.getConfig(),
      ]);
      
      set({ 
        items, 
        syncEnabled: syncConfig?.enabled ?? false,
        isLoading: false,
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load items',
        isLoading: false,
      });
    }
  },
  
  setSearchQuery: (query: string) => {
    set({ searchQuery: query, focusedItemIndex: 0 });
  },
  
  setActiveFilter: (filter: FilterType) => {
    set({ activeFilter: filter, focusedItemIndex: 0 });
  },
  
  setFocusedItemIndex: (index: number) => {
    set({ focusedItemIndex: index });
  },
  
  openItem: async (item: ArchiveItem) => {
    try {
      // Re-fetch from storage to get latest data (may have been updated by content sync)
      const freshItem = await getRecent(item.id) || item;
      
      if (freshItem.cachedDocument) {
        // Open reader with cached document
        await chrome.runtime.sendMessage({ type: 'OPEN_READER', document: freshItem.cachedDocument });
      } else if (freshItem.type === 'web' && freshItem.url) {
        // Re-extract from URL
        await chrome.runtime.sendMessage({ type: 'EXTRACT_FROM_URL_AND_OPEN', url: freshItem.url });
      } else if (freshItem.type === 'paste' && freshItem.pasteContent) {
        // Recreate paste document
        const doc = extractFromPaste(freshItem.pasteContent);
        await chrome.runtime.sendMessage({ type: 'OPEN_READER', document: doc });
      } else {
        throw new Error('This item cannot be reopened. Please import it again.');
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to open item' });
    }
  },
  
  removeItem: async (id: string) => {
    try {
      await removeRecent(id);
      const { items } = get();
      set({ items: items.filter(item => item.id !== id) });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to remove item' });
    }
  },
  
  clearHistory: async () => {
    try {
      await clearRecents();
      set({ items: [], isClearDialogOpen: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to clear history' });
    }
  },
  
  importFile: async (file: File) => {
    if (!isSupportedFile(file.name)) {
      set({ error: `Unsupported file type: ${file.name}. Supported: PDF, DOCX, EPUB, MOBI.` });
      return;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      const fileType = getFileType(file.name);
      let doc: FlowDocument;
      
      switch (fileType) {
        case 'pdf':
          doc = await extractFromPdf(file);
          break;
        case 'docx':
          doc = await extractFromDocx(file);
          break;
        case 'epub':
          doc = await extractFromEpub(file);
          break;
        case 'mobi':
          doc = await extractFromMobi(file);
          break;
        default:
          throw new Error('Unsupported file type');
      }
      
      // Add to archive
      await addRecent({
        type: mapSourceToType(doc.metadata.source),
        title: doc.metadata.title,
        author: doc.metadata.author,
        sourceLabel: getSourceLabel(doc.metadata),
        url: doc.metadata.url,
        fileHash: doc.metadata.fileHash,
        cachedDocument: doc,
      });
      
      // Open in reader
      await chrome.runtime.sendMessage({ type: 'OPEN_READER', document: doc });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to import file',
        isLoading: false,
      });
    }
  },
  
  importPaste: async (text: string) => {
    if (!text.trim()) {
      return;
    }
    
    try {
      const doc = extractFromPaste(text);
      
      // Add to archive with fileHash for deduplication
      await addRecent({
        type: 'paste',
        title: doc.metadata.title,
        sourceLabel: 'Pasted text',
        pasteContent: text,
        cachedDocument: doc,
        fileHash: doc.metadata.fileHash,
      });
      
      // Open in reader
      await chrome.runtime.sendMessage({ type: 'OPEN_READER', document: doc });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to import pasted text' });
    }
  },
  
  setPasteModalOpen: (open: boolean) => {
    set({ isPasteModalOpen: open });
  },
  
  setClearDialogOpen: (open: boolean) => {
    set({ isClearDialogOpen: open });
  },
  
  setDragging: (dragging: boolean) => {
    set({ isDragging: dragging });
  },
  
  showContextMenu: (itemId: string, position: { x: number; y: number }) => {
    set({ contextMenuItemId: itemId, contextMenuPosition: position });
  },
  
  hideContextMenu: () => {
    set({ contextMenuItemId: null, contextMenuPosition: null });
  },
  
  focusSearch: () => {
    // This will be handled by the component via a ref
    // The store just provides a signal
    const event = new CustomEvent('archive-focus-search');
    document.dispatchEvent(event);
  },
  
  toggleSettings: () => {
    set(state => ({ isSettingsOpen: !state.isSettingsOpen }));
  },
}));

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Get items filtered only by search query (for filter chip counts)
 */
export function selectSearchFilteredItems(state: ArchiveState): ArchiveItem[] {
  let items = state.items;
  
  // Apply search filter only (not type filter)
  if (state.searchQuery.trim()) {
    const query = state.searchQuery.toLowerCase().trim();
    items = items.filter(item => {
      const title = item.title.toLowerCase();
      const author = item.author?.toLowerCase() || '';
      const sourceLabel = item.sourceLabel.toLowerCase();
      
      return title.includes(query) || 
             author.includes(query) || 
             sourceLabel.includes(query);
    });
  }
  
  return items;
}

/**
 * Get filtered items based on search query and active filter
 */
export function selectFilteredItems(state: ArchiveState): ArchiveItem[] {
  let items = state.items;
  
  // Apply type filter
  if (state.activeFilter !== 'all') {
    if (state.activeFilter === 'books') {
      items = items.filter(item => item.type === 'epub' || item.type === 'mobi');
    } else {
      items = items.filter(item => item.type === state.activeFilter);
    }
  }
  
  // Apply search filter
  if (state.searchQuery.trim()) {
    const query = state.searchQuery.toLowerCase().trim();
    items = items.filter(item => {
      const title = item.title.toLowerCase();
      const author = item.author?.toLowerCase() || '';
      const sourceLabel = item.sourceLabel.toLowerCase();
      
      return title.includes(query) || 
             author.includes(query) || 
             sourceLabel.includes(query);
    });
  }
  
  return items;
}

// =============================================================================
// SYNC STATUS HELPERS
// =============================================================================

export type ItemSyncStatus = 'synced' | 'not-synced' | 'not-applicable';

/**
 * Determine the sync status of an archive item.
 * 
 * - File types (PDF, EPUB, MOBI, DOCX): Synced if cachedDocument exists
 * - Web types: Always synced (can re-extract from URL)
 * - Paste types: Synced if pasteContent exists (included in state sync)
 */
export function getItemSyncStatus(item: ArchiveItem): ItemSyncStatus {
  switch (item.type) {
    case 'pdf':
    case 'epub':
    case 'mobi':
    case 'docx':
      // File types need cachedDocument to be available on other devices
      return item.cachedDocument ? 'synced' : 'not-synced';
    
    case 'web':
      // Web content can always be re-extracted from URL
      return item.url ? 'synced' : 'not-synced';
    
    case 'paste':
      // Paste content is included in state sync
      return item.pasteContent ? 'synced' : 'not-synced';
    
    default:
      return 'not-applicable';
  }
}
