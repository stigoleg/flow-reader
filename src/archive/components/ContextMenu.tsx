/**
 * Context Menu
 * 
 * Right-click menu for archive items.
 */

import { useEffect, useRef, useState } from 'react';
import type { ArchiveItem, Collection } from '@/types';
import { getDocumentKeyFromArchiveItem, getAnnotationCount } from '@/lib/annotations-service';

interface ContextMenuProps {
  itemId: string;
  position: { x: number; y: number };
  items: ArchiveItem[];
  collections: Collection[];
  selectedItemIds?: Set<string>;
  activeCollectionId?: string | null;
  onOpen: (item: ArchiveItem) => void;
  onRemove: (id: string) => void;
  onRename: (id: string) => void;
  onToggleCollection: (itemId: string, collectionId: string) => void;
  onBulkAddToCollection?: (collectionId: string) => void;
  onBulkRemoveFromCollection?: (collectionId: string) => void;
  onBulkDelete?: () => void;
  onViewNotes?: (item: ArchiveItem) => void;
  onClose: () => void;
}

export default function ContextMenu({
  itemId,
  position,
  items,
  collections,
  selectedItemIds = new Set(),
  activeCollectionId,
  onOpen,
  onRemove,
  onRename,
  onToggleCollection,
  onBulkAddToCollection,
  onBulkRemoveFromCollection,
  onBulkDelete,
  onViewNotes,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showCollections, setShowCollections] = useState(false);
  const [annotationCount, setAnnotationCount] = useState<number>(0);
  const item = items.find(i => i.id === itemId);
  
  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (!menuRef.current) return;
    
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let x = position.x;
    let y = position.y;
    
    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 8;
    }
    
    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 8;
    }
    
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }, [position]);
  
  // Load annotation count for this item
  useEffect(() => {
    if (!item) return;
    const documentKey = getDocumentKeyFromArchiveItem(item);
    if (documentKey) {
      getAnnotationCount(documentKey).then(setAnnotationCount);
    }
  }, [item]);
  
  if (!item) return null;
  
  // Check if we should show bulk menu (right-clicked item is part of selection with multiple items)
  const isItemInSelection = selectedItemIds.has(itemId);
  const showBulkMenu = isItemInSelection && selectedItemIds.size > 1;
  const selectedCount = selectedItemIds.size;
  
  // Get active collection for "Remove from collection" option
  const activeCollection = activeCollectionId 
    ? collections.find(c => c.id === activeCollectionId) 
    : null;
  
  const handleCopyLink = () => {
    if (item.url) {
      navigator.clipboard.writeText(item.url);
    }
    onClose();
  };
  
  const handleToggleCollection = (collectionId: string) => {
    onToggleCollection(item.id, collectionId);
    // Don't close menu - allow multiple collection toggles
  };
  
  const isInCollection = (collectionId: string) => {
    return item.collectionIds?.includes(collectionId) ?? false;
  };
  
  /**
   * Calculate the collection membership state for bulk selections.
   * Returns: 'all' (all selected items are in collection), 'none' (none are), or 'some' (mixed)
   */
  const getBulkCollectionState = (collectionId: string): 'all' | 'none' | 'some' => {
    const selectedItems = items.filter(i => selectedItemIds.has(i.id));
    const inCollection = selectedItems.filter(i => i.collectionIds?.includes(collectionId));
    
    if (inCollection.length === 0) return 'none';
    if (inCollection.length === selectedItems.length) return 'all';
    return 'some';
  };
  
  /**
   * Handle bulk collection toggle with proper add/remove logic based on current state.
   */
  const handleBulkToggleCollection = (collectionId: string) => {
    const state = getBulkCollectionState(collectionId);
    if (state === 'all') {
      // All items are in collection - remove them
      onBulkRemoveFromCollection?.(collectionId);
    } else {
      // None or some items are in collection - add all
      onBulkAddToCollection?.(collectionId);
    }
  };
  
  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {showBulkMenu ? (
        // Bulk operations menu (when multiple items are selected)
        <>
          <div className="context-menu-item opacity-60" style={{ cursor: 'default', fontWeight: 500 }}>
            {selectedCount} items selected
          </div>
          
          <div className="context-menu-divider" />
          
          {/* Bulk add to collection */}
          <div className="relative">
            <button
              className="context-menu-item"
              onClick={() => setShowCollections(!showCollections)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="flex-1">Add to Collection</span>
              <svg 
                className={`w-4 h-4 transition-transform ${showCollections ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            {showCollections && (
              <div 
                className="context-submenu"
                style={{
                  position: 'absolute',
                  left: '100%',
                  top: 0,
                  minWidth: '160px',
                }}
              >
                {collections.length === 0 ? (
                  <div className="context-menu-item opacity-50" style={{ cursor: 'default' }}>
                    No collections
                  </div>
                ) : (
                  collections.map(collection => {
                    const state = getBulkCollectionState(collection.id);
                    return (
                      <button
                        key={collection.id}
                        className="context-menu-item"
                        onClick={() => {
                          handleBulkToggleCollection(collection.id);
                        }}
                      >
                        {/* Checkbox with indeterminate state support */}
                        <span className={`context-menu-checkbox ${state === 'all' ? 'checked' : ''} ${state === 'some' ? 'indeterminate' : ''}`}>
                          {state === 'all' && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {state === 'some' && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14" />
                            </svg>
                          )}
                        </span>
                        <span className="mr-2">{collection.icon || '📁'}</span>
                        <span className="flex-1">{collection.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
          
          {/* Bulk remove from collection (only when in a collection view) */}
          {activeCollection && (
            <button
              className="context-menu-item"
              onClick={() => {
                onBulkRemoveFromCollection?.(activeCollection.id);
                onClose();
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
              Remove from {activeCollection.name}
            </button>
          )}
          
          <div className="context-menu-divider" />
          
          {/* Bulk delete */}
          <button
            className="context-menu-item danger"
            onClick={() => {
              onBulkDelete?.();
              onClose();
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete {selectedCount} items
          </button>
        </>
      ) : (
        // Single item menu
        <>
          <button
            className="context-menu-item"
            onClick={() => {
              onOpen(item);
              onClose();
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Open
          </button>
          
          {item.url && (
            <button
              className="context-menu-item"
              onClick={handleCopyLink}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy Source Link
            </button>
          )}
          
          <button
            className="context-menu-item"
            onClick={() => {
              onRename(item.id);
              onClose();
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Rename
          </button>
          
          {/* View Notes - only show if item has annotations */}
          {annotationCount > 0 && onViewNotes && (
            <button
              className="context-menu-item"
              onClick={() => {
                onViewNotes(item);
                onClose();
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              View Notes ({annotationCount})
            </button>
          )}
          
          <div className="context-menu-divider" />
          
          {/* Collections submenu */}
          <div className="relative">
            <button
              className="context-menu-item"
              onClick={() => setShowCollections(!showCollections)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="flex-1">Add to Collection</span>
              <svg 
                className={`w-4 h-4 transition-transform ${showCollections ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            {/* Collections list */}
            {showCollections && (
              <div 
                className="context-submenu"
                style={{
                  position: 'absolute',
                  left: '100%',
                  top: 0,
                  minWidth: '160px',
                }}
              >
                {collections.length === 0 ? (
                  <div className="context-menu-item opacity-50" style={{ cursor: 'default' }}>
                    No collections
                  </div>
                ) : (
                  collections.map(collection => (
                    <button
                      key={collection.id}
                      className="context-menu-item"
                      onClick={() => handleToggleCollection(collection.id)}
                    >
                      {/* Checkbox indicator */}
                      <span className={`context-menu-checkbox ${isInCollection(collection.id) ? 'checked' : ''}`}>
                        {isInCollection(collection.id) && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="mr-2">{collection.icon || '📁'}</span>
                      <span className="flex-1">{collection.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          
          <div className="context-menu-divider" />
          
          <button
            className="context-menu-item danger"
            onClick={() => {
              onRemove(item.id);
              onClose();
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Remove from History
          </button>
        </>
      )}
    </div>
  );
}
