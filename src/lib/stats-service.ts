/**
 * Statistics Service
 * 
 * Handles recording and retrieving reading statistics.
 * Stats are stored in chrome.storage.local and include:
 * - Daily reading time and activity
 * - Reading streaks
 * - WPM history
 * - Lifetime totals
 * - Weekly aggregates for long-term history
 * - Hourly activity patterns
 * - Personal bests
 */

import type { 
  ReadingStats, 
  DailyStats, 
  RecordSessionParams,
  WpmHistoryEntry,
  WeeklyStats,
  HourlyActivity,
  PeriodStats,
  PeriodComparison,
  TimeRange,
  ReadingGoals,
} from '@/types';
import { DEFAULT_READING_STATS } from '@/types';
import { AsyncMutex } from './async-mutex';

const READING_STATS_KEY = 'readingStats';
const MAX_DAILY_HISTORY_DAYS = 90;
const MAX_WPM_HISTORY_ENTRIES = 90;
const MAX_WEEKLY_HISTORY_WEEKS = 104; // ~2 years of weekly data

/** Mutex for stats read-modify-write operations */
const statsMutex = new AsyncMutex();

/**
 * Get the current reading stats from storage
 */
export async function getReadingStats(): Promise<ReadingStats> {
  try {
    const result = await chrome.storage.local.get(READING_STATS_KEY);
    if (result[READING_STATS_KEY]) {
      // Merge with defaults to handle schema upgrades
      return { ...DEFAULT_READING_STATS, ...result[READING_STATS_KEY] };
    }
    return { ...DEFAULT_READING_STATS };
  } catch (error) {
    console.error('[Stats] Failed to get reading stats:', error);
    return { ...DEFAULT_READING_STATS };
  }
}

/**
 * Save reading stats to storage
 */
export async function saveReadingStats(stats: ReadingStats): Promise<void> {
  try {
    await chrome.storage.local.set({ [READING_STATS_KEY]: stats });
  } catch (error) {
    console.error('[Stats] Failed to save reading stats:', error);
  }
}

/**
 * Get today's date as an ISO string (YYYY-MM-DD)
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get yesterday's date as an ISO string
 */
function getYesterdayDateString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * Initialize or get today's daily stats
 */
function getOrCreateDailyStats(stats: ReadingStats, date: string): DailyStats {
  if (stats.dailyStats[date]) {
    return stats.dailyStats[date];
  }
  return {
    date,
    readingTimeMs: 0,
    wordsRead: 0,
    documentsOpened: [],
    documentsCompleted: [],
    annotationsCreated: 0,
  };
}

/**
 * Update streak based on last reading date
 */
function updateStreak(stats: ReadingStats, today: string): void {
  const { lastReadingDate, currentStreak, longestStreak } = stats;
  
  if (!lastReadingDate) {
    // First reading ever
    stats.currentStreak = 1;
    stats.longestStreak = Math.max(1, longestStreak);
  } else if (lastReadingDate === today) {
    // Already read today, no change
  } else if (lastReadingDate === getYesterdayDateString()) {
    // Read yesterday, extend streak
    stats.currentStreak = currentStreak + 1;
    stats.longestStreak = Math.max(stats.currentStreak, longestStreak);
  } else {
    // Streak broken, start fresh
    stats.currentStreak = 1;
  }
  
  stats.lastReadingDate = today;
}

/**
 * Get the Monday of a given date's week (ISO week starts on Monday)
 */
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

/**
 * Aggregate old daily stats into weekly stats before removing them
 */
function aggregateDailyToWeekly(stats: ReadingStats, dailyStats: DailyStats[]): void {
  // Group daily stats by week
  const weeklyMap = new Map<string, DailyStats[]>();
  
  for (const daily of dailyStats) {
    const weekStart = getWeekStart(new Date(daily.date));
    if (!weeklyMap.has(weekStart)) {
      weeklyMap.set(weekStart, []);
    }
    weeklyMap.get(weekStart)!.push(daily);
  }
  
  // Aggregate each week
  for (const [weekStart, days] of weeklyMap) {
    // Skip if we already have this week aggregated
    if (stats.weeklyStats[weekStart]) continue;
    
    const weekly: WeeklyStats = {
      weekStart,
      readingTimeMs: 0,
      wordsRead: 0,
      documentsCompleted: 0,
      annotationsCreated: 0,
      avgWpm: 0,
      sessionCount: 0,
      activeDays: days.length,
    };
    
    let totalWpm = 0;
    let wpmCount = 0;
    
    for (const day of days) {
      weekly.readingTimeMs += day.readingTimeMs;
      weekly.wordsRead += day.wordsRead;
      weekly.documentsCompleted += day.documentsCompleted.length;
      weekly.annotationsCreated += day.annotationsCreated;
      
      // Get WPM for this day from wpmHistory
      const wpmEntry = stats.wpmHistory.find(e => e.date === day.date);
      if (wpmEntry) {
        totalWpm += wpmEntry.avgWpm * wpmEntry.sessionCount;
        wpmCount += wpmEntry.sessionCount;
      }
    }
    
    weekly.sessionCount = wpmCount;
    weekly.avgWpm = wpmCount > 0 ? Math.round(totalWpm / wpmCount) : 0;
    
    stats.weeklyStats[weekStart] = weekly;
  }
}

