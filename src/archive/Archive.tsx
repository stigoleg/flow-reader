/**
 * Archive Page
 * 
 * Main entry point for the Archive - shows recent items, search, filters,
 * and provides drag-and-drop and paste import.
 */

import { useEffect, useRef, useCallback, useMemo, useState, lazy, Suspense } from 'react';
import { useShallow } from 'zustand/shallow';
import { useArchiveStore, selectFilteredItems, selectSearchFilteredItems, selectVisibleSelectedCount } from './store';
import ArchiveHeader from './components/ArchiveHeader';
import FilterChips from './components/FilterChips';
import ArchiveList from './components/ArchiveList';
import EmptyState from './components/EmptyState';
import DropOverlay from './components/DropOverlay';
import PasteModal from './components/PasteModal';
import ClearHistoryDialog from './components/ClearHistoryDialog';
import ContextMenu from './components/ContextMenu';
import CollectionManager from './components/CollectionManager';
import ArchiveSettingsPanel from './components/ArchiveSettingsPanel';
import ArchiveNotesModal from './components/ArchiveNotesModal';
import BulkActionToolbar from './components/BulkActionToolbar';
import BulkDeleteDialog from './components/BulkDeleteDialog';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getSettings } from '@/lib/storage';
import { DEFAULT_SETTINGS, type ReaderSettings } from '@/types';

// Lazy load StatisticsModal with retry logic for extension updates
// When extension updates, old chunk URLs become invalid - retry with fresh import
const StatisticsModal = lazy(() => 
  import('./components/StatisticsModal').catch(() => {
    // If first attempt fails, wait briefly and retry once
    // This handles cases where extension just updated
    return new Promise(resolve => setTimeout(resolve, 100))
      .then(() => import('./components/StatisticsModal'));
  })
);

/**
 * Apply theme settings to the document (CSS variables and body styles)
 */
function applyThemeToDocument(settings: ReaderSettings) {
  const root = document.documentElement;
  root.style.setProperty('--reader-bg', settings.backgroundColor);
  root.style.setProperty('--reader-text', settings.textColor);
  root.style.setProperty('--reader-link', settings.linkColor);
  root.style.setProperty('--reader-selection', settings.selectionColor);
  root.style.setProperty('--reader-highlight', settings.highlightColor);
  document.body.style.backgroundColor = settings.backgroundColor;
  document.body.style.color = settings.textColor;
}

