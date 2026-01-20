/**
 * Bulk Action Toolbar
 * 
 * Fixed toolbar at bottom of screen when items are selected.
 * Provides batch operations: delete, add to collection, remove from collection.
 */

import { useState } from 'react';
import type { ArchiveItem, Collection } from '@/types';

interface BulkActionToolbarProps {
  selectedCount: number;
  collections: Collection[];
  activeCollectionId: string | null;
  items: ArchiveItem[];
  selectedItemIds: Set<string>;
  onDelete: () => void;
  onAddToCollection: (collectionId: string) => void;
  onRemoveFromCollection: (collectionId: string) => void;
  onMarkAsRead: () => void;
  onMarkAsUnread: () => void;
  onCancel: () => void;
}

export default function BulkActionToolbar({
  selectedCount,
  collections,
  activeCollectionId,
  items,
  selectedItemIds,
  onDelete,
  onAddToCollection,
  onRemoveFromCollection,
  onMarkAsRead,
  onMarkAsUnread,
  onCancel,
}: BulkActionToolbarProps) {
  const [showCollectionMenu, setShowCollectionMenu] = useState(false);
  
  if (selectedCount === 0) return null;
  
  const activeCollection = activeCollectionId 
    ? collections.find(c => c.id === activeCollectionId)
    : null;
  
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
      onRemoveFromCollection(collectionId);
    } else {
      // None or some items are in collection - add all
      onAddToCollection(collectionId);
    }
    setShowCollectionMenu(false);
  };
  
  return (
    <div className="bulk-action-toolbar">
      <div className="bulk-action-toolbar-content">
        {/* Selection count */}
        <span className="bulk-action-count">
          {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
        </span>
        
        {/* Actions */}
        <div className="bulk-action-buttons">
          {/* Add to Collection */}
          <div className="relative">
            <button
              className="bulk-action-button"
              onClick={() => setShowCollectionMenu(!showCollectionMenu)}
              title="Add to collection"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Add to Collection</span>
              <svg 
                className={`w-4 h-4 transition-transform ${showCollectionMenu ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Collection dropdown menu (appears above the toolbar) */}
            {showCollectionMenu && (
              <div className="bulk-action-collection-menu">
                {collections.length === 0 ? (
                  <div className="bulk-action-collection-item disabled">
                    No collections
                  </div>
                ) : (
                  collections.map(collection => {
                    const state = getBulkCollectionState(collection.id);
                    return (
                      <button
                        key={collection.id}
                        className="bulk-action-collection-item"
                        onClick={() => handleBulkToggleCollection(collection.id)}
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
                        <span>{collection.icon || '📁'}</span>
                        <span>{collection.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
          
          {/* Remove from Collection (only in collection view) */}
          {activeCollection && (
            <button
              className="bulk-action-button"
              onClick={() => onRemoveFromCollection(activeCollection.id)}
              title={`Remove from ${activeCollection.name}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
              <span>Remove from {activeCollection.name}</span>
            </button>
          )}
          
          {/* Mark as Read */}
          <button
            className="bulk-action-button"
            onClick={onMarkAsRead}
            title="Mark as read"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Mark Read</span>
          </button>
          
          {/* Mark as Unread */}
          <button
            className="bulk-action-button"
            onClick={onMarkAsUnread}
            title="Mark as unread"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
            </svg>
            <span>Mark Unread</span>
          </button>
          
          {/* Delete */}
          <button
            className="bulk-action-button danger"
            onClick={onDelete}
            title="Delete selected items"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Delete</span>
          </button>
          
          {/* Cancel */}
          <button
            className="bulk-action-button secondary"
            onClick={onCancel}
            title="Cancel selection"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