/**
 * Clean up old weekly stats (keep ~2 years)
 */
function cleanupOldWeeklyStats(stats: ReadingStats): void {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (MAX_WEEKLY_HISTORY_WEEKS * 7));
  const cutoffString = cutoffDate.toISOString().split('T')[0];
  
  const newWeeklyStats: Record<string, WeeklyStats> = {};
  for (const [weekStart, weeklyStats] of Object.entries(stats.weeklyStats)) {
    if (weekStart >= cutoffString) {
      newWeeklyStats[weekStart] = weeklyStats;
    }
  }
  stats.weeklyStats = newWeeklyStats;
}

/**
 * Clean up old daily stats entries (keep only last N days)
 * Aggregates old daily stats into weekly stats before removing
 */
function cleanupOldDailyStats(stats: ReadingStats): void {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MAX_DAILY_HISTORY_DAYS);
  const cutoffString = cutoffDate.toISOString().split('T')[0];
  
  const newDailyStats: Record<string, DailyStats> = {};
  const oldDailyStats: DailyStats[] = [];
  
  for (const [date, dailyStats] of Object.entries(stats.dailyStats)) {
    if (date >= cutoffString) {
      newDailyStats[date] = dailyStats;
    } else {
      oldDailyStats.push(dailyStats);
    }
  }
  
  // Aggregate old daily stats to weekly before discarding
  if (oldDailyStats.length > 0) {
    aggregateDailyToWeekly(stats, oldDailyStats);
    cleanupOldWeeklyStats(stats);
  }
  
  stats.dailyStats = newDailyStats;
}

/**
 * Clean up old WPM history entries
 */
function cleanupOldWpmHistory(stats: ReadingStats): void {
  if (stats.wpmHistory.length > MAX_WPM_HISTORY_ENTRIES) {
    // Keep most recent entries
    stats.wpmHistory = stats.wpmHistory.slice(-MAX_WPM_HISTORY_ENTRIES);
  }
}

/**
 * Update hourly activity tracking
 */
function updateHourlyActivity(stats: ReadingStats, durationMs: number): void {
  const hour = new Date().getHours();
  
  // Initialize hourly activity array if needed
  if (!stats.hourlyActivity || stats.hourlyActivity.length === 0) {
    stats.hourlyActivity = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      totalReadingTimeMs: 0,
      sessionCount: 0,
    }));
  }
  
  // Ensure we have an entry for this hour
  let hourEntry = stats.hourlyActivity.find(h => h.hour === hour);
  if (!hourEntry) {
    hourEntry = { hour, totalReadingTimeMs: 0, sessionCount: 0 };
    stats.hourlyActivity.push(hourEntry);
    stats.hourlyActivity.sort((a, b) => a.hour - b.hour);
  }
  
  hourEntry.totalReadingTimeMs += durationMs;
  hourEntry.sessionCount += 1;
}

/**
 * Update personal bests if new records are set
 */
function updatePersonalBests(
  stats: ReadingStats, 
  durationMs: number, 
  _wordsRead: number, 
  wpm: number,
  today: string
): void {
  // Initialize personal bests if needed
  if (!stats.personalBests) {
    stats.personalBests = {
      longestSession: null,
      mostWordsInDay: null,
      fastestWpm: null,
    };
  }
  
  // Check for longest session record
  if (!stats.personalBests.longestSession || durationMs > stats.personalBests.longestSession.durationMs) {
    stats.personalBests.longestSession = { date: today, durationMs };
  }
  
  // Check for most words in a day record
  const todayStats = stats.dailyStats[today];
  if (todayStats) {
    const todayWords = todayStats.wordsRead;
    if (!stats.personalBests.mostWordsInDay || todayWords > stats.personalBests.mostWordsInDay.words) {
      stats.personalBests.mostWordsInDay = { date: today, words: todayWords };
    }
  }
  
  // Check for fastest WPM record (only if session was long enough - at least 1 minute)
  if (wpm > 0 && durationMs >= 60000) {
    if (!stats.personalBests.fastestWpm || wpm > stats.personalBests.fastestWpm.wpm) {
      stats.personalBests.fastestWpm = { date: today, wpm };
    }
  }
}

