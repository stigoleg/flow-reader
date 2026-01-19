/**
 * Filter Chips
 * 
 * Horizontal list of filter buttons for content types and collections.
 */

import type { ArchiveItem, ArchiveItemType, Collection } from '@/types';
import type { FilterType } from '../store';

interface FilterChipsProps {
  activeFilter: FilterType;
  activeCollectionId: string | null;
  onFilterChange: (filter: FilterType) => void;
  onCollectionChange: (collectionId: string | null) => void;
  items: ArchiveItem[];
  collections: Collection[];
  onClearHistory: () => void;
  onManageCollections: () => void;
}

interface FilterConfig {
  id: FilterType;
  label: string;
  types?: ArchiveItemType[];
}

const FILTERS: FilterConfig[] = [
  { id: 'all', label: 'All' },
  { id: 'web', label: 'Web', types: ['web'] },
  { id: 'pdf', label: 'PDF', types: ['pdf'] },
  { id: 'docx', label: 'Word', types: ['docx'] },
  { id: 'books', label: 'Books', types: ['epub', 'mobi'] },
  { id: 'paste', label: 'Paste', types: ['paste'] },
];

export default function FilterChips({ 
  activeFilter, 
  activeCollectionId,
  onFilterChange,
  onCollectionChange,
  items,
  collections,
  onClearHistory,
  onManageCollections,
}: FilterChipsProps) {
  // Calculate counts for each filter
  const counts = FILTERS.reduce((acc, filter) => {
    if (filter.id === 'all') {
      acc[filter.id] = items.length;
    } else if (filter.types) {
      acc[filter.id] = items.filter(item => filter.types!.includes(item.type)).length;
    }
    return acc;
  }, {} as Record<FilterType, number>);
  
  // Calculate counts for each collection
  const collectionCounts = collections.reduce((acc, collection) => {
    acc[collection.id] = items.filter(item => 
      item.collectionIds?.includes(collection.id)
    ).length;
    return acc;
  }, {} as Record<string, number>);
  
  const handleFilterClick = (filterId: FilterType) => {
    // Clear collection when switching to type filter
    if (activeCollectionId) {
      onCollectionChange(null);
    }
    onFilterChange(filterId);
  };
  
  const handleCollectionClick = (collectionId: string) => {
    if (activeCollectionId === collectionId) {
      // Clicking active collection clears it
      onCollectionChange(null);
    } else {
      onCollectionChange(collectionId);
    }
  };
  
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div className="filter-chips overflow-x-auto">
        {/* Type filters */}
        {FILTERS.map(filter => {
          const count = counts[filter.id] || 0;
          const isActive = activeFilter === filter.id && !activeCollectionId;
          
          // Hide filters with no items (except All)
          if (filter.id !== 'all' && count === 0) {
            return null;
          }
          
          return (
            <button
              key={filter.id}
              onClick={() => handleFilterClick(filter.id)}
              className={`filter-chip ${isActive ? 'active' : ''}`}
              aria-pressed={isActive}
            >
              {filter.label}
              {count > 0 && (
                <span 
                  className="ml-1.5 text-xs opacity-70"
                  style={isActive ? { opacity: 0.9 } : undefined}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
        
        {/* Separator between type filters and collections */}
        {collections.length > 0 && (
          <span className="mx-2 opacity-30">|</span>
        )}
        
        {/* Collection filters */}
        {collections.map(collection => {
          const count = collectionCounts[collection.id] || 0;
          const isActive = activeCollectionId === collection.id;
          
          return (
            <button
              key={collection.id}
              onClick={() => handleCollectionClick(collection.id)}
              className={`filter-chip ${isActive ? 'active' : ''}`}
              aria-pressed={isActive}
            >
              {collection.icon && (
                <span className="mr-1">{collection.icon}</span>
              )}
              {collection.name}
              {count > 0 && (
                <span 
                  className="ml-1.5 text-xs opacity-70"
                  style={isActive ? { opacity: 0.9 } : undefined}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
        
        {/* Manage collections button */}
        <button
          onClick={onManageCollections}
          className="filter-chip opacity-60 hover:opacity-100"
          aria-label="Manage collections"
          title="Manage collections"
        >
          +
        </button>
      </div>
      
      {items.length > 0 && (
        <button
          onClick={onClearHistory}
          className="text-sm opacity-50 hover:opacity-100 transition-opacity whitespace-nowrap"
          aria-label="Clear all history"
        >
          Clear History
        </button>
      )}
    </div>
  );
}
