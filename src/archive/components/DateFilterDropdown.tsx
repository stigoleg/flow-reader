/**
 * Date Filter Dropdown
 * 
 * Dropdown for filtering archive items by date range.
 */

import { useState, useRef, useEffect } from 'react';
import type { DateFilter } from '../store';

interface DateFilterDropdownProps {
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
}

interface DateFilterOption {
  id: DateFilter;
  label: string;
}

const DATE_FILTER_OPTIONS: DateFilterOption[] = [
  { id: 'all', label: 'Any time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Past week' },
  { id: 'month', label: 'Past month' },
  { id: 'year', label: 'Past year' },
];

export default function DateFilterDropdown({
  dateFilter,
  onDateFilterChange,
}: DateFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const currentOption = DATE_FILTER_OPTIONS.find(opt => opt.id === dateFilter) || DATE_FILTER_OPTIONS[0];
  const isActive = dateFilter !== 'all';

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (option: DateFilterOption) => {
    onDateFilterChange(option.id);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`filter-chip ${isActive ? 'active' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Filter by date"
      >
        <svg 
          className="w-3.5 h-3.5 mr-1 opacity-70" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
          />
        </svg>
        {currentOption.label}
        <svg 
          className={`w-3 h-3 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div 
          className="absolute left-0 top-full mt-1 min-w-[140px] bg-[var(--reader-bg)] border border-gray-500/20 rounded-lg shadow-lg z-50 py-1"
          role="listbox"
          aria-label="Date filter options"
        >
          {DATE_FILTER_OPTIONS.map(option => (
            <button
              key={option.id}
              onClick={() => handleSelect(option)}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-500/10 transition-colors ${
                dateFilter === option.id ? 'text-[var(--reader-link)] font-medium' : ''
              }`}
              role="option"
              aria-selected={dateFilter === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
