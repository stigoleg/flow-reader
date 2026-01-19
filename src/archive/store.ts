/** Zustand store for managing archive page state */

import { create } from 'zustand';
import type { ArchiveItem, ArchiveItemType, FlowDocument, Collection } from '@/types';
import { DEFAULT_COLLECTIONS } from '@/types';
import { 
  queryRecents, 
  removeRecent, 
  removeRecents,
  clearRecents,
  addRecent,
  mapSourceToType,
  getSourceLabel,
  deduplicateArchive,
  getRecent,
  updateArchiveItem,
} from '@/lib/recents-service';
import {
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  toggleItemInCollection,
  addItemsToCollection,
  removeItemsFromCollection,
} from '@/lib/collections-service';
import { extractFromPdf } from '@/lib/pdf-handler';
import { extractFromDocx } from '@/lib/docx-handler';
import { extractFromEpub } from '@/lib/epub-handler';
import { extractFromMobi } from '@/lib/mobi-handler';
import { extractFromPaste } from '@/lib/extraction';
import { countWords } from '@/lib/file-utils';
import { isSupportedFile, getFileType } from '@/lib/file-utils';
import { syncService } from '@/lib/sync/sync-service';


export type FilterType = 'all' | ArchiveItemType | 'books';

export interface ArchiveState {
  // Data
  items: ArchiveItem[];
  collections: Collection[];
  isLoading: boolean;
  error: string | null;
  
  // Sync state
  syncEnabled: boolean;
  
  // UI state
  searchQuery: string;
  activeFilter: FilterType;
  activeCollectionId: string | null;
  focusedItemIndex: number;
  
  // Selection state
  selectedItemIds: Set<string>;
  isSelectionMode: boolean;
  lastSelectedId: string | null;
  
  // Modals
  isPasteModalOpen: boolean;
  isClearDialogOpen: boolean;
  isCollectionManagerOpen: boolean;
  isDragging: boolean;
  isBulkDeleteDialogOpen: boolean;
  
  // Context menu
  contextMenuItemId: string | null;
  contextMenuPosition: { x: number; y: number } | null;
  
  // Renaming
  renamingItemId: string | null;
  
  // Notes viewing
  viewingNotesForItem: ArchiveItem | null;
  
  // Settings
  isSettingsOpen: boolean;
  
  // Actions
  loadItems: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: FilterType) => void;
  setActiveCollectionId: (collectionId: string | null) => void;
  setFocusedItemIndex: (index: number) => void;
  openItem: (item: ArchiveItem, annotationId?: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  importFile: (file: File) => Promise<void>;
  importFiles: (files: File[]) => Promise<void>;
  importPaste: (text: string) => Promise<void>;
  setPasteModalOpen: (open: boolean) => void;
  setClearDialogOpen: (open: boolean) => void;
  setCollectionManagerOpen: (open: boolean) => void;
  setDragging: (dragging: boolean) => void;
  showContextMenu: (itemId: string, position: { x: number; y: number }) => void;
  hideContextMenu: () => void;
  startRenaming: (itemId: string) => void;
  finishRenaming: (newTitle: string) => Promise<void>;
  cancelRenaming: () => void;
  focusSearch: () => void;
  toggleSettings: () => void;
  viewNotesForItem: (item: ArchiveItem) => void;
  closeNotesView: () => void;
  
  // Collection actions
  toggleItemCollection: (itemId: string, collectionId: string) => Promise<void>;
  createCollection: (name: string, options?: { icon?: string; color?: string }) => Promise<Collection | null>;
  updateCollection: (id: string, updates: Partial<Pick<Collection, 'name' | 'icon' | 'color'>>) => Promise<void>;
  deleteCollection: (id: string) => Promise<boolean>;
  addItemsToCollection: (itemIds: string[], collectionId: string) => Promise<void>;
  removeItemsFromCollection: (itemIds: string[], collectionId: string) => Promise<void>;
  
  // Selection actions
  toggleItemSelection: (id: string, options?: { shiftKey?: boolean }) => void;
  selectAll: () => void;
  clearSelection: () => void;
  exitSelectionMode: () => void;
  setBulkDeleteDialogOpen: (open: boolean) => void;
  
  // Bulk actions
  bulkDelete: () => Promise<void>;
  bulkAddToCollection: (collectionId: string) => Promise<void>;
  bulkRemoveFromCollection: (collectionId: string) => Promise<void>;
}


