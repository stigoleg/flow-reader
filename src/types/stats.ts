/**
 * Statistics Types
 * 
 * Types for tracking reading statistics, streaks, and activity history.
 */

/** Daily reading statistics for a single day */
export interface DailyStats {
  /** ISO date string "2024-01-15" */
  date: string;
  /** Total reading time in milliseconds */
  readingTimeMs: number;
  /** Estimated words read that day */
  wordsRead: number;
  /** Document IDs opened that day */
  documentsOpened: string[];
  /** Document IDs completed (reached 100%) that day */
  documentsCompleted: string[];
  /** Number of annotations created that day */
  annotationsCreated: number;
}

/** WPM history entry for tracking reading speed over time */
export interface WpmHistoryEntry {
  /** ISO date string */
  date: string;
  /** Average WPM for that day */
  avgWpm: number;
  /** Number of sessions used to calculate average */
  sessionCount: number;
}

/** Weekly aggregated stats for long-term storage (data older than 90 days) */
export interface WeeklyStats {
  /** ISO date string of the Monday of this week */
  weekStart: string;
  /** Total reading time in milliseconds */
  readingTimeMs: number;
  /** Total words read */
  wordsRead: number;
  /** Documents completed */
  documentsCompleted: number;
  /** Annotations created */
  annotationsCreated: number;
  /** Average WPM for the week */
  avgWpm: number;
  /** Number of reading sessions */
  sessionCount: number;
  /** Number of days with activity (1-7) */
  activeDays: number;
}

/** Hour-of-day activity for "best time to read" analysis */
export interface HourlyActivity {
  /** Hour of day (0-23) */
  hour: number;
  /** Total reading time in milliseconds across all sessions at this hour */
  totalReadingTimeMs: number;
  /** Number of sessions that started at this hour */
  sessionCount: number;
}

/** Personal best records */
export interface PersonalBests {
  /** Longest single reading session */
  longestSession: { date: string; durationMs: number } | null;
  /** Most words read in a single day */
  mostWordsInDay: { date: string; words: number } | null;
  /** Fastest reading speed recorded */
  fastestWpm: { date: string; wpm: number } | null;
}

/** Reading goals set by the user */
export interface ReadingGoals {
  /** Daily reading target in minutes */
  dailyMinutes?: number;
  /** Weekly reading target in minutes */
  weeklyMinutes?: number;
  /** Monthly document completion target */
  monthlyDocuments?: number;
}

/** Time range for filtering statistics */
export type TimeRangePreset = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom';

/** Custom time range with specific dates */
export interface TimeRange {
  preset: TimeRangePreset;
  /** Custom start date (ISO string), only used when preset is 'custom' */
  startDate?: string;
  /** Custom end date (ISO string), only used when preset is 'custom' */
  endDate?: string;
}

/** Period comparison configuration */
export interface ComparisonPeriod {
  type: 'week' | 'month' | 'year' | 'custom';
  /** For custom, the start date of the first period */
  period1Start?: string;
  /** For custom, the end date of the first period */
  period1End?: string;
  /** For custom, the start date of the second period */
  period2Start?: string;
  /** For custom, the end date of the second period */
  period2End?: string;
}

/** Stats for a single period (used in comparisons) */
export interface PeriodStats {
  readingTimeMs: number;
  wordsRead: number;
  documentsCompleted: number;
  annotationsCreated: number;
  avgWpm: number;
  sessionCount: number;
  activeDays: number;
}

/** Comparison result with deltas */
export interface PeriodComparison {
  period1: PeriodStats;
  period2: PeriodStats;
  deltas: {
    readingTimePercent: number;
    wordsReadPercent: number;
    documentsCompletedPercent: number;
    avgWpmPercent: number;
    activeDaysPercent: number;
  };
}

/** Aggregate reading statistics stored in chrome.storage */
export interface ReadingStats {
  // Lifetime totals
  /** Total reading time in milliseconds (all time) */
  totalReadingTimeMs: number;
  /** Estimated total words read (all time) */
  totalWordsRead: number;
  /** Total number of documents completed (all time) */
  totalDocumentsCompleted: number;
  /** Total annotations created (all time) */
  totalAnnotationsCreated: number;
  
  // Streak tracking
  /** Current consecutive days with reading activity */
  currentStreak: number;
  /** Longest streak ever achieved */
  longestStreak: number;
  /** ISO date string of last reading session (null if never read) */
  lastReadingDate: string | null;
  
  // Daily history (rolling 90 days to limit storage size)
  /** Map of ISO date string to daily stats */
  dailyStats: Record<string, DailyStats>;
  
  // Weekly history (for data older than 90 days, up to 2 years)
  /** Map of ISO week start date to weekly stats */
  weeklyStats: Record<string, WeeklyStats>;
  
  // Reading speed history (track WPM over time)
  /** Array of daily WPM averages */
  wpmHistory: WpmHistoryEntry[];
  
  // Hourly activity patterns (all-time aggregate)
  /** Activity by hour of day for pattern analysis */
  hourlyActivity: HourlyActivity[];
  
  // Personal bests
  /** Record-breaking achievements */
  personalBests: PersonalBests;
  
  // Optional user-defined goals
  /** Reading goals set by the user */
  goals?: ReadingGoals;
}

/** Default empty reading stats */
export const DEFAULT_READING_STATS: ReadingStats = {
  totalReadingTimeMs: 0,
  totalWordsRead: 0,
  totalDocumentsCompleted: 0,
  totalAnnotationsCreated: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastReadingDate: null,
  dailyStats: {},
  weeklyStats: {},
  wpmHistory: [],
  hourlyActivity: [],
  personalBests: {
    longestSession: null,
    mostWordsInDay: null,
    fastestWpm: null,
  },
};

/** Parameters for recording a reading session */
export interface RecordSessionParams {
  /** Duration of the reading session in milliseconds */
  durationMs: number;
  /** Estimated words read during this session */
  wordsRead: number;
  /** ID of the document being read */
  documentId: string;
  /** Whether the document was completed (reached 100%) */
  completed: boolean;
  /** Average WPM used during this session */
  wpm: number;
}

/** Computed statistics for display in the dashboard */
export interface ComputedStats {
  // Formatted totals
  totalReadingTimeFormatted: string;  // "45h 23m"
  totalWordsReadFormatted: string;    // "125.4K"
  totalDocumentsCompleted: number;
  totalAnnotations: number;
  
  // Streaks
  currentStreak: number;
  longestStreak: number;
  
  // Reading speed
  averageWpm: number;
  currentWpm: number;
  
  // Content breakdown
  itemsByType: Record<string, number>;  // { web: 10, pdf: 5, epub: 3 }
  totalItems: number;
  
  // Progress breakdown
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  
  // Annotation breakdown
  highlightCount: number;
  notesCount: number;
  annotationsByColor: Record<string, number>;
  
  // Activity data for charts (last 30 days)
  dailyActivity: Array<{
    date: string;
    readingTimeMinutes: number;
    wordsRead: number;
  }>;
  
  // Weekly aggregates (last 12 weeks)
  weeklyActivity: Array<{
    week: string;  // "Jan 1-7"
    readingTimeMinutes: number;
  }>;
  
  // WPM trend (last 30 days)
  wpmTrend: Array<{
    date: string;
    wpm: number;
  }>;
}
