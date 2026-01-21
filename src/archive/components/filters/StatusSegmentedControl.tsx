/**
 * StatusSegmentedControl
 * 
 * Segmented control for filtering by reading status (Any, In Progress, Completed).
 * Replaces the In Progress and Completed smart collection chips.
 */

import type { StatusFilter } from '../../store';

interface StatusSegmentedControlProps {
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
}

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'any', label: 'Any' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
];

export default function StatusSegmentedControl({
  statusFilter,
  onStatusChange,
}: StatusSegmentedControlProps) {
  return (
    <div 
      className="segmented-control"
      role="tablist"
      aria-label="Filter by status"
    >
      {STATUS_OPTIONS.map(option => {
        const isSelected = statusFilter === option.id;
        
        return (
          <button
            key={option.id}
            onClick={() => onStatusChange(option.id)}
            className={`segmented-control-option ${isSelected ? 'selected' : ''}`}
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