export const useArchiveStore = create<ArchiveState>((set, get) => ({
  items: [],
  collections: DEFAULT_COLLECTIONS,
  isLoading: true,
  error: null,
  syncEnabled: false,
  searchQuery: '',
  activeFilter: 'all',
  activeCollectionId: null,
  focusedItemIndex: 0,
  
  // Selection state
  selectedItemIds: new Set<string>(),
  isSelectionMode: false,
  lastSelectedId: null,
  
  // Modals
  isPasteModalOpen: false,
  isClearDialogOpen: false,
  isCollectionManagerOpen: false,
  isDragging: false,
  isBulkDeleteDialogOpen: false,
  
  contextMenuItemId: null,
  contextMenuPosition: null,
  renamingItemId: null,
  viewingNotesForItem: null,
  isSettingsOpen: false,
  
  loadItems: async () => {
    set({ isLoading: true, error: null });
    try {
      await deduplicateArchive();
      
      const [items, syncConfig, collections] = await Promise.all([
        queryRecents(),
        syncService.getConfig(),
        getCollections(),
      ]);
      
      set({ 
        items, 
        collections,
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
    set({ activeFilter: filter, activeCollectionId: null, focusedItemIndex: 0 });
  },
  
  setActiveCollectionId: (collectionId: string | null) => {
    set({ activeCollectionId: collectionId, activeFilter: 'all', focusedItemIndex: 0 });
  },
  
  setFocusedItemIndex: (index: number) => {
    set({ focusedItemIndex: index });
  },
  
  openItem: async (item: ArchiveItem, annotationId?: string) => {
    try {
      const freshItem = await getRecent(item.id) || item;
      
      if (freshItem.cachedDocument) {
        // Open reader with cached document
        await chrome.runtime.sendMessage({ 
          type: 'OPEN_READER', 
          document: freshItem.cachedDocument,
          navigateToAnnotationId: annotationId,
        });
      } else if (freshItem.type === 'web' && freshItem.url) {
        // Re-extract from URL (annotation navigation not supported for re-extracted content)
        await chrome.runtime.sendMessage({ type: 'EXTRACT_FROM_URL_AND_OPEN', url: freshItem.url });
      } else if (freshItem.type === 'paste' && freshItem.pasteContent) {
        // Recreate paste document
        const doc = extractFromPaste(freshItem.pasteContent);
        await chrome.runtime.sendMessage({ 
          type: 'OPEN_READER', 
          document: doc,
          navigateToAnnotationId: annotationId,
        });
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
        wordCount: countWords(doc.plainText),
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
          wordCount: countWords(doc.plainText),
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
        wordCount: countWords(doc.plainText),
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
  
  setCollectionManagerOpen: (open: boolean) => {
    set({ isCollectionManagerOpen: open });
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
  
  viewNotesForItem: (item: ArchiveItem) => {
    set({ viewingNotesForItem: item });
  },
  
  closeNotesView: () => {
    set({ viewingNotesForItem: null });
  },
  
  // Collection actions
  toggleItemCollection: async (itemId: string, collectionId: string) => {
    try {
      const result = await toggleItemInCollection(itemId, collectionId);
      if (result) {
        const { items } = get();
        set({
          items: items.map(item => item.id === itemId ? result.item : item),
        });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update collection' });
    }
  },
  
  createCollection: async (name: string, options?: { icon?: string; color?: string }) => {
    try {
      const newCollection = await createCollection(name, options);
      const { collections } = get();
      set({ collections: [...collections, newCollection] });
      return newCollection;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create collection' });
      return null;
    }
  },
  
  updateCollection: async (id: string, updates: Partial<Pick<Collection, 'name' | 'icon' | 'color'>>) => {
    try {
      const updated = await updateCollection(id, updates);
      if (updated) {
        const { collections } = get();
        set({
          collections: collections.map(c => c.id === id ? updated : c),
        });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update collection' });
    }
  },
  
  deleteCollection: async (id: string) => {
    try {
      const success = await deleteCollection(id);
      if (success) {
        const { collections, activeCollectionId, items } = get();
        // Update state: remove collection and clear collection IDs from items
        set({
          collections: collections.filter(c => c.id !== id),
          activeCollectionId: activeCollectionId === id ? null : activeCollectionId,
          items: items.map(item => {
            if (item.collectionIds?.includes(id)) {
              const newIds = item.collectionIds.filter(cid => cid !== id);
              return { ...item, collectionIds: newIds.length > 0 ? newIds : undefined };
            }
            return item;
          }),
        });
      }
      return success;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete collection' });
      return false;
    }
  },
  
  addItemsToCollection: async (itemIds: string[], collectionId: string) => {
    try {
      await addItemsToCollection(itemIds, collectionId);
      const { items } = get();
      const itemIdSet = new Set(itemIds);
      set({
        items: items.map(item => {
          if (!itemIdSet.has(item.id)) return item;
          const collectionIds = new Set(item.collectionIds ?? []);
          if (collectionIds.has(collectionId)) return item;
          collectionIds.add(collectionId);
          return { ...item, collectionIds: Array.from(collectionIds) };
        }),
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to add items to collection' });
    }
  },
  
  removeItemsFromCollection: async (itemIds: string[], collectionId: string) => {
    try {
      await removeItemsFromCollection(itemIds, collectionId);
      const { items } = get();
      const itemIdSet = new Set(itemIds);
      set({
        items: items.map(item => {
          if (!itemIdSet.has(item.id)) return item;
          if (!item.collectionIds?.includes(collectionId)) return item;
          const newIds = item.collectionIds.filter(id => id !== collectionId);
          return { ...item, collectionIds: newIds.length > 0 ? newIds : undefined };
        }),
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to remove items from collection' });
    }
  },
  
  // Selection actions
  toggleItemSelection: (id: string, options?: { shiftKey?: boolean }) => {
    const { selectedItemIds, lastSelectedId, items } = get();
    const newSelected = new Set(selectedItemIds);
    
    if (options?.shiftKey && lastSelectedId && lastSelectedId !== id) {
      // Range selection: select all items between lastSelectedId and id
      const lastIndex = items.findIndex(item => item.id === lastSelectedId);
      const currentIndex = items.findIndex(item => item.id === id);
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        
        for (let i = start; i <= end; i++) {
          newSelected.add(items[i].id);
        }
      }
    } else {
      // Toggle single item
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
    }
    
    // Enter selection mode if items are selected
    const newIsSelectionMode = newSelected.size > 0;
    
    set({
      selectedItemIds: newSelected,
      isSelectionMode: newIsSelectionMode,
      lastSelectedId: id,
    });
  },
  
  selectAll: () => {
    const state = get();
    const filteredItems = selectFilteredItems(state);
    const allIds = new Set(filteredItems.map(item => item.id));
    
    set({
      selectedItemIds: allIds,
      isSelectionMode: allIds.size > 0,
      lastSelectedId: filteredItems.length > 0 ? filteredItems[0].id : null,
    });
  },
  
  clearSelection: () => {
    set({
      selectedItemIds: new Set<string>(),
      lastSelectedId: null,
    });
  },
  
  exitSelectionMode: () => {
    set({
      selectedItemIds: new Set<string>(),
      isSelectionMode: false,
      lastSelectedId: null,
    });
  },
  
  setBulkDeleteDialogOpen: (open: boolean) => {
    set({ isBulkDeleteDialogOpen: open });
  },
  
  // Bulk actions
  bulkDelete: async () => {
    const { selectedItemIds, items } = get();
    if (selectedItemIds.size === 0) return;
    
    try {
      // Delete all items in a single operation
      await removeRecents(Array.from(selectedItemIds));
      
      // Update local state
      set({
        items: items.filter(item => !selectedItemIds.has(item.id)),
        selectedItemIds: new Set<string>(),
        isSelectionMode: false,
        lastSelectedId: null,
        isBulkDeleteDialogOpen: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete items' });
    }
  },
  
  bulkAddToCollection: async (collectionId: string) => {
    const { selectedItemIds, items } = get();
    if (selectedItemIds.size === 0) return;
    
    try {
      const itemIds = Array.from(selectedItemIds);
      await addItemsToCollection(itemIds, collectionId);
      
      // Update local state
      set({
        items: items.map(item => {
          if (!selectedItemIds.has(item.id)) return item;
          const collectionIds = new Set(item.collectionIds ?? []);
          if (collectionIds.has(collectionId)) return item;
          collectionIds.add(collectionId);
          return { ...item, collectionIds: Array.from(collectionIds) };
        }),
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to add items to collection' });
    }
  },
  
  bulkRemoveFromCollection: async (collectionId: string) => {
    const { selectedItemIds, items } = get();
    if (selectedItemIds.size === 0) return;
    
    try {
      const itemIds = Array.from(selectedItemIds);
      await removeItemsFromCollection(itemIds, collectionId);
      
      // Update local state
      set({
        items: items.map(item => {
          if (!selectedItemIds.has(item.id)) return item;
          if (!item.collectionIds?.includes(collectionId)) return item;
          const newIds = item.collectionIds.filter(id => id !== collectionId);
          return { ...item, collectionIds: newIds.length > 0 ? newIds : undefined };
        }),
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to remove items from collection' });
    }
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

/** Get filtered items based on search query, active filter, and collection */
export function selectFilteredItems(state: ArchiveState): ArchiveItem[] {
  let items = state.items;
  
  // Filter by collection first (if active)
  if (state.activeCollectionId) {
    items = items.filter(item => item.collectionIds?.includes(state.activeCollectionId!));
  }
  
  // Then filter by type
  if (state.activeFilter !== 'all') {
    if (state.activeFilter === 'books') {
      items = items.filter(item => item.type === 'epub' || item.type === 'mobi');
    } else {
      items = items.filter(item => item.type === state.activeFilter);
    }
  }
  
  // Then filter by search query
  if (state.searchQuery.trim()) {
    const query = state.searchQuery.toLowerCase().trim();
    items = items.filter(item => matchesSearch(item, query));
  }
  
  return items;
}

/** Get the count of selected items that are currently visible (after filtering) */
export function selectVisibleSelectedCount(state: ArchiveState): number {
  const filteredItems = selectFilteredItems(state);
  return filteredItems.filter(item => state.selectedItemIds.has(item.id)).length;
}

/** Get selected items that are currently visible */
export function selectVisibleSelectedItems(state: ArchiveState): ArchiveItem[] {
  const filteredItems = selectFilteredItems(state);
  return filteredItems.filter(item => state.selectedItemIds.has(item.id));
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
