/**
 * AppliedFilters
 * 
 * Shows active advanced filters as removable chips.
 * Only displays filters that are not visible in the primary controls.
 */

import type { DateFilter } from '../../store';

interface AppliedFiltersProps {
  hasNotesFilter: boolean;
  longReadsFilter: boolean;
  dateFilter: DateFilter;
  onHasNotesChange: (enabled: boolean) => void;
  onLongReadsChange: (enabled: boolean) => void;
  onDateFilterChange: (filter: DateFilter) => void;
  onClearAll: () => void;
}

const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  all: 'Any time',
  today: 'Today',
  week: 'Past week',
  month: 'Past month',
  year: 'Past year',
};

export default function AppliedFilters({
  hasNotesFilter,
  longReadsFilter,
  dateFilter,
  onHasNotesChange,
  onLongReadsChange,
  onDateFilterChange,
  onClearAll,
}: AppliedFiltersProps) {
  const hasActiveFilters = hasNotesFilter || longReadsFilter || dateFilter !== 'all';

  if (!hasActiveFilters) {
    return null;
  }

  return (
    <div className="applied-filters">
      <span className="applied-filters-label">Filters:</span>
      
      <div className="applied-filters-chips">
        {dateFilter !== 'all' && (
          <button
            className="applied-filter-chip"
            onClick={() => onDateFilterChange('all')}
            aria-label={`Remove time filter: ${DATE_FILTER_LABELS[dateFilter]}`}
          >
            {DATE_FILTER_LABELS[dateFilter]}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {hasNotesFilter && (
          <button
            className="applied-filter-chip"
            onClick={() => onHasNotesChange(false)}
            aria-label="Remove has notes filter"
          >
            Has notes
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {longReadsFilter && (
          <button
            className="applied-filter-chip"
            onClick={() => onLongReadsChange(false)}
            aria-label="Remove long reads filter"
          >
            Long reads
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        <button
          className="applied-filters-clear"
          onClick={onClearAll}
          aria-label="Clear all filters"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
