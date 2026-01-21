/**
 * FilterBar
 * 
 * Compact filter bar that replaces the old FilterChips component.
 * Reduces visual clutter by using dropdowns instead of individual chips.
 */

import type { ArchiveItem, Collection } from '@/types';
import type { FilterType, SortOption, DateFilter, StatusFilter } from '../../store';
import TypeDropdown from './TypeDropdown';
import CollectionsDropdown from './CollectionsDropdown';
import StatusSegmentedControl from './StatusSegmentedControl';
import AdvancedFiltersPopover from './AdvancedFiltersPopover';
import AppliedFilters from './AppliedFilters';
import SortDropdown from '../SortDropdown';

interface FilterBarProps {
  // Type filter
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  
  // Collection filter
  activeCollectionId: string | null;
  onCollectionChange: (collectionId: string | null) => void;
  collections: Collection[];
  onManageCollections: () => void;
  
  // Status filter
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  
  // Advanced filters
  hasNotesFilter: boolean;
  longReadsFilter: boolean;
  dateFilter: DateFilter;
  onHasNotesChange: (enabled: boolean) => void;
  onLongReadsChange: (enabled: boolean) => void;
  onDateFilterChange: (filter: DateFilter) => void;
  
  // Sort
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  
  // Items for counts
  items: ArchiveItem[];
}

export default function FilterBar({
  activeFilter,
  onFilterChange,
  activeCollectionId,
  onCollectionChange,
  collections,
  onManageCollections,
  statusFilter,
  onStatusChange,
  hasNotesFilter,
  longReadsFilter,
  dateFilter,
  onHasNotesChange,
  onLongReadsChange,
  onDateFilterChange,
  sortBy,
  onSortChange,
  items,
}: FilterBarProps) {
  // Handler to clear only advanced filters (not type/collection/status)
  const handleClearAdvancedFilters = () => {
    onHasNotesChange(false);
    onLongReadsChange(false);
    onDateFilterChange('all');
  };

  return (
    <div className="filter-bar">
      {/* Primary row */}
      <div className="filter-bar-primary">
        {/* Left side: Main filters */}
        <div className="filter-bar-left">
          <TypeDropdown
            activeFilter={activeFilter}
            onFilterChange={onFilterChange}
            items={items}
          />
          
          <CollectionsDropdown
            activeCollectionId={activeCollectionId}
            onCollectionChange={onCollectionChange}
            items={items}
            collections={collections}
            onManageCollections={onManageCollections}
          />
          
          <StatusSegmentedControl
            statusFilter={statusFilter}
            onStatusChange={onStatusChange}
          />
        </div>

        {/* Right side: Advanced filters & Sort */}
        <div className="filter-bar-right">
          <AdvancedFiltersPopover
            hasNotesFilter={hasNotesFilter}
            longReadsFilter={longReadsFilter}
            dateFilter={dateFilter}
            onHasNotesChange={onHasNotesChange}
            onLongReadsChange={onLongReadsChange}
            onDateFilterChange={onDateFilterChange}
          />
          
          <SortDropdown
            sortBy={sortBy}
            onSortChange={onSortChange}
          />
        </div>
      </div>

      {/* Applied filters row */}
      <AppliedFilters
        hasNotesFilter={hasNotesFilter}
        longReadsFilter={longReadsFilter}
        dateFilter={dateFilter}
        onHasNotesChange={onHasNotesChange}
        onLongReadsChange={onLongReadsChange}
        onDateFilterChange={onDateFilterChange}
        onClearAll={handleClearAdvancedFilters}
      />
    </div>
  );
}
