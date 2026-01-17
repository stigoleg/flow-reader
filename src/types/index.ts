// Document model types
export interface FlowDocument {
  metadata: DocumentMetadata;
  blocks: Block[];
  plainText: string;
  /** Book structure for multi-chapter documents (epub, mobi) */
  book?: BookStructure;
}

export interface DocumentMetadata {
  title: string;
  author?: string;
  publishedAt?: string;
  source: 'web' | 'paste' | 'pdf' | 'docx' | 'selection' | 'epub' | 'mobi';
  url?: string;
  createdAt: number;
  /** Language code (e.g., 'en', 'no') */
  language?: string;
  /** Publisher name */
  publisher?: string;
  /** Original filename for imported files */
  fileName?: string;
  /** File size in bytes */
  fileSize?: number;
  /** SHA-256 hash of file for stable position keying */
  fileHash?: string;
}

// =============================================================================
// BOOK STRUCTURE (for EPUB and MOBI)
// =============================================================================

/** Book structure for multi-chapter documents */
export interface BookStructure {
  /** Table of contents */
  toc: TocItem[];
  /** All chapters in reading order */
  chapters: Chapter[];
}

/** Table of contents entry */
export interface TocItem {
  /** Unique ID for this TOC entry */
  id: string;
  /** Display label */
  label: string;
  /** Index into chapters array */
  chapterIndex: number;
  /** Nesting depth (0 = top level) */
  depth: number;
  /** Child items for hierarchical TOC */
  children?: TocItem[];
}

/** A single chapter in a book */
export interface Chapter {
  /** Unique ID for this chapter */
  id: string;
  /** Chapter title (from TOC or first heading) */
  title: string;
  /** Content blocks */
  blocks: Block[];
  /** Plain text content for search/stats */
  plainText: string;
  /** Word count for progress calculation */
  wordCount: number;
}

export type Block =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | QuoteBlock
  | CodeBlock;

export interface HeadingBlock {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  content: string;
  id: string;
}

export interface ParagraphBlock {
  type: 'paragraph';
  content: string;
  id: string;
}

export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: string[];
  id: string;
}

export interface QuoteBlock {
  type: 'quote';
  content: string;
  id: string;
}

export interface CodeBlock {
  type: 'code';
  content: string;
  language?: string;
  id: string;
}

// Reading position
export interface ReadingPosition {
  blockIndex: number;
  charOffset: number;
  timestamp: number;
  // Extended fields for complete position restoration on refresh
  wordIndex?: number;
  sentenceIndex?: number;
  rsvpIndex?: number;
  activeMode?: ReadingMode;
  accumulatedReadingTime?: number;  // Total ms spent reading
  /** Chapter index for book documents */
  chapterIndex?: number;
}

// Settings types
export interface ReaderSettings {
  // Typography
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  columnWidth: number;
  margins: number;

  // Colors
  backgroundColor: string;
  textColor: string;
  linkColor: string;
  selectionColor: string;
  highlightColor: string;

  // Text options
  textAlign: 'left' | 'justify';
  hyphenation: boolean;

  // Speed settings
  baseWPM: number;
  targetWPM: number;
  rampEnabled: boolean;
  rampStep: number;
  rampInterval: number;

  // Mode settings
  activeMode: ReadingMode;

  // RSVP settings
  rsvpChunkSize: number;
  rsvpPauseOnPunctuation: boolean;

  // Pacing settings
  pacingGranularity: PacingGranularity;
  pacingHighlightStyle: PacingHighlightStyle;
  pacingDimContext: boolean;
  pacingShowGuide: boolean;
  pacingPauseOnPunctuation: boolean;
  pacingBoldFocusLetter: boolean;  // Bold the focus letter like bionic mode
  pacingAdaptiveSpeed: boolean;    // Adjust speed based on word complexity
  pacingReadabilitySpeed: boolean; // Adjust speed based on paragraph readability

  // Display settings
  showTimeRemaining: boolean;      // Show estimated time remaining to finish

  // Bionic settings
  bionicIntensity: number;    // 0-1, controls font weight (0.5=600, 1=800)
  bionicProportion: number;   // 0-1, how much of each word to bold
}

export type PacingGranularity = 'block' | 'sentence' | 'word';
export type PacingHighlightStyle = 'background' | 'underline' | 'box';