/**
 * Update WPM history for today
 */
function updateWpmHistory(stats: ReadingStats, today: string, wpm: number): void {
  const existing = stats.wpmHistory.find(entry => entry.date === today);
  
  if (existing) {
    // Calculate new weighted average
    const totalSessions = existing.sessionCount + 1;
    const newAvg = (existing.avgWpm * existing.sessionCount + wpm) / totalSessions;
    existing.avgWpm = Math.round(newAvg);
    existing.sessionCount = totalSessions;
  } else {
    stats.wpmHistory.push({
      date: today,
      avgWpm: wpm,
      sessionCount: 1,
    });
  }
  
  cleanupOldWpmHistory(stats);
}

/**
 * Record a reading session
 * Called when the reader stops playing or when the document is closed
 */
export async function recordReadingSession(params: RecordSessionParams): Promise<void> {
  const { durationMs, wordsRead, documentId, completed, wpm } = params;
  
  // Skip very short sessions (less than 5 seconds)
  if (durationMs < 5000) {
    return;
  }
  
  return statsMutex.withLock(async () => {
    const stats = await getReadingStats();
    const today = getTodayDateString();
    
    // Update daily stats
    const dailyStats = getOrCreateDailyStats(stats, today);
    dailyStats.readingTimeMs += durationMs;
    dailyStats.wordsRead += wordsRead;
    
    // Track documents opened (unique per day)
    if (!dailyStats.documentsOpened.includes(documentId)) {
      dailyStats.documentsOpened.push(documentId);
    }
    
    // Track document completion
    if (completed && !dailyStats.documentsCompleted.includes(documentId)) {
      dailyStats.documentsCompleted.push(documentId);
      stats.totalDocumentsCompleted += 1;
    }
    
    stats.dailyStats[today] = dailyStats;
    
    // Update lifetime totals
    stats.totalReadingTimeMs += durationMs;
    stats.totalWordsRead += wordsRead;
    
    // Update streak
    updateStreak(stats, today);
    
    // Update WPM history
    if (wpm > 0) {
      updateWpmHistory(stats, today, wpm);
    }
    
    // Update hourly activity tracking
    updateHourlyActivity(stats, durationMs);
    
    // Update personal bests
    updatePersonalBests(stats, durationMs, wordsRead, wpm, today);
    
    // Cleanup old entries
    cleanupOldDailyStats(stats);
    
    // Save
    await saveReadingStats(stats);
  });
}

/**
 * Record that an annotation was created
 */
export async function recordAnnotationCreated(): Promise<void> {
  return statsMutex.withLock(async () => {
    const stats = await getReadingStats();
    const today = getTodayDateString();
    
    // Update daily stats
    const dailyStats = getOrCreateDailyStats(stats, today);
    dailyStats.annotationsCreated += 1;
    stats.dailyStats[today] = dailyStats;
    
    // Update lifetime total
    stats.totalAnnotationsCreated += 1;
    
    // Update streak (creating annotations counts as reading activity)
    updateStreak(stats, today);
    
    await saveReadingStats(stats);
  });
}

/**
 * Get daily stats for the last N days
 */
export function getDailyStatsForRange(
  stats: ReadingStats, 
  days: number
): DailyStats[] {
  const result: DailyStats[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    
    result.push(stats.dailyStats[dateString] || {
      date: dateString,
      readingTimeMs: 0,
      wordsRead: 0,
      documentsOpened: [],
      documentsCompleted: [],
      annotationsCreated: 0,
    });
  }
  
  return result;
}

/**
 * Get WPM history for the last N days
 */
export function getWpmHistoryForRange(
  stats: ReadingStats,
  days: number
): WpmHistoryEntry[] {
  const result: WpmHistoryEntry[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    
    const existing = stats.wpmHistory.find(e => e.date === dateString);
    if (existing) {
      result.push(existing);
    }
    // Only include days where we have data
  }
  
  return result;
}

