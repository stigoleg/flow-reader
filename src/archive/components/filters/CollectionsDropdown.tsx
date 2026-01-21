/**
 * CollectionsDropdown
 * 
 * Dropdown for filtering by collection.
 * Replaces multiple collection chips with a single compact dropdown.
 */

import { useState, useRef } from 'react';
import type { ArchiveItem, Collection } from '@/types';
import DropdownPortal from './DropdownPortal';

interface CollectionsDropdownProps {
  activeCollectionId: string | null;
  onCollectionChange: (collectionId: string | null) => void;
  items: ArchiveItem[];
  collections: Collection[];
  onManageCollections: () => void;
}

export default function CollectionsDropdown({
  activeCollectionId,
  onCollectionChange,
  items,
  collections,
  onManageCollections,
}: CollectionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Calculate counts for each collection
  const collectionCounts = collections.reduce((acc, collection) => {
    acc[collection.id] = items.filter(item => 
      item.collectionIds?.includes(collection.id)
    ).length;
    return acc;
  }, {} as Record<string, number>);

  const currentCollection = collections.find(c => c.id === activeCollectionId);
  const isActive = activeCollectionId !== null;

  const handleSelect = (collectionId: string | null) => {
    onCollectionChange(collectionId);
    setIsOpen(false);
  };

  const handleManageCollections = () => {
    setIsOpen(false);
    onManageCollections();
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`filter-dropdown-trigger ${isActive ? 'active' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Filter by collection: ${currentCollection?.name || 'All'}`}
      >
        {currentCollection?.color && (
          <span 
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: currentCollection.color }}
          />
        )}
        {!currentCollection?.color && (
          <svg 
            className="w-4 h-4 opacity-70" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" 
            />
          </svg>
        )}
        <span className="truncate max-w-[120px]">
          {currentCollection?.name || 'Collections'}
        </span>
        <svg 
          className={`w-3 h-3 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <DropdownPortal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        className="filter-dropdown-menu"
      >
        {/* All collections option */}
        <button
          onClick={() => handleSelect(null)}
          className={`filter-dropdown-item ${activeCollectionId === null ? 'selected' : ''}`}
          role="option"
          aria-selected={activeCollectionId === null}
        >
          <span className="filter-dropdown-item-label">All</span>
          <span className="filter-dropdown-item-count">{items.length}</span>
        </button>

        {/* Collection options */}
        {collections.map(collection => {
          const count = collectionCounts[collection.id] || 0;
          const isSelected = activeCollectionId === collection.id;
          
          return (
            <button
              key={collection.id}
              onClick={() => handleSelect(collection.id)}
              className={`filter-dropdown-item ${isSelected ? 'selected' : ''}`}
              role="option"
              aria-selected={isSelected}
            >
              <span className="filter-dropdown-item-label flex items-center gap-2">
                {collection.color && (
                  <span 
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: collection.color }}
                  />
                )}
                {collection.icon && !collection.color && (
                  <span className="text-sm">{collection.icon}</span>
                )}
                <span className="truncate">{collection.name}</span>
              </span>
              <span className="filter-dropdown-item-count">{count}</span>
            </button>
          );
        })}

        {/* Manage collections action */}
        <div className="filter-dropdown-divider" />
        <button
          onClick={handleManageCollections}
          className="filter-dropdown-item filter-dropdown-action"
        >
          <svg 
            className="w-4 h-4 opacity-60" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
            />
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
            />
          </svg>
          <span>Manage collections...</span>
        </button>
      </DropdownPortal>
    </>
  );
}