export interface PacingSettings {
  pacingHighlightStyle: PacingHighlightStyle;
  pacingDimContext: boolean;
  pacingShowGuide: boolean;
  pacingBoldFocusLetter: boolean;
}

export type ReadingMode = 'pacing' | 'rsvp' | 'bionic';

export type ThemePreset = 
  | 'light' 
  | 'sepia' 
  | 'night' 
  | 'eink' 
  | 'highContrast' 
  | 'warmLight'
  | 'softFocus'
  | 'ocean'
  | 'amoled'
  | 'amberNight'
  | 'forest'
  | 'custom';

export interface ThemeColors {
  backgroundColor: string;
  textColor: string;
  linkColor: string;
  selectionColor: string;
  highlightColor: string;
}

/** Custom theme with name and colors */
export interface CustomTheme extends ThemeColors {
  name: string;
}

/** Theme export format for import/export */
export interface ThemeExport {
  version: 1;
  theme: CustomTheme;
}

// Storage schema
export interface StorageSchema {
  version: number;
  settings: ReaderSettings;
  presets: Record<string, Partial<ReaderSettings>>;
  positions: Record<string, ReadingPosition>;
  /** Archive items (reading history) - v2+ */
  archiveItems: ArchiveItem[];
  /** @deprecated Use archiveItems instead. Kept for migration. */
  recentDocuments: RecentDocument[];
  customThemes: CustomTheme[];
  onboardingCompleted: boolean;
  exitConfirmationDismissed: boolean;
}

export interface RecentDocument {
  id: string;
  title: string;
  source: string;
  timestamp: number;
  preview: string;
  url?: string;
  /** Cached document for non-web sources that can be reopened */
  cachedDocument?: FlowDocument;
}

// =============================================================================
// ARCHIVE ITEMS (Enhanced recent documents for Archive page)
// =============================================================================

/** Content type for archive items */
export type ArchiveItemType = 'web' | 'pdf' | 'docx' | 'epub' | 'mobi' | 'paste';

/** Progress information for an archive item */
export interface ArchiveProgress {
  /** Progress percentage (0-100) */
  percent: number;
  /** Human-readable label (e.g., "Chapter 3 of 12" or "45%") */
  label: string;
}

/** An item in the Archive (reading history) */
export interface ArchiveItem {
  /** Stable identifier (UUID or hash-based) */
  id: string;
  /** Content type */
  type: ArchiveItemType;
  /** Document title */
  title: string;
  /** Author name (optional) */
  author?: string;
  /** Source label (domain for web, filename for files) */
  sourceLabel: string;
  /** URL for web and URL-based imports */
  url?: string;
  /** When the item was first added */
  createdAt: number;
  /** When the item was last opened */
  lastOpenedAt: number;
  /** Reading progress (optional) */
  progress?: ArchiveProgress;
  /** Last saved reading position */
  lastPosition?: ReadingPosition;
  /** Thumbnail URL (optional, for future use) */
  thumbnail?: string;
  /** Paste content (for paste documents, size-limited) */
  pasteContent?: string;
  /** Cached document for reopening */
  cachedDocument?: FlowDocument;
  /** File hash for stable identification */
  fileHash?: string;
}

// Message types for communication between scripts
export type MessageType =
  | { type: 'EXTRACT_CONTENT' }
  | { type: 'CONTENT_EXTRACTED'; payload: FlowDocument }
  | { type: 'EXTRACTION_FAILED'; error: string }
  | { type: 'OPEN_READER'; document: FlowDocument }
  | { type: 'GET_PENDING_DOCUMENT' }
  | { type: 'CONTENT_SCRIPT_READY' }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; settings: Partial<ReaderSettings> }
  | { type: 'GET_POSITION'; url: string }
  | { type: 'SAVE_POSITION'; url: string; position: ReadingPosition }
  | { type: 'EXTRACT_FROM_URL'; url: string }
  | { type: 'EXTRACT_FROM_URL_AND_OPEN'; url: string }
  | { type: 'OPEN_ARCHIVE' }
  | { type: 'FOCUS_SEARCH' };