/**
 * Format milliseconds as "Xh Ym" or "Xm"
 */
export function formatReadingTime(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours === 0) {
    return `${minutes}m`;
  }
  
  if (minutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${minutes}m`;
}

/**
 * Format large numbers with K/M suffix
 */
export function formatLargeNumber(n: number): string {
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}K`;
  }
  return String(n);
}

/**
 * Calculate average WPM from recent history
 */
export function calculateAverageWpm(wpmHistory: WpmHistoryEntry[]): number {
  if (wpmHistory.length === 0) return 0;
  
  let totalWpm = 0;
  let totalSessions = 0;
  
  for (const entry of wpmHistory) {
    totalWpm += entry.avgWpm * entry.sessionCount;
    totalSessions += entry.sessionCount;
  }
  
  return totalSessions > 0 ? Math.round(totalWpm / totalSessions) : 0;
}

/**
 * Get date range bounds from a TimeRange preset
 */
export function getDateRangeFromPreset(range: TimeRange): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  
  if (range.preset === 'custom' && range.startDate && range.endDate) {
    return {
      start: new Date(range.startDate),
      end: new Date(range.endDate),
    };
  }
  
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  
  switch (range.preset) {
    case '7d':
      start.setDate(start.getDate() - 6);
      break;
    case '30d':
      start.setDate(start.getDate() - 29);
      break;
    case '90d':
      start.setDate(start.getDate() - 89);
      break;
    case '1y':
      start.setDate(start.getDate() - 364);
      break;
    case 'all':
      start.setFullYear(2020, 0, 1); // Far back enough
      break;
  }
  
  return { start, end };
}

/**
 * Get stats for a specific date range
 */
export function getStatsForDateRange(
  stats: ReadingStats,
  startDate: Date,
  endDate: Date
): PeriodStats {
  const result: PeriodStats = {
    readingTimeMs: 0,
    wordsRead: 0,
    documentsCompleted: 0,
    annotationsCreated: 0,
    avgWpm: 0,
    sessionCount: 0,
    activeDays: 0,
  };
  
  const startString = startDate.toISOString().split('T')[0];
  const endString = endDate.toISOString().split('T')[0];
  
  let totalWpm = 0;
  let wpmCount = 0;
  
  // Check daily stats
  for (const [date, daily] of Object.entries(stats.dailyStats)) {
    if (date >= startString && date <= endString) {
      result.readingTimeMs += daily.readingTimeMs;
      result.wordsRead += daily.wordsRead;
      result.documentsCompleted += daily.documentsCompleted.length;
      result.annotationsCreated += daily.annotationsCreated;
      if (daily.readingTimeMs > 0) {
        result.activeDays += 1;
      }
      
      // Get WPM for this day
      const wpmEntry = stats.wpmHistory.find(e => e.date === date);
      if (wpmEntry) {
        totalWpm += wpmEntry.avgWpm * wpmEntry.sessionCount;
        wpmCount += wpmEntry.sessionCount;
      }
    }
  }
  
  // Check weekly stats for older data
  for (const [weekStart, weekly] of Object.entries(stats.weeklyStats)) {
    if (weekStart >= startString && weekStart <= endString) {
      result.readingTimeMs += weekly.readingTimeMs;
      result.wordsRead += weekly.wordsRead;
      result.documentsCompleted += weekly.documentsCompleted;
      result.annotationsCreated += weekly.annotationsCreated;
      result.activeDays += weekly.activeDays;
      
      if (weekly.avgWpm > 0 && weekly.sessionCount > 0) {
        totalWpm += weekly.avgWpm * weekly.sessionCount;
        wpmCount += weekly.sessionCount;
      }
    }
  }
  
  result.sessionCount = wpmCount;
  result.avgWpm = wpmCount > 0 ? Math.round(totalWpm / wpmCount) : 0;
  
  return result;
}

/**
 * Get the start of a period (week, month, year) for comparison
 */
function getPeriodStart(type: 'week' | 'month' | 'year', offset: number = 0): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  switch (type) {
    case 'week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      now.setDate(diff);
      now.setDate(now.getDate() - (offset * 7));
      return now;
    }
    case 'month': {
      now.setMonth(now.getMonth() - offset);
      now.setDate(1);
      return now;
    }
    case 'year': {
      now.setFullYear(now.getFullYear() - offset);
      now.setMonth(0, 1);
      return now;
    }
  }
}