export default function Archive() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Local settings state (for theme colors)
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  
  // Store state
  const items = useArchiveStore(state => state.items);
  const collections = useArchiveStore(state => state.collections);
  const isLoading = useArchiveStore(state => state.isLoading);
  const error = useArchiveStore(state => state.error);
  const searchQuery = useArchiveStore(state => state.searchQuery);
  const activeFilter = useArchiveStore(state => state.activeFilter);
  const activeCollectionId = useArchiveStore(state => state.activeCollectionId);
  const focusedItemIndex = useArchiveStore(state => state.focusedItemIndex);
  const isDragging = useArchiveStore(state => state.isDragging);
  const isPasteModalOpen = useArchiveStore(state => state.isPasteModalOpen);
  const isClearDialogOpen = useArchiveStore(state => state.isClearDialogOpen);
  const isCollectionManagerOpen = useArchiveStore(state => state.isCollectionManagerOpen);
  const isSettingsOpen = useArchiveStore(state => state.isSettingsOpen);
  const viewingNotesForItem = useArchiveStore(state => state.viewingNotesForItem);
  const selectedItemIds = useArchiveStore(state => state.selectedItemIds);
  const isSelectionMode = useArchiveStore(state => state.isSelectionMode);
  const isBulkDeleteDialogOpen = useArchiveStore(state => state.isBulkDeleteDialogOpen);
  const { contextMenuItemId, contextMenuPosition } = useArchiveStore(
    useShallow(state => ({
      contextMenuItemId: state.contextMenuItemId,
      contextMenuPosition: state.contextMenuPosition,
    }))
  );
  
  // Actions
  const loadItems = useArchiveStore(state => state.loadItems);
  const setSearchQuery = useArchiveStore(state => state.setSearchQuery);
  const setActiveFilter = useArchiveStore(state => state.setActiveFilter);
  const setActiveCollectionId = useArchiveStore(state => state.setActiveCollectionId);
  const setFocusedItemIndex = useArchiveStore(state => state.setFocusedItemIndex);
  const openItem = useArchiveStore(state => state.openItem);
  const removeItem = useArchiveStore(state => state.removeItem);
  const importFiles = useArchiveStore(state => state.importFiles);
  const importPaste = useArchiveStore(state => state.importPaste);
  const setDragging = useArchiveStore(state => state.setDragging);
  const setPasteModalOpen = useArchiveStore(state => state.setPasteModalOpen);
  const setClearDialogOpen = useArchiveStore(state => state.setClearDialogOpen);
  const setCollectionManagerOpen = useArchiveStore(state => state.setCollectionManagerOpen);
  const hideContextMenu = useArchiveStore(state => state.hideContextMenu);
  const startRenaming = useArchiveStore(state => state.startRenaming);
  const toggleSettings = useArchiveStore(state => state.toggleSettings);
  const viewNotesForItem = useArchiveStore(state => state.viewNotesForItem);
  const closeNotesView = useArchiveStore(state => state.closeNotesView);
  
  // Collection actions
  const storeCreateCollection = useArchiveStore(state => state.createCollection);
  const storeUpdateCollection = useArchiveStore(state => state.updateCollection);
  const storeDeleteCollection = useArchiveStore(state => state.deleteCollection);
  const toggleItemCollection = useArchiveStore(state => state.toggleItemCollection);
  
  // Selection actions
  const toggleItemSelection = useArchiveStore(state => state.toggleItemSelection);
  const selectAll = useArchiveStore(state => state.selectAll);
  const exitSelectionMode = useArchiveStore(state => state.exitSelectionMode);
  const setBulkDeleteDialogOpen = useArchiveStore(state => state.setBulkDeleteDialogOpen);
  const bulkDelete = useArchiveStore(state => state.bulkDelete);
  const bulkAddToCollection = useArchiveStore(state => state.bulkAddToCollection);
  const bulkRemoveFromCollection = useArchiveStore(state => state.bulkRemoveFromCollection);
  
  // Get filtered items
  const filteredItems = useMemo(
    () => selectFilteredItems({ items, searchQuery, activeFilter, activeCollectionId } as ReturnType<typeof useArchiveStore.getState>),
    [items, searchQuery, activeFilter, activeCollectionId]
  );
  
  // Get search-filtered items (for filter chip counts - filtered by search but not by type)
  const searchFilteredItems = useMemo(
    () => selectSearchFilteredItems({ items, searchQuery, activeFilter } as ReturnType<typeof useArchiveStore.getState>),
    [items, searchQuery, activeFilter]
  );
  
  // Get visible selected count
  const visibleSelectedCount = useMemo(
    () => selectVisibleSelectedCount({ 
      items, 
      searchQuery, 
      activeFilter, 
      activeCollectionId, 
      selectedItemIds 
    } as ReturnType<typeof useArchiveStore.getState>),
    [items, searchQuery, activeFilter, activeCollectionId, selectedItemIds]
  );
  
  // Load items and settings on mount
  useEffect(() => {
    loadItems();
    
    // Apply theme settings
    getSettings().then(loadedSettings => {
      setSettings(loadedSettings);
      applyThemeToDocument(loadedSettings);
    });
  }, [loadItems]);
  
  // Listen for storage changes to refresh archive list
  // This handles cases where items are added/updated from other contexts (reader, sync)
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes.archiveItems) {
        loadItems();
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [loadItems]);
  
  // Listen for settings changes from sync to update the theme
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes.settings) {
        // Reload and apply settings when they change (e.g., from sync)
        getSettings().then(loadedSettings => {
          setSettings(loadedSettings);
          applyThemeToDocument(loadedSettings);
        });
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);
  
  // Listen for focus search event (from shortcut when already on archive)
  useEffect(() => {
    const handleFocusSearch = () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    
    document.addEventListener('archive-focus-search', handleFocusSearch);
    
    // Also listen for messages from background script
    const handleMessage = (message: { type: string }) => {
      if (message.type === 'FOCUS_SEARCH') {
        handleFocusSearch();
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    
    return () => {
      document.removeEventListener('archive-focus-search', handleFocusSearch);
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);
  
  // Focus search on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);
  
  // Drag and drop handlers
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.types.includes('Files')) {
      setDragging(true);
    }
  }, [setDragging]);
  
  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    // Only hide overlay if leaving the window
    if (!e.relatedTarget || !(e.relatedTarget as Node).ownerDocument) {
      setDragging(false);
    }
  }, [setDragging]);
  
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);
  
  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      await importFiles(files);
    }
  }, [setDragging, importFiles]);
  
  // Set up drag and drop listeners
  useEffect(() => {
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    
    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);
  
  // Clipboard paste handler
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    // Don't capture if focus is in an input
    const activeEl = document.activeElement;
    if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA') {
      return;
    }
    
    // Don't capture if paste modal is open
    if (isPasteModalOpen) {
      return;
    }
    
    const text = e.clipboardData?.getData('text/plain');
    if (text && text.trim().length > 0) {
      e.preventDefault();
      await importPaste(text);
    }
  }, [importPaste, isPasteModalOpen]);
  
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);
  
  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isInInput = ['INPUT', 'TEXTAREA'].includes(
      (e.target as HTMLElement)?.tagName || ''
    );
    
    // Close context menu on any key
    if (contextMenuItemId) {
      hideContextMenu();
    }
    
    // Ctrl/Cmd + A: Select all visible items
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !isInInput) {
      e.preventDefault();
      selectAll();
      return;
    }
    
    // Delete/Backspace: Open bulk delete dialog when items are selected
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isInInput && isSelectionMode) {
      e.preventDefault();
      setBulkDeleteDialogOpen(true);
      return;
    }
    
    switch (e.key) {
      case '/':
        if (!isInInput) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
        break;
        
      case 'Escape':
        // Priority: selection mode > modals > search
        if (isSelectionMode) {
          exitSelectionMode();
        } else if (isBulkDeleteDialogOpen) {
          setBulkDeleteDialogOpen(false);
        } else if (isPasteModalOpen) {
          setPasteModalOpen(false);
        } else if (isClearDialogOpen) {
          setClearDialogOpen(false);
        } else if (searchQuery) {
          setSearchQuery('');
        } else {
          (document.activeElement as HTMLElement)?.blur();
        }
        break;
        
      case 'Enter':
        if (!isInInput && filteredItems.length > 0) {
          const item = filteredItems[focusedItemIndex];
          if (item) {
            openItem(item);
          }
        }
        break;
        
      case 'ArrowDown':
        if (!isInInput) {
          e.preventDefault();
          setFocusedItemIndex(Math.min(focusedItemIndex + 1, filteredItems.length - 1));
        }
        break;
        
      case 'ArrowUp':
        if (!isInInput) {
          e.preventDefault();
          setFocusedItemIndex(Math.max(focusedItemIndex - 1, 0));
        }
        break;
    }
  }, [
    contextMenuItemId,
    hideContextMenu,
    isPasteModalOpen,
    isClearDialogOpen,
    isBulkDeleteDialogOpen,
    isSelectionMode,
    searchQuery,
    filteredItems,
    focusedItemIndex,
    setPasteModalOpen,
    setClearDialogOpen,
    setBulkDeleteDialogOpen,
    setSearchQuery,
    setFocusedItemIndex,
    openItem,
    selectAll,
    exitSelectionMode,
  ]);
  
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => {
      if (contextMenuItemId) {
        hideContextMenu();
      }
    };
    
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenuItemId, hideContextMenu]);
  
  // File input handler
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await importFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [importFiles]);
  
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  
  // Render
  return (
    <div className="archive-container">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.epub,.mobi,.azw,.azw3"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        aria-hidden="true"
      />
      
      {/* Header */}
      <ArchiveHeader
        searchInputRef={searchInputRef}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onImportClick={handleImportClick}
        onPasteClick={() => setPasteModalOpen(true)}
        onSettingsClick={toggleSettings}
        onStatsClick={() => setIsStatsOpen(true)}
        settings={settings}
      />
      
      {/* Main content */}
      <main className="archive-content">
        {/* Filters */}
        <FilterChips
          activeFilter={activeFilter}
          activeCollectionId={activeCollectionId}
          onFilterChange={setActiveFilter}
          onCollectionChange={setActiveCollectionId}
          items={searchFilteredItems}
          collections={collections}
          onClearHistory={() => setClearDialogOpen(true)}
          onManageCollections={() => setCollectionManagerOpen(true)}
        />
        
        {/* Error message */}
        {error && (
          <div 
            className="mb-4 p-3 rounded-lg text-sm"
            style={{
              backgroundColor: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
            }}
            role="alert"
          >
            {error}
          </div>
        )}
        
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--reader-link)' }} />
          </div>
        )}
        
        {/* Content */}
        {!isLoading && filteredItems.length === 0 && (
          <EmptyState
            hasItems={items.length > 0}
            hasSearch={!!searchQuery.trim()}
            hasFilter={activeFilter !== 'all' || !!activeCollectionId}
            onImportClick={handleImportClick}
            onPasteClick={() => setPasteModalOpen(true)}
          />
        )}
        
        {!isLoading && filteredItems.length > 0 && (
          <ArchiveList
            items={filteredItems}
            focusedIndex={focusedItemIndex}
            selectedItemIds={selectedItemIds}
            isSelectionMode={isSelectionMode}
            onItemClick={openItem}
            onItemRemove={removeItem}
            onToggleSelection={(id, shiftKey) => toggleItemSelection(id, { shiftKey })}
            onViewNotes={viewNotesForItem}
          />
        )}
      </main>
      
      {/* Overlays */}
      {isDragging && <DropOverlay />}
      
      {isPasteModalOpen && (
        <PasteModal
          onClose={() => setPasteModalOpen(false)}
          onSubmit={importPaste}
        />
      )}
      
      {isClearDialogOpen && (
        <ClearHistoryDialog
          onClose={() => setClearDialogOpen(false)}
          onConfirm={() => {
            useArchiveStore.getState().clearHistory();
          }}
        />
      )}
      
      {contextMenuItemId && contextMenuPosition && (
        <ContextMenu
          itemId={contextMenuItemId}
          position={contextMenuPosition}
          items={items}
          collections={collections}
          selectedItemIds={selectedItemIds}
          activeCollectionId={activeCollectionId}
          onOpen={openItem}
          onRemove={removeItem}
          onRename={startRenaming}
          onToggleCollection={toggleItemCollection}
          onBulkAddToCollection={bulkAddToCollection}
          onBulkRemoveFromCollection={bulkRemoveFromCollection}
          onBulkDelete={() => setBulkDeleteDialogOpen(true)}
          onViewNotes={viewNotesForItem}
          onClose={hideContextMenu}
        />
      )}
      
      {/* Collection Manager Modal */}
      {isCollectionManagerOpen && (
        <CollectionManager
          collections={collections}
          onClose={() => setCollectionManagerOpen(false)}
          onCreate={storeCreateCollection}
          onUpdate={storeUpdateCollection}
          onDelete={storeDeleteCollection}
        />
      )}
      
      {/* Settings Panel */}
      <ArchiveSettingsPanel
        isOpen={isSettingsOpen}
        settings={settings}
        onSettingsChange={(newSettings: ReaderSettings) => {
          setSettings(newSettings);
          // Apply to CSS variables
          const root = document.documentElement;
          root.style.setProperty('--reader-bg', newSettings.backgroundColor);
          root.style.setProperty('--reader-text', newSettings.textColor);
          root.style.setProperty('--reader-link', newSettings.linkColor);
          root.style.setProperty('--reader-selection', newSettings.selectionColor);
          root.style.setProperty('--reader-highlight', newSettings.highlightColor);
          document.body.style.backgroundColor = newSettings.backgroundColor;
          document.body.style.color = newSettings.textColor;
        }}
        onClose={toggleSettings}
      />
      
      {/* Notes Modal */}
      {viewingNotesForItem && (
        <ArchiveNotesModal
          item={viewingNotesForItem}
          onClose={closeNotesView}
          onOpenDocument={(item, annotationId) => {
            closeNotesView();
            openItem(item, annotationId);
          }}
        />
      )}
      
      {/* Statistics Modal - lazy loaded to avoid loading recharts upfront */}
      {isStatsOpen && (
        <ErrorBoundary
          fallback={
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div 
                className="p-6 rounded-xl max-w-sm text-center"
                style={{ backgroundColor: settings.backgroundColor, color: settings.textColor }}
              >
                <p className="mb-4">Unable to load statistics. Please try again.</p>
                <button
                  onClick={() => setIsStatsOpen(false)}
                  className="px-4 py-2 rounded-lg"
                  style={{ backgroundColor: settings.linkColor, color: '#fff' }}
                >
                  Close
                </button>
              </div>
            </div>
          }
        >
          <Suspense fallback={
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div 
                className="animate-spin rounded-full h-8 w-8 border-b-2" 
                style={{ borderColor: settings.linkColor }} 
              />
            </div>
          }>
            <StatisticsModal
              onClose={() => setIsStatsOpen(false)}
              archiveItems={items}
              accentColor={settings.linkColor}
            />
          </Suspense>
        </ErrorBoundary>
      )}
      
      {/* Bulk Action Toolbar (fixed at bottom when items are selected) */}
      {isSelectionMode && visibleSelectedCount > 0 && (
        <BulkActionToolbar
          selectedCount={visibleSelectedCount}
          collections={collections}
          activeCollectionId={activeCollectionId}
          items={items}
          selectedItemIds={selectedItemIds}
          onDelete={() => setBulkDeleteDialogOpen(true)}
          onAddToCollection={bulkAddToCollection}
          onRemoveFromCollection={bulkRemoveFromCollection}
          onCancel={exitSelectionMode}
        />
      )}
      
      {/* Bulk Delete Confirmation Dialog */}
      {isBulkDeleteDialogOpen && (
        <BulkDeleteDialog
          count={visibleSelectedCount}
          onClose={() => setBulkDeleteDialogOpen(false)}
          onConfirm={bulkDelete}
        />
      )}
    </div>
  );
}
