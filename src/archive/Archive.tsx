/**
 * Archive Page
 * 
 * Main entry point for the Archive - shows recent items, search, filters,
 * and provides drag-and-drop and paste import.
 */

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useArchiveStore, selectFilteredItems, selectSearchFilteredItems } from './store';
import ArchiveHeader from './components/ArchiveHeader';
import FilterChips from './components/FilterChips';
import ArchiveList from './components/ArchiveList';
import EmptyState from './components/EmptyState';
import DropOverlay from './components/DropOverlay';
import PasteModal from './components/PasteModal';
import ClearHistoryDialog from './components/ClearHistoryDialog';
import ContextMenu from './components/ContextMenu';
import ArchiveSettingsPanel from './components/ArchiveSettingsPanel';
import { getSettings } from '@/lib/storage';
import { DEFAULT_SETTINGS, type ReaderSettings } from '@/types';

export default function Archive() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Local settings state (for theme colors)
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  
  // Store state
  const items = useArchiveStore(state => state.items);
  const isLoading = useArchiveStore(state => state.isLoading);
  const error = useArchiveStore(state => state.error);
  const searchQuery = useArchiveStore(state => state.searchQuery);
  const activeFilter = useArchiveStore(state => state.activeFilter);
  const focusedItemIndex = useArchiveStore(state => state.focusedItemIndex);
  const isDragging = useArchiveStore(state => state.isDragging);
  const isPasteModalOpen = useArchiveStore(state => state.isPasteModalOpen);
  const isClearDialogOpen = useArchiveStore(state => state.isClearDialogOpen);
  const isSettingsOpen = useArchiveStore(state => state.isSettingsOpen);
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
  const setFocusedItemIndex = useArchiveStore(state => state.setFocusedItemIndex);
  const openItem = useArchiveStore(state => state.openItem);
  const removeItem = useArchiveStore(state => state.removeItem);
  const importFile = useArchiveStore(state => state.importFile);
  const importPaste = useArchiveStore(state => state.importPaste);
  const setDragging = useArchiveStore(state => state.setDragging);
  const setPasteModalOpen = useArchiveStore(state => state.setPasteModalOpen);
  const setClearDialogOpen = useArchiveStore(state => state.setClearDialogOpen);
  const hideContextMenu = useArchiveStore(state => state.hideContextMenu);
  const startRenaming = useArchiveStore(state => state.startRenaming);
  const toggleSettings = useArchiveStore(state => state.toggleSettings);
  
  // Get filtered items
  const filteredItems = useMemo(
    () => selectFilteredItems({ items, searchQuery, activeFilter } as ReturnType<typeof useArchiveStore.getState>),
    [items, searchQuery, activeFilter]
  );
  
  // Get search-filtered items (for filter chip counts - filtered by search but not by type)
  const searchFilteredItems = useMemo(
    () => selectSearchFilteredItems({ items, searchQuery, activeFilter } as ReturnType<typeof useArchiveStore.getState>),
    [items, searchQuery, activeFilter]
  );
  
  // Load items and settings on mount
  useEffect(() => {
    loadItems();
    
    // Apply theme settings
    getSettings().then(loadedSettings => {
      setSettings(loadedSettings);
      const root = document.documentElement;
      root.style.setProperty('--reader-bg', loadedSettings.backgroundColor);
      root.style.setProperty('--reader-text', loadedSettings.textColor);
      root.style.setProperty('--reader-link', loadedSettings.linkColor);
      root.style.setProperty('--reader-selection', loadedSettings.selectionColor);
      root.style.setProperty('--reader-highlight', loadedSettings.highlightColor);
      document.body.style.backgroundColor = loadedSettings.backgroundColor;
      document.body.style.color = loadedSettings.textColor;
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
    
    const file = e.dataTransfer?.files[0];
    if (file) {
      await importFile(file);
    }
  }, [setDragging, importFile]);
  
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
    
    switch (e.key) {
      case '/':
        if (!isInInput) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
        break;
        
      case 'Escape':
        if (isPasteModalOpen) {
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
    searchQuery,
    filteredItems,
    focusedItemIndex,
    setPasteModalOpen,
    setClearDialogOpen,
    setSearchQuery,
    setFocusedItemIndex,
    openItem,
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
    const file = e.target.files?.[0];
    if (file) {
      await importFile(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [importFile]);
  
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
        settings={settings}
      />
      
      {/* Main content */}
      <main className="archive-content">
        {/* Filters */}
        <FilterChips
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          items={searchFilteredItems}
          onClearHistory={() => setClearDialogOpen(true)}
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
            hasFilter={activeFilter !== 'all'}
            onImportClick={handleImportClick}
            onPasteClick={() => setPasteModalOpen(true)}
          />
        )}
        
        {!isLoading && filteredItems.length > 0 && (
          <ArchiveList
            items={filteredItems}
            focusedIndex={focusedItemIndex}
            onItemClick={openItem}
            onItemRemove={removeItem}
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
          onOpen={openItem}
          onRemove={removeItem}
          onRename={startRenaming}
          onClose={hideContextMenu}
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
    </div>
  );
}