/**
 * Get the end of a period (week, month, year) for comparison
 */
function getPeriodEnd(type: 'week' | 'month' | 'year', offset: number = 0): Date {
  const start = getPeriodStart(type, offset);
  const end = new Date(start);
  
  switch (type) {
    case 'week':
      end.setDate(end.getDate() + 6);
      break;
    case 'month':
      end.setMonth(end.getMonth() + 1);
      end.setDate(end.getDate() - 1);
      break;
    case 'year':
      end.setFullYear(end.getFullYear() + 1);
      end.setDate(end.getDate() - 1);
      break;
  }
  
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Compare two periods and calculate deltas
 */
export function comparePeriods(
  stats: ReadingStats,
  type: 'week' | 'month' | 'year' | 'custom',
  period1Start?: Date,
  period1End?: Date,
  period2Start?: Date,
  period2End?: Date
): PeriodComparison {
  let p1Start: Date, p1End: Date, p2Start: Date, p2End: Date;
  
  if (type === 'custom' && period1Start && period1End && period2Start && period2End) {
    p1Start = period1Start;
    p1End = period1End;
    p2Start = period2Start;
    p2End = period2End;
  } else {
    // Current period vs previous period
    p1Start = getPeriodStart(type as 'week' | 'month' | 'year', 0);
    p1End = getPeriodEnd(type as 'week' | 'month' | 'year', 0);
    p2Start = getPeriodStart(type as 'week' | 'month' | 'year', 1);
    p2End = getPeriodEnd(type as 'week' | 'month' | 'year', 1);
  }
  
  const period1 = getStatsForDateRange(stats, p1Start, p1End);
  const period2 = getStatsForDateRange(stats, p2Start, p2End);
  
  // Calculate percentage deltas (avoid division by zero)
  const calcDelta = (curr: number, prev: number): number => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };
  
  return {
    period1,
    period2,
    deltas: {
      readingTimePercent: calcDelta(period1.readingTimeMs, period2.readingTimeMs),
      wordsReadPercent: calcDelta(period1.wordsRead, period2.wordsRead),
      documentsCompletedPercent: calcDelta(period1.documentsCompleted, period2.documentsCompleted),
      avgWpmPercent: calcDelta(period1.avgWpm, period2.avgWpm),
      activeDaysPercent: calcDelta(period1.activeDays, period2.activeDays),
    },
  };
}

/**
 * Get activity data for heatmap visualization
 * Returns daily activity for the given number of days, using weekly stats for older data
 */
export function getActivityForHeatmap(
  stats: ReadingStats,
  days: number,
  metric: 'time' | 'words' | 'documents' | 'combined' = 'time'
): Array<{ date: string; value: number; level: 0 | 1 | 2 | 3 | 4 }> {
  const result: Array<{ date: string; value: number; level: 0 | 1 | 2 | 3 | 4 }> = [];
  const today = new Date();
  const values: number[] = [];
  
  // Collect raw values first
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    
    let value = 0;
    const daily = stats.dailyStats[dateString];
    
    if (daily) {
      switch (metric) {
        case 'time':
          value = daily.readingTimeMs / 60000; // Convert to minutes
          break;
        case 'words':
          value = daily.wordsRead;
          break;
        case 'documents':
          value = daily.documentsOpened.length;
          break;
        case 'combined': {
          // Normalize and combine: time (0-60 min) + words (0-5000) + docs (0-5)
          const timeScore = Math.min(daily.readingTimeMs / 60000 / 60, 1);
          const wordScore = Math.min(daily.wordsRead / 5000, 1);
          const docScore = Math.min(daily.documentsOpened.length / 5, 1);
          value = (timeScore + wordScore + docScore) / 3 * 100;
          break;
        }
      }
    } else {
      // Check if we have weekly data for this date
      const weekStart = getWeekStart(date);
      const weekly = stats.weeklyStats[weekStart];
      if (weekly) {
        // Distribute weekly value across days (approximate)
        switch (metric) {
          case 'time':
            value = (weekly.readingTimeMs / 60000) / 7;
            break;
          case 'words':
            value = weekly.wordsRead / 7;
            break;
          case 'documents':
            value = weekly.documentsCompleted / 7;
            break;
          case 'combined': {
            const timeScore = Math.min((weekly.readingTimeMs / 60000 / 7) / 60, 1);
            const wordScore = Math.min((weekly.wordsRead / 7) / 5000, 1);
            const docScore = Math.min((weekly.documentsCompleted / 7) / 5, 1);
            value = (timeScore + wordScore + docScore) / 3 * 100;
            break;
          }
        }
      }
    }
    
    values.push(value);
    result.push({ date: dateString, value, level: 0 });
  }
  
  // Calculate quartiles for level assignment
  const nonZeroValues = values.filter(v => v > 0).sort((a, b) => a - b);
  if (nonZeroValues.length > 0) {
    const q1 = nonZeroValues[Math.floor(nonZeroValues.length * 0.25)] || 0;
    const q2 = nonZeroValues[Math.floor(nonZeroValues.length * 0.5)] || 0;
    const q3 = nonZeroValues[Math.floor(nonZeroValues.length * 0.75)] || 0;
    
    // Assign levels based on quartiles
    for (let i = 0; i < result.length; i++) {
      const v = result[i].value;
      if (v === 0) {
        result[i].level = 0;
      } else if (v <= q1) {
        result[i].level = 1;
      } else if (v <= q2) {
        result[i].level = 2;
      } else if (v <= q3) {
        result[i].level = 3;
      } else {
        result[i].level = 4;
      }
    }
  }
  
  return result;
}

