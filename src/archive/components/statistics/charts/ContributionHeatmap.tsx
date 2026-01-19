/**
 * ContributionHeatmap Component
 * 
 * GitHub-style contribution heatmap visualization for reading activity.
 */

import { useMemo } from 'react';

interface HeatmapDay {
  date: string;
  value: number;
  level: 0 | 1 | 2 | 3 | 4;
}

interface ContributionHeatmapProps {
  data: HeatmapDay[];
  accentColor: string;
  metric: 'time' | 'words' | 'documents' | 'combined';
  onMetricChange: (metric: 'time' | 'words' | 'documents' | 'combined') => void;
}

const METRICS = [
  { value: 'time' as const, label: 'Reading Time' },
  { value: 'words' as const, label: 'Words Read' },
  { value: 'documents' as const, label: 'Documents' },
  { value: 'combined' as const, label: 'Combined' },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ContributionHeatmap({ 
  data, 
  accentColor, 
  metric, 
  onMetricChange,
}: ContributionHeatmapProps) {
  // Group data by weeks for grid display
  const { weeks, months } = useMemo(() => {
    if (data.length === 0) return { weeks: [], months: [] };
    
    const weekData: HeatmapDay[][] = [];
    const monthLabels: { label: string; weekIndex: number }[] = [];
    
    let currentWeek: HeatmapDay[] = [];
    let lastMonth = '';
    
    // Pad the first week with empty days if needed
    const firstDate = new Date(data[0].date);
    const firstDayOfWeek = firstDate.getDay();
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push({ date: '', value: 0, level: 0 });
    }
    
    data.forEach((day, index) => {
      const date = new Date(day.date);
      const dayOfWeek = date.getDay();
      const month = date.toLocaleDateString(undefined, { month: 'short' });
      
      // Track month labels
      if (month !== lastMonth && dayOfWeek <= 6) {
        monthLabels.push({ label: month, weekIndex: weekData.length });
        lastMonth = month;
      }
      
      currentWeek.push(day);
      
      // Start new week on Sunday
      if (dayOfWeek === 6 || index === data.length - 1) {
        // Pad the last week if needed
        while (currentWeek.length < 7) {
          currentWeek.push({ date: '', value: 0, level: 0 });
        }
        weekData.push(currentWeek);
        currentWeek = [];
      }
    });
    
    return { weeks: weekData, months: monthLabels };
  }, [data]);

  // Get color for a level
  const getLevelColor = (level: 0 | 1 | 2 | 3 | 4): string => {
    if (level === 0) return 'var(--reader-text)';
    
    // Parse accent color to create opacity variations
    const opacities = [0.2, 0.4, 0.7, 1];
    return `color-mix(in srgb, ${accentColor} ${opacities[level - 1] * 100}%, transparent)`;
  };

  // Format tooltip value
  const formatValue = (day: HeatmapDay): string => {
    if (!day.date || day.value === 0) return 'No activity';
    
    const dateStr = new Date(day.date).toLocaleDateString(undefined, { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    
    let valueStr = '';
    switch (metric) {
      case 'time':
        valueStr = `${Math.round(day.value)} min`;
        break;
      case 'words':
        valueStr = `${Math.round(day.value).toLocaleString()} words`;
        break;
      case 'documents':
        valueStr = `${Math.round(day.value)} docs`;
        break;
      case 'combined':
        valueStr = `Score: ${Math.round(day.value)}`;
        break;
    }
    
    return `${dateStr}: ${valueStr}`;
  };

  return (
    <div className="space-y-3">
      {/* Metric selector */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {METRICS.map(m => (
            <button
              key={m.value}
              onClick={() => onMetricChange(m.value)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                metric === m.value 
                  ? 'text-white' 
                  : 'bg-reader-text/5 opacity-60 hover:opacity-100'
              }`}
              style={metric === m.value ? { backgroundColor: accentColor } : undefined}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Month labels */}
          <div className="flex mb-1 text-xs opacity-50" style={{ marginLeft: '28px' }}>
            {months.map((m, i) => (
              <div 
                key={i} 
                className="flex-shrink-0"
                style={{ 
                  width: `${((months[i + 1]?.weekIndex || weeks.length) - m.weekIndex) * 12}px`,
                  marginLeft: i === 0 ? `${m.weekIndex * 12}px` : 0,
                }}
              >
                {m.label}
              </div>
            ))}
          </div>
          
          {/* Grid with day labels */}
          <div className="flex">
            {/* Day of week labels */}
            <div className="flex flex-col gap-[2px] mr-1 text-xs opacity-50">
              {DAYS_OF_WEEK.map((day, i) => (
                <div key={day} className="h-[10px] flex items-center" style={{ fontSize: '9px' }}>
                  {i % 2 === 1 ? day : ''}
                </div>
              ))}
            </div>
            
            {/* Heatmap cells */}
            <div className="flex gap-[2px]">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-[2px]">
                  {week.map((day, dayIndex) => (
                    <div
                      key={`${weekIndex}-${dayIndex}`}
                      className="w-[10px] h-[10px] rounded-sm transition-colors"
                      style={{
                        backgroundColor: day.date 
                          ? getLevelColor(day.level) 
                          : 'transparent',
                        opacity: day.date ? (day.level === 0 ? 0.1 : 1) : 0,
                      }}
                      title={day.date ? formatValue(day) : undefined}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-end gap-1 mt-2 text-xs opacity-50">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map(level => (
              <div
                key={level}
                className="w-[10px] h-[10px] rounded-sm"
                style={{ 
                  backgroundColor: getLevelColor(level as 0 | 1 | 2 | 3 | 4),
                  opacity: level === 0 ? 0.1 : 1,
                }}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
