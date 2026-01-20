/**
 * GoalEditor Component
 * 
 * Modal for setting and editing reading goals.
 */

import { useState, useEffect } from 'react';
import type { ReadingGoals } from '@/types';
import { saveReadingGoals } from '@/lib/stats-service';

interface GoalEditorProps {
  currentGoals: ReadingGoals | null;
  onClose: () => void;
  onSave: () => void;
  accentColor: string;
}

export function GoalEditor({ currentGoals, onClose, onSave, accentColor }: GoalEditorProps) {
  const [dailyMinutes, setDailyMinutes] = useState<string>(
    currentGoals?.dailyMinutes?.toString() ?? ''
  );
  const [weeklyMinutes, setWeeklyMinutes] = useState<string>(
    currentGoals?.weeklyMinutes?.toString() ?? ''
  );
  const [monthlyDocuments, setMonthlyDocuments] = useState<string>(
    currentGoals?.monthlyDocuments?.toString() ?? ''
  );
  const [saving, setSaving] = useState(false);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const goals: ReadingGoals = {};
      
      const daily = parseInt(dailyMinutes, 10);
      if (!isNaN(daily) && daily > 0) {
        goals.dailyMinutes = daily;
      }
      
      const weekly = parseInt(weeklyMinutes, 10);
      if (!isNaN(weekly) && weekly > 0) {
        goals.weeklyMinutes = weekly;
      }
      
      const monthly = parseInt(monthlyDocuments, 10);
      if (!isNaN(monthly) && monthly > 0) {
        goals.monthlyDocuments = monthly;
      }
      
      await saveReadingGoals(goals);
      onSave();
      onClose();
    } catch (error) {
      console.error('[GoalEditor] Failed to save goals:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await saveReadingGoals({});
      setDailyMinutes('');
      setWeeklyMinutes('');
      setMonthlyDocuments('');
      onSave();
      onClose();
    } catch (error) {
      console.error('[GoalEditor] Failed to clear goals:', error);
    } finally {
      setSaving(false);
    }
  };

  // Suggested goals based on common patterns
  const suggestions = {
    daily: [15, 30, 45, 60],
    weekly: [60, 120, 180, 300],
    monthly: [2, 4, 8, 12],
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md rounded-lg shadow-xl"
        style={{ backgroundColor: 'var(--reader-bg)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-reader-text/10">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <h2 className="text-lg font-semibold">Set Reading Goals</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-reader-text/10 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Daily Goal */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Daily Reading Goal
              <span className="opacity-50 font-normal ml-1">(minutes)</span>
            </label>
            <input
              type="number"
              min="1"
              max="480"
              value={dailyMinutes}
              onChange={(e) => setDailyMinutes(e.target.value)}
              placeholder="e.g., 30"
              className="w-full px-3 py-2 rounded-lg border border-reader-text/20 bg-transparent focus:outline-none focus:ring-2 transition-all"
              style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
            />
            <div className="flex gap-2 mt-2">
              {suggestions.daily.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDailyMinutes(val.toString())}
                  className="px-2 py-1 text-xs rounded bg-reader-text/10 hover:bg-reader-text/20 transition-colors"
                >
                  {val} min
                </button>
              ))}
            </div>
          </div>

          {/* Weekly Goal */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Weekly Reading Goal
              <span className="opacity-50 font-normal ml-1">(minutes)</span>
            </label>
            <input
              type="number"
              min="1"
              max="2400"
              value={weeklyMinutes}
              onChange={(e) => setWeeklyMinutes(e.target.value)}
              placeholder="e.g., 180"
              className="w-full px-3 py-2 rounded-lg border border-reader-text/20 bg-transparent focus:outline-none focus:ring-2 transition-all"
              style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
            />
            <div className="flex gap-2 mt-2">
              {suggestions.weekly.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setWeeklyMinutes(val.toString())}
                  className="px-2 py-1 text-xs rounded bg-reader-text/10 hover:bg-reader-text/20 transition-colors"
                >
                  {val >= 60 ? `${val / 60}h` : `${val}m`}
                </button>
              ))}
            </div>
          </div>

          {/* Monthly Document Goal */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Monthly Completion Goal
              <span className="opacity-50 font-normal ml-1">(documents)</span>
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={monthlyDocuments}
              onChange={(e) => setMonthlyDocuments(e.target.value)}
              placeholder="e.g., 4"
              className="w-full px-3 py-2 rounded-lg border border-reader-text/20 bg-transparent focus:outline-none focus:ring-2 transition-all"
              style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
            />
            <div className="flex gap-2 mt-2">
              {suggestions.monthly.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMonthlyDocuments(val.toString())}
                  className="px-2 py-1 text-xs rounded bg-reader-text/10 hover:bg-reader-text/20 transition-colors"
                >
                  {val} docs
                </button>
              ))}
            </div>
          </div>

          {/* Tip */}
          <div className="p-3 rounded-lg bg-reader-text/5 text-sm">
            <p className="opacity-70">
              Leave a field empty to disable that goal. Goals help you build consistent reading habits!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-reader-text/10">
          <button
            onClick={handleClear}
            disabled={saving}
            className="px-3 py-2 text-sm rounded text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            Clear All Goals
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded hover:bg-reader-text/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm rounded font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {saving ? 'Saving...' : 'Save Goals'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
