/**
 * TimeRangeSelector Component
 * 
 * Dropdown for selecting time range presets with optional custom date picker.
 */

import { useState } from 'react';
import type { TimeRange, TimeRangePreset } from '@/types';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  accentColor: string;
}

const PRESETS: { value: TimeRangePreset; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

export function TimeRangeSelector({ value, onChange, accentColor }: TimeRangeSelectorProps) {
  const [showCustom, setShowCustom] = useState(value.preset === 'custom');
  const [startDate, setStartDate] = useState(value.startDate || '');
  const [endDate, setEndDate] = useState(value.endDate || '');

  const handlePresetChange = (preset: TimeRangePreset) => {
    if (preset === 'custom') {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      onChange({ preset });
    }
  };

  const handleCustomApply = () => {
    if (startDate && endDate) {
      onChange({ preset: 'custom', startDate, endDate });
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <select
          value={value.preset}
          onChange={(e) => handlePresetChange(e.target.value as TimeRangePreset)}
          className="px-3 py-1.5 rounded-lg bg-reader-text/5 text-sm border border-reader-text/10 focus:outline-none focus:ring-2"
          style={{ 
            '--tw-ring-color': accentColor,
          } as React.CSSProperties}
        >
          {PRESETS.map(preset => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
        
        {showCustom && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 rounded bg-reader-text/5 text-sm border border-reader-text/10"
            />
            <span className="text-xs opacity-50">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 rounded bg-reader-text/5 text-sm border border-reader-text/10"
            />
            <button
              onClick={handleCustomApply}
              disabled={!startDate || !endDate}
              className="px-3 py-1 rounded text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              Apply
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