/**
 * Calculate daily average reading time for a period
 */
export function calculateDailyAverage(stats: ReadingStats, days: number): number {
  const dailyStats = getDailyStatsForRange(stats, days);
  const totalMs = dailyStats.reduce((sum, d) => sum + d.readingTimeMs, 0);
  const activeDays = dailyStats.filter(d => d.readingTimeMs > 0).length;
  return activeDays > 0 ? Math.round(totalMs / activeDays / 60000) : 0; // Return minutes
}

/**
 * Calculate finish rate (completed / started documents)
 */
export function calculateFinishRate(stats: ReadingStats): { rate: number; completed: number; started: number } {
  const dailyStats = Object.values(stats.dailyStats);
  
  // Count unique documents
  const opened = new Set<string>();
  const completed = new Set<string>();
  
  for (const daily of dailyStats) {
    daily.documentsOpened.forEach(id => opened.add(id));
    daily.documentsCompleted.forEach(id => completed.add(id));
  }
  
  // Also check weekly stats for additional completed documents
  // Note: Weekly stats only have aggregate counts, not individual document IDs,
  // so we can only use daily stats for unique document tracking
  
  const startedCount = opened.size;
  const completedCount = completed.size;
  const rate = startedCount > 0 ? Math.round((completedCount / startedCount) * 100) : 0;
  
  return { rate, completed: completedCount, started: startedCount };
}

/**
 * Get hourly activity data for "best time to read" visualization
 */
export function getHourlyActivityData(stats: ReadingStats): HourlyActivity[] {
  // Ensure we have all 24 hours
  const hourlyMap = new Map<number, HourlyActivity>();
  
  for (let i = 0; i < 24; i++) {
    hourlyMap.set(i, { hour: i, totalReadingTimeMs: 0, sessionCount: 0 });
  }
  
  // Merge with stored data
  if (stats.hourlyActivity) {
    for (const entry of stats.hourlyActivity) {
      hourlyMap.set(entry.hour, entry);
    }
  }
  
  return Array.from(hourlyMap.values()).sort((a, b) => a.hour - b.hour);
}

/**
 * Save reading goals
 */
export async function saveReadingGoals(goals: ReadingGoals): Promise<void> {
  return statsMutex.withLock(async () => {
    const stats = await getReadingStats();
    stats.goals = goals;
    await saveReadingStats(stats);
  });
}

/**
 * Check goal progress for current period
 */
