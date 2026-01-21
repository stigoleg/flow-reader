/**
 * AdvancedFiltersPopover
 * 
 * Popover containing less frequently used filters:
 * - Has Notes toggle
 * - Long Reads toggle  
 * - Time filter dropdown
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { DateFilter } from '../../store';

interface AdvancedFiltersPopoverProps {
  hasNotesFilter: boolean;
  longReadsFilter: boolean;
  dateFilter: DateFilter;
  onHasNotesChange: (enabled: boolean) => void;
  onLongReadsChange: (enabled: boolean) => void;
  onDateFilterChange: (filter: DateFilter) => void;
}

const DATE_FILTER_OPTIONS: { id: DateFilter; label: string }[] = [
  { id: 'all', label: 'Any time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Past week' },
  { id: 'month', label: 'Past month' },
  { id: 'year', label: 'Past year' },
];

export default function AdvancedFiltersPopover({
  hasNotesFilter,
  longReadsFilter,
  dateFilter,
  onHasNotesChange,
  onLongReadsChange,
  onDateFilterChange,
}: AdvancedFiltersPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Count active advanced filters for badge
  const activeCount = [
    hasNotesFilter,
    longReadsFilter,
    dateFilter !== 'all',
  ].filter(Boolean).length;

  // Calculate position based on trigger element
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const popoverWidth = 280;
    const padding = 16;

    let left = rect.left;
    // Ensure popover doesn't go off screen
    if (left + popoverWidth > viewportWidth - padding) {
      left = viewportWidth - popoverWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }

    setPosition({
      top: rect.bottom + 4,
      left,
    });
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`filter-dropdown-trigger ${activeCount > 0 ? 'active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Advanced filters"
      >
        <svg 
          className="w-4 h-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" 
          />
        </svg>
        <span className="hidden sm:inline">Filters</span>
        {activeCount > 0 && (
          <span className="filter-badge">{activeCount}</span>
        )}
      </button>

      {isOpen && createPortal(
        <div
          ref={popoverRef}
          className="advanced-filters-popover"
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            zIndex: 9999,
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Advanced filters"
        >
          <div className="advanced-filters-header">
            <span className="font-medium">Filters</span>
            <button
              onClick={() => setIsOpen(false)}
              className="advanced-filters-close"
              aria-label="Close filters"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="advanced-filters-content">
            {/* Has Notes Toggle */}
            <label className="advanced-filter-toggle">
              <span className="advanced-filter-toggle-label">
                <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Has notes
              </span>
              <button
                role="switch"
                aria-checked={hasNotesFilter}
                onClick={() => onHasNotesChange(!hasNotesFilter)}
                className={`toggle-switch ${hasNotesFilter ? 'on' : ''}`}
              >
                <span className="toggle-switch-thumb" />
              </button>
            </label>

            {/* Long Reads Toggle */}
            <label className="advanced-filter-toggle">
              <span className="advanced-filter-toggle-label">
                <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Long reads (10k+ words)
              </span>
              <button
                role="switch"
                aria-checked={longReadsFilter}
                onClick={() => onLongReadsChange(!longReadsFilter)}
                className={`toggle-switch ${longReadsFilter ? 'on' : ''}`}
              >
                <span className="toggle-switch-thumb" />
              </button>
            </label>

            {/* Time Filter */}
            <div className="advanced-filter-section">
              <span className="advanced-filter-section-label">
                <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Time range
              </span>
              <div className="advanced-filter-options">
                {DATE_FILTER_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    onClick={() => onDateFilterChange(option.id)}
                    className={`advanced-filter-option ${dateFilter === option.id ? 'selected' : ''}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
