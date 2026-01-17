/** Zustand store for managing archive page state */

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
  updateArchiveItem,
} from '@/lib/recents-service';
import { extractFromPdf } from '@/lib/pdf-handler';
import { extractFromDocx } from '@/lib/docx-handler';
import { extractFromEpub } from '@/lib/epub-handler';
import { extractFromMobi } from '@/lib/mobi-handler';
import { extractFromPaste } from '@/lib/extraction';
import { isSupportedFile, getFileType } from '@/lib/file-utils';
import { syncService } from '@/lib/sync/sync-service';


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
  
  // Renaming
  renamingItemId: string | null;
  
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
  importFiles: (files: File[]) => Promise<void>;
  importPaste: (text: string) => Promise<void>;
  setPasteModalOpen: (open: boolean) => void;
  setClearDialogOpen: (open: boolean) => void;
  setDragging: (dragging: boolean) => void;
  showContextMenu: (itemId: string, position: { x: number; y: number }) => void;
  hideContextMenu: () => void;
  startRenaming: (itemId: string) => void;
  finishRenaming: (newTitle: string) => Promise<void>;
  cancelRenaming: () => void;
  focusSearch: () => void;
  toggleSettings: () => void;
}


export const useArchiveStore = create<ArchiveState>((set, get) => ({
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
  renamingItemId: null,
  isSettingsOpen: false,
  
  loadItems: async () => {
    set({ isLoading: true, error: null });
    try {
      await deduplicateArchive();
      
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
      
      await addRecent({
        type: mapSourceToType(doc.metadata.source),
        title: doc.metadata.title,
        author: doc.metadata.author,
        sourceLabel: getSourceLabel(doc.metadata),
        url: doc.metadata.url,
        fileHash: doc.metadata.fileHash,
        cachedDocument: doc,
      });
      
      await chrome.runtime.sendMessage({ type: 'OPEN_READER', document: doc });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to import file',
        isLoading: false,
      });
    }
  },
  
  importFiles: async (files: File[]) => {
    const supportedFiles = files.filter(f => isSupportedFile(f.name));
    const unsupportedFiles = files.filter(f => !isSupportedFile(f.name));
    
    if (supportedFiles.length === 0) {
      if (unsupportedFiles.length > 0) {
        set({ error: 'No supported files found. Supported: PDF, DOCX, EPUB, MOBI.' });
      }
      return;
    }
    
    set({ isLoading: true, error: null });
    
    let firstDoc: FlowDocument | null = null;
    const errors: string[] = [];
    
    unsupportedFiles.forEach(f => {
      errors.push(`${f.name}: Unsupported file type`);
    });
    
    for (const file of supportedFiles) {
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
        
        await addRecent({
          type: mapSourceToType(doc.metadata.source),
          title: doc.metadata.title,
          author: doc.metadata.author,
          sourceLabel: getSourceLabel(doc.metadata),
          url: doc.metadata.url,
          fileHash: doc.metadata.fileHash,
          cachedDocument: doc,
        });
        
        if (!firstDoc) {
          firstDoc = doc;
        }
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Failed to import'}`);
      }
    }
    
    set({ isLoading: false });
    
    if (errors.length > 0) {
      const successCount = supportedFiles.length - (errors.length - unsupportedFiles.length);
      if (successCount > 0) {
        set({ error: `Imported ${successCount} file(s). ${errors.length} failed.` });
      } else {
        set({ error: `Failed to import ${errors.length} file(s): ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}` });
      }
    }
    
    if (firstDoc) {
      await chrome.runtime.sendMessage({ type: 'OPEN_READER', document: firstDoc });
    }
  },
  
  importPaste: async (text: string) => {
    if (!text.trim()) {
      return;
    }
    
    try {
      const doc = extractFromPaste(text);
      
      await addRecent({
        type: 'paste',
        title: doc.metadata.title,
        sourceLabel: 'Pasted text',
        pasteContent: text,
        cachedDocument: doc,
        fileHash: doc.metadata.fileHash,
      });
      
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
  
  startRenaming: (itemId: string) => {
    set({ renamingItemId: itemId, contextMenuItemId: null, contextMenuPosition: null });
  },
  
  finishRenaming: async (newTitle: string) => {
    const { renamingItemId, items } = get();
    if (!renamingItemId || !newTitle.trim()) {
      set({ renamingItemId: null });
      return;
    }
    
    try {
      const updated = await updateArchiveItem(renamingItemId, { title: newTitle.trim() });
      if (updated) {
        set({
          items: items.map(item => item.id === renamingItemId ? updated : item),
          renamingItemId: null,
        });
      } else {
        set({ renamingItemId: null });
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to rename item',
        renamingItemId: null,
      });
    }
  },
  
  cancelRenaming: () => {
    set({ renamingItemId: null });
  },
  
  focusSearch: () => {
    const event = new CustomEvent('archive-focus-search');
    document.dispatchEvent(event);
  },
  
  toggleSettings: () => {
    set(state => ({ isSettingsOpen: !state.isSettingsOpen }));
  },
}));


function matchesSearch(item: ArchiveItem, query: string): boolean {
  const title = item.title.toLowerCase();
  const author = item.author?.toLowerCase() || '';
  const sourceLabel = item.sourceLabel.toLowerCase();
  return title.includes(query) || author.includes(query) || sourceLabel.includes(query);
}

/** Get items filtered only by search query (for filter chip counts) */
export function selectSearchFilteredItems(state: ArchiveState): ArchiveItem[] {
  if (!state.searchQuery.trim()) {
    return state.items;
  }
  const query = state.searchQuery.toLowerCase().trim();
  return state.items.filter(item => matchesSearch(item, query));
}

/** Get filtered items based on search query and active filter */
export function selectFilteredItems(state: ArchiveState): ArchiveItem[] {
  let items = state.items;
  
  if (state.activeFilter !== 'all') {
    if (state.activeFilter === 'books') {
      items = items.filter(item => item.type === 'epub' || item.type === 'mobi');
    } else {
      items = items.filter(item => item.type === state.activeFilter);
    }
  }
  
  if (state.searchQuery.trim()) {
    const query = state.searchQuery.toLowerCase().trim();
    items = items.filter(item => matchesSearch(item, query));
  }
  
  return items;
}


export type ItemSyncStatus = 'synced' | 'not-synced' | 'not-applicable';

/**
 * Determine the sync status of an archive item:
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
      return item.cachedDocument ? 'synced' : 'not-synced';
    
    case 'web':
      return item.url ? 'synced' : 'not-synced';
    
    case 'paste':
      return item.pasteContent ? 'synced' : 'not-synced';
    
    default:
      return 'not-applicable';
  }
}