export function checkGoalProgress(
  stats: ReadingStats
): { 
  daily: { target: number; current: number; percent: number } | null;
  weekly: { target: number; current: number; percent: number } | null;
  monthly: { target: number; current: number; percent: number } | null;
} {
  const result = { daily: null, weekly: null, monthly: null } as {
    daily: { target: number; current: number; percent: number } | null;
    weekly: { target: number; current: number; percent: number } | null;
    monthly: { target: number; current: number; percent: number } | null;
  };
  
  if (!stats.goals) return result;
  
  const today = getTodayDateString();
  const todayStats = stats.dailyStats[today];
  
  if (stats.goals.dailyMinutes) {
    const current = todayStats ? Math.round(todayStats.readingTimeMs / 60000) : 0;
    result.daily = {
      target: stats.goals.dailyMinutes,
      current,
      percent: Math.min(100, Math.round((current / stats.goals.dailyMinutes) * 100)),
    };
  }
  
  if (stats.goals.weeklyMinutes) {
    const weekStats = getStatsForDateRange(
      stats,
      getPeriodStart('week', 0),
      getPeriodEnd('week', 0)
    );
    const current = Math.round(weekStats.readingTimeMs / 60000);
    result.weekly = {
      target: stats.goals.weeklyMinutes,
      current,
      percent: Math.min(100, Math.round((current / stats.goals.weeklyMinutes) * 100)),
    };
  }
  
  if (stats.goals.monthlyDocuments) {
    const monthStats = getStatsForDateRange(
      stats,
      getPeriodStart('month', 0),
      getPeriodEnd('month', 0)
    );
    const current = monthStats.documentsCompleted;
    result.monthly = {
      target: stats.goals.monthlyDocuments,
      current,
      percent: Math.min(100, Math.round((current / stats.goals.monthlyDocuments) * 100)),
    };
  }
  
  return result;
}

/**
 * Get the week start date helper (exported for use in components)
 */
export { getWeekStart };

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/** Exported stats data structure */
export interface ExportedStats {
  exportedAt: string;
  version: string;
  lifetime: {
    totalReadingTimeMs: number;
    totalReadingTimeFormatted: string;
    totalWordsRead: number;
    totalDocumentsCompleted: number;
    totalAnnotationsCreated: number;
    currentStreak: number;
    longestStreak: number;
    lastReadingDate: string | null;
  };
  dailyStats: Array<{
    date: string;
    readingTimeMs: number;
    readingTimeFormatted: string;
    wordsRead: number;
    documentsOpened: number;
    documentsCompleted: number;
    annotationsCreated: number;
  }>;
  weeklyStats: Array<{
    weekStart: string;
    readingTimeMs: number;
    readingTimeFormatted: string;
    wordsRead: number;
    documentsCompleted: number;
    annotationsCreated: number;
    avgWpm: number;
    sessionCount: number;
    activeDays: number;
  }>;
  wpmHistory: WpmHistoryEntry[];
  hourlyActivity: HourlyActivity[];
  personalBests: {
    longestSession: { date: string; durationMs: number; durationFormatted: string } | null;
    mostWordsInDay: { date: string; words: number } | null;
    fastestWpm: { date: string; wpm: number } | null;
  };
  goals: ReadingGoals | null;
}

/**
 * Transform stats into exportable format
 */
