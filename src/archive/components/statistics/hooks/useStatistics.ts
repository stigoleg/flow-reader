/**
 * useStatistics Hook
 * 
 * Provides statistics data and computed metrics for the statistics dashboard.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { 
  ReadingStats, 
  TimeRange, 
  PeriodComparison,
  ArchiveItem,
} from '@/types';
import {
  getReadingStats,
  comparePeriods,
  getActivityForHeatmap,
  calculateDailyAverage,
  calculateFinishRate,
  getHourlyActivityData,
  calculateAverageWpm,
  checkGoalProgress,
  formatReadingTime,
  formatLargeNumber,
  getDailyStatsForRange,
  getWpmHistoryForRange,
} from '@/lib/stats-service';

interface UseStatisticsOptions {
  archiveItems: ArchiveItem[];
}

interface UseStatisticsResult {
  // Raw stats
  stats: ReadingStats | null;
  loading: boolean;
  
  // Time range
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  
  // KPIs
  kpis: {
    totalReadingTime: string;
    totalWordsRead: string;
    documentsCompleted: number;
    currentStreak: number;
    longestStreak: number;
    averageWpm: number;
    dailyAverage: number; // minutes
    finishRate: { rate: number; completed: number; started: number };
    totalAnnotations: number;
  };
  
  // Heatmap
  heatmapData: ReturnType<typeof getActivityForHeatmap>;
  heatmapMetric: 'time' | 'words' | 'documents' | 'combined';
  setHeatmapMetric: (metric: 'time' | 'words' | 'documents' | 'combined') => void;
  
  // Comparison
  comparisonType: 'week' | 'month' | 'year';
  setComparisonType: (type: 'week' | 'month' | 'year') => void;
  comparison: PeriodComparison | null;
  
  // Content breakdown
  contentBreakdown: Array<{ type: string; count: number; percent: number }>;
  progressBreakdown: { completed: number; inProgress: number; notStarted: number };
  
  // Hourly activity
  hourlyActivity: ReturnType<typeof getHourlyActivityData>;
  
  // Personal bests
  personalBests: ReadingStats['personalBests'] | null;
  
  // Goals
  goalProgress: ReturnType<typeof checkGoalProgress>;
  
  // Chart data
  dailyChartData: Array<{ date: string; minutes: number; words: number }>;
  wpmChartData: Array<{ date: string; wpm: number }>;
  
  // Refresh
  refresh: () => Promise<void>;
}

export function useStatistics({ archiveItems }: UseStatisticsOptions): UseStatisticsResult {
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>({ preset: '30d' });
  const [heatmapMetric, setHeatmapMetric] = useState<'time' | 'words' | 'documents' | 'combined'>('time');
  const [comparisonType, setComparisonType] = useState<'week' | 'month' | 'year'>('week');

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const readingStats = await getReadingStats();
      setStats(readingStats);
    } catch (error) {
      console.error('[useStatistics] Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // KPIs
  const kpis = useMemo(() => {
    if (!stats) {
      return {
        totalReadingTime: '0m',
        totalWordsRead: '0',
        documentsCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
        averageWpm: 0,
        dailyAverage: 0,
        finishRate: { rate: 0, completed: 0, started: 0 },
        totalAnnotations: 0,
      };
    }

    return {
      totalReadingTime: formatReadingTime(stats.totalReadingTimeMs),
      totalWordsRead: formatLargeNumber(stats.totalWordsRead),
      documentsCompleted: stats.totalDocumentsCompleted,
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      averageWpm: calculateAverageWpm(stats.wpmHistory),
      dailyAverage: calculateDailyAverage(stats, 30),
      finishRate: calculateFinishRate(stats),
      totalAnnotations: stats.totalAnnotationsCreated,
    };
  }, [stats]);

  // Heatmap data
  const heatmapData = useMemo(() => {
    if (!stats) return [];
    
    const days = timeRange.preset === '1y' ? 365 
      : timeRange.preset === '90d' ? 90 
      : timeRange.preset === '30d' ? 30 
      : timeRange.preset === '7d' ? 7 
      : 365; // default for 'all'
    
    return getActivityForHeatmap(stats, days, heatmapMetric);
  }, [stats, timeRange.preset, heatmapMetric]);

  // Period comparison
  const comparison = useMemo(() => {
    if (!stats) return null;
    return comparePeriods(stats, comparisonType);
  }, [stats, comparisonType]);

  // Content breakdown from archive items
  const contentBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of archiveItems) {
      counts[item.type] = (counts[item.type] || 0) + 1;
    }
    
    const total = archiveItems.length;
    return Object.entries(counts)
      .map(([type, count]) => ({ 
        type, 
        count, 
        percent: total > 0 ? Math.round((count / total) * 100) : 0 
      }))
      .sort((a, b) => b.count - a.count);
  }, [archiveItems]);

  // Progress breakdown
  const progressBreakdown = useMemo(() => {
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;

    for (const item of archiveItems) {
      const percent = item.progress?.percent ?? 0;
      if (percent >= 100) {
        completed++;
      } else if (percent > 0) {
        inProgress++;
      } else {
        notStarted++;
      }
    }

    return { completed, inProgress, notStarted };
  }, [archiveItems]);

  // Hourly activity
  const hourlyActivity = useMemo(() => {
    if (!stats) return [];
    return getHourlyActivityData(stats);
  }, [stats]);

  // Goal progress
  const goalProgress = useMemo(() => {
    if (!stats) return { daily: null, weekly: null, monthly: null };
    return checkGoalProgress(stats);
  }, [stats]);

  // Daily chart data
  const dailyChartData = useMemo(() => {
    if (!stats) return [];
    const dailyStats = getDailyStatsForRange(stats, 14);
    return dailyStats.map((day) => ({
      date: new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
      minutes: Math.round(day.readingTimeMs / 60000),
      words: day.wordsRead,
    }));
  }, [stats]);

  // WPM chart data
  const wpmChartData = useMemo(() => {
    if (!stats) return [];
    const wpmHistory = getWpmHistoryForRange(stats, 30);
    return wpmHistory.map((entry) => ({
      date: new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      wpm: entry.avgWpm,
    }));
  }, [stats]);

  return {
    stats,
    loading,
    timeRange,
    setTimeRange,
    kpis,
    heatmapData,
    heatmapMetric,
    setHeatmapMetric,
    comparisonType,
    setComparisonType,
    comparison,
    contentBreakdown,
    progressBreakdown,
    hourlyActivity,
    personalBests: stats?.personalBests ?? null,
    goalProgress,
    dailyChartData,
    wpmChartData,
    refresh: loadStats,
  };
}
