/**
 * Filter Chips
 * 
 * Horizontal list of filter buttons for content types and collections.
 */

import type { ArchiveItem, ArchiveItemType, Collection } from '@/types';
import type { FilterType, SortOption, DateFilter, SmartCollectionId } from '../store';
import { SMART_COLLECTIONS } from '../store';
import SortDropdown from './SortDropdown';
import DateFilterDropdown from './DateFilterDropdown';

interface FilterChipsProps {
  activeFilter: FilterType;
  activeCollectionId: string | null;
  activeSmartCollectionId: SmartCollectionId | null;
  dateFilter: DateFilter;
  sortBy: SortOption;
  onFilterChange: (filter: FilterType) => void;
  onCollectionChange: (collectionId: string | null) => void;
  onSmartCollectionChange: (smartCollectionId: SmartCollectionId | null) => void;
  onDateFilterChange: (filter: DateFilter) => void;
  onSortChange: (sort: SortOption) => void;
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
  activeSmartCollectionId,
  dateFilter,
  sortBy,
  onFilterChange,
  onCollectionChange,
  onSmartCollectionChange,
  onDateFilterChange,
  onSortChange,
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
    // Clear collection and smart collection when switching to type filter
    if (activeCollectionId) {
      onCollectionChange(null);
    }
    if (activeSmartCollectionId) {
      onSmartCollectionChange(null);
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
  
  const handleSmartCollectionClick = (smartCollectionId: SmartCollectionId) => {
    if (activeSmartCollectionId === smartCollectionId) {
      // Clicking active smart collection clears it
      onSmartCollectionChange(null);
    } else {
      onSmartCollectionChange(smartCollectionId);
    }
  };
  
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div className="filter-chips overflow-x-auto">
        {/* Type filters */}
        {FILTERS.map(filter => {
          const count = counts[filter.id] || 0;
          const isActive = activeFilter === filter.id && !activeCollectionId && !activeSmartCollectionId;
          
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
              style={collection.color ? {
                borderColor: isActive ? collection.color : `${collection.color}50`,
                backgroundColor: isActive ? `${collection.color}20` : undefined,
              } : undefined}
            >
              {collection.color && (
                <span 
                  className="w-2 h-2 rounded-full mr-1.5 flex-shrink-0"
                  style={{ backgroundColor: collection.color }}
                />
              )}
              {collection.icon && !collection.color && (
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
        
        {/* Separator before smart collections */}
        <span className="mx-2 opacity-30">|</span>
        
        {/* Smart Collections */}
        {SMART_COLLECTIONS.map(smartCollection => {
          const isActive = activeSmartCollectionId === smartCollection.id;
          
          return (
            <button
              key={smartCollection.id}
              onClick={() => handleSmartCollectionClick(smartCollection.id)}
              className={`filter-chip ${isActive ? 'active' : ''}`}
              aria-pressed={isActive}
              title={smartCollection.description}
            >
              <span className="mr-1 opacity-80">{smartCollection.icon}</span>
              {smartCollection.name}
            </button>
          );
        })}
        
        {/* Date range filter */}
        <DateFilterDropdown
          dateFilter={dateFilter}
          onDateFilterChange={onDateFilterChange}
        />
      </div>
      
      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <SortDropdown sortBy={sortBy} onSortChange={onSortChange} />
          <button
            onClick={onClearHistory}
            className="text-sm opacity-50 hover:opacity-100 transition-opacity whitespace-nowrap"
            aria-label="Clear all history"
          >
            Clear History
          </button>
        </div>
      )}
    </div>
  );
}