function transformStatsForExport(stats: ReadingStats): ExportedStats {
  return {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    lifetime: {
      totalReadingTimeMs: stats.totalReadingTimeMs,
      totalReadingTimeFormatted: formatReadingTime(stats.totalReadingTimeMs),
      totalWordsRead: stats.totalWordsRead,
      totalDocumentsCompleted: stats.totalDocumentsCompleted,
      totalAnnotationsCreated: stats.totalAnnotationsCreated,
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      lastReadingDate: stats.lastReadingDate,
    },
    dailyStats: Object.values(stats.dailyStats)
      .map(d => ({
        date: d.date,
        readingTimeMs: d.readingTimeMs,
        readingTimeFormatted: formatReadingTime(d.readingTimeMs),
        wordsRead: d.wordsRead,
        documentsOpened: d.documentsOpened.length,
        documentsCompleted: d.documentsCompleted.length,
        annotationsCreated: d.annotationsCreated,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    weeklyStats: Object.values(stats.weeklyStats)
      .map(w => ({
        weekStart: w.weekStart,
        readingTimeMs: w.readingTimeMs,
        readingTimeFormatted: formatReadingTime(w.readingTimeMs),
        wordsRead: w.wordsRead,
        documentsCompleted: w.documentsCompleted,
        annotationsCreated: w.annotationsCreated,
        avgWpm: w.avgWpm,
        sessionCount: w.sessionCount,
        activeDays: w.activeDays,
      }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    wpmHistory: [...stats.wpmHistory].sort((a, b) => a.date.localeCompare(b.date)),
    hourlyActivity: getHourlyActivityData(stats),
    personalBests: {
      longestSession: stats.personalBests?.longestSession 
        ? {
            ...stats.personalBests.longestSession,
            durationFormatted: formatReadingTime(stats.personalBests.longestSession.durationMs),
          }
        : null,
      mostWordsInDay: stats.personalBests?.mostWordsInDay ?? null,
      fastestWpm: stats.personalBests?.fastestWpm ?? null,
    },
    goals: stats.goals ?? null,
  };
}

/**
 * Export stats as JSON string
 */
export async function exportStatsAsJSON(): Promise<string> {
  const stats = await getReadingStats();
  const exported = transformStatsForExport(stats);
  return JSON.stringify(exported, null, 2);
}

/**
 * Export stats as CSV string
 * Creates a multi-section CSV with daily stats, weekly stats, and summary
 */
export async function exportStatsAsCSV(): Promise<string> {
  const stats = await getReadingStats();
  const exported = transformStatsForExport(stats);
  const lines: string[] = [];

  // Summary section
  lines.push('# READING STATISTICS EXPORT');
  lines.push(`# Exported: ${exported.exportedAt}`);
  lines.push('');
  
  // Lifetime summary
  lines.push('## LIFETIME SUMMARY');
  lines.push('Metric,Value');
  lines.push(`Total Reading Time,${exported.lifetime.totalReadingTimeFormatted}`);
  lines.push(`Total Reading Time (ms),${exported.lifetime.totalReadingTimeMs}`);
  lines.push(`Total Words Read,${exported.lifetime.totalWordsRead}`);
  lines.push(`Documents Completed,${exported.lifetime.totalDocumentsCompleted}`);
  lines.push(`Annotations Created,${exported.lifetime.totalAnnotationsCreated}`);
  lines.push(`Current Streak,${exported.lifetime.currentStreak}`);
  lines.push(`Longest Streak,${exported.lifetime.longestStreak}`);
  lines.push(`Last Reading Date,${exported.lifetime.lastReadingDate ?? 'N/A'}`);
  lines.push('');

  // Personal bests
  lines.push('## PERSONAL BESTS');
  lines.push('Record,Date,Value');
  if (exported.personalBests.longestSession) {
    lines.push(`Longest Session,${exported.personalBests.longestSession.date},${exported.personalBests.longestSession.durationFormatted}`);
  }
  if (exported.personalBests.mostWordsInDay) {
    lines.push(`Most Words in Day,${exported.personalBests.mostWordsInDay.date},${exported.personalBests.mostWordsInDay.words}`);
  }
  if (exported.personalBests.fastestWpm) {
    lines.push(`Fastest WPM,${exported.personalBests.fastestWpm.date},${exported.personalBests.fastestWpm.wpm}`);
  }
  lines.push('');

  // Daily stats
  lines.push('## DAILY STATISTICS');
  lines.push('Date,Reading Time,Reading Time (ms),Words Read,Docs Opened,Docs Completed,Annotations');
  for (const day of exported.dailyStats) {
    lines.push([
      day.date,
      day.readingTimeFormatted,
      day.readingTimeMs,
      day.wordsRead,
      day.documentsOpened,
      day.documentsCompleted,
      day.annotationsCreated,
    ].join(','));
  }
  lines.push('');

  // Weekly stats
  lines.push('## WEEKLY STATISTICS');
  lines.push('Week Start,Reading Time,Reading Time (ms),Words Read,Docs Completed,Annotations,Avg WPM,Sessions,Active Days');
  for (const week of exported.weeklyStats) {
    lines.push([
      week.weekStart,
      week.readingTimeFormatted,
      week.readingTimeMs,
      week.wordsRead,
      week.documentsCompleted,
      week.annotationsCreated,
      week.avgWpm,
      week.sessionCount,
      week.activeDays,
    ].join(','));
  }
  lines.push('');

  // WPM history
  lines.push('## WPM HISTORY');
  lines.push('Date,Average WPM,Session Count');
  for (const wpm of exported.wpmHistory) {
    lines.push([wpm.date, wpm.avgWpm, wpm.sessionCount].join(','));
  }
  lines.push('');

  // Hourly activity
  lines.push('## HOURLY ACTIVITY');
  lines.push('Hour,Total Reading Time (ms),Session Count');
  for (const hour of exported.hourlyActivity) {
    lines.push([hour.hour, hour.totalReadingTimeMs, hour.sessionCount].join(','));
  }

  return lines.join('\n');
}

/**
 * Download stats as a file (JSON or CSV)
 */
export async function downloadStats(format: 'json' | 'csv'): Promise<void> {
  const content = format === 'json' 
    ? await exportStatsAsJSON() 
    : await exportStatsAsCSV();
  
  const mimeType = format === 'json' ? 'application/json' : 'text/csv';
  const extension = format;
  const filename = `flowreader-stats-${new Date().toISOString().split('T')[0]}.${extension}`;
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