// Default settings
export const DEFAULT_SETTINGS: ReaderSettings = {
  fontFamily: 'Georgia, serif',
  fontSize: 20,
  lineHeight: 1.8,
  paragraphSpacing: 24,
  columnWidth: 680,
  margins: 40,

  backgroundColor: '#ffffff',
  textColor: '#1a1a1a',
  linkColor: '#b58900',  // Golden amber - matches warm yellow highlight
  selectionColor: '#b4d5fe',
  highlightColor: '#fff3cd',

  textAlign: 'left',
  hyphenation: false,

  baseWPM: 200,
  targetWPM: 300,
  rampEnabled: false,
  rampStep: 10,
  rampInterval: 60,

  activeMode: 'pacing',

  rsvpChunkSize: 1,
  rsvpPauseOnPunctuation: true,

  // Pacing defaults
  pacingGranularity: 'word',
  pacingHighlightStyle: 'background',
  pacingDimContext: false,
  pacingShowGuide: true,
  pacingPauseOnPunctuation: true,
  pacingBoldFocusLetter: false,
  pacingAdaptiveSpeed: true,
  pacingReadabilitySpeed: true,

  // Display settings
  showTimeRemaining: false,

  // Bionic defaults
  bionicIntensity: 0.7,
  bionicProportion: 0.4,
};

// Theme presets
// Note: highlightColor is used for active word background in pacing mode.
// It must provide good contrast with textColor while being visually distinct from backgroundColor.
export const THEME_PRESETS: Record<ThemePreset, ThemeColors> = {
  light: {
    backgroundColor: '#ffffff',
    textColor: '#1a1a1a',
    linkColor: '#b58900',  // Golden amber - matches warm yellow highlight
    selectionColor: '#b4d5fe',
    highlightColor: '#fff3cd',  // Warm yellow - good contrast with dark text
  },
  sepia: {
    backgroundColor: '#f4ecd8',
    textColor: '#5c4b37',
    linkColor: '#8b5a2b',
    selectionColor: '#d4c4a8',
    highlightColor: '#ffeeba',  // Brighter warm yellow for better visibility
  },
  night: {
    backgroundColor: '#1a1a2e',
    textColor: '#e0e0e0',
    linkColor: '#6eb5ff',
    selectionColor: '#3a3a5e',
    highlightColor: '#4a4a8a',  // Brighter purple - visible against bg, good contrast with light text
  },
  eink: {
    backgroundColor: '#e8e8e8',
    textColor: '#2a2a2a',
    linkColor: '#444444',
    selectionColor: '#c0c0c0',
    highlightColor: '#fff3cd99',  // Warm yellow with transparency, same as light theme
  },
  highContrast: {
    backgroundColor: '#000000',
    textColor: '#ffffff',
    linkColor: '#ffff00',
    selectionColor: '#0000ff',
    highlightColor: '#1a4d1a',  // Dark green - distinct from black bg, white text readable
  },
  warmLight: {
    backgroundColor: '#fdf6e3',
    textColor: '#4a4235',
    linkColor: '#b58900',
    selectionColor: '#eee8d5',
    highlightColor: '#f5e0a0',  // Warmer, more saturated yellow
  },
  softFocus: {
    backgroundColor: '#f5f5f0',
    textColor: '#404040',
    linkColor: '#4a7c59',
    selectionColor: '#d4e5d8',
    highlightColor: '#d4e8c8',  // Soft green tint, more visible than neutral
  },
  ocean: {
    backgroundColor: '#fffbeb',
    textColor: '#1e3a5f',
    linkColor: '#2d6a4f',
    selectionColor: '#fde68a',
    highlightColor: '#bfdbfe',  // Clearer blue that complements navy text
  },
  amoled: {
    backgroundColor: '#000000',
    textColor: '#e4e4e7',
    linkColor: '#60a5fa',
    selectionColor: '#1e293b',
    highlightColor: '#2d4a6f',  // Medium blue - clearly visible on black, light text readable
  },
  amberNight: {
    backgroundColor: '#1a1410',
    textColor: '#e5c9a5',
    linkColor: '#d4a574',
    selectionColor: '#3d2c1e',
    highlightColor: '#5c4020',  // Richer amber/brown - distinct from bg, amber text readable
  },
  forest: {
    backgroundColor: '#f0f4e8',
    textColor: '#2d3b2d',
    linkColor: '#4a7c59',
    selectionColor: '#c8dcc0',
    highlightColor: '#c0dab0',  // Slightly more saturated green
  },
  custom: {
    backgroundColor: '#ffffff',
    textColor: '#1a1a1a',
    linkColor: '#b58900',  // Golden amber - matches warm yellow highlight
    selectionColor: '#b4d5fe',
    highlightColor: '#fff3cd',
  },
};
