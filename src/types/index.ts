// Document model types
export interface FlowDocument {
  metadata: DocumentMetadata;
  blocks: Block[];
  plainText: string;
}

export interface DocumentMetadata {
  title: string;
  author?: string;
  publishedAt?: string;
  source: 'web' | 'paste' | 'pdf' | 'docx' | 'selection';
  url?: string;
  createdAt: number;
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

// Storage schema
export interface StorageSchema {
  version: number;
  settings: ReaderSettings;
  presets: Record<string, Partial<ReaderSettings>>;
  positions: Record<string, ReadingPosition>;
  recentDocuments: RecentDocument[];
  onboardingCompleted: boolean;
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
  | { type: 'EXTRACT_FROM_URL'; url: string };

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
  linkColor: '#0066cc',
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
export const THEME_PRESETS: Record<ThemePreset, ThemeColors> = {
  light: {
    backgroundColor: '#ffffff',
    textColor: '#1a1a1a',
    linkColor: '#0066cc',
    selectionColor: '#b4d5fe',
    highlightColor: '#fff3cd',
  },
  sepia: {
    backgroundColor: '#f4ecd8',
    textColor: '#5c4b37',
    linkColor: '#8b5a2b',
    selectionColor: '#d4c4a8',
    highlightColor: '#e6d9b8',
  },
  night: {
    backgroundColor: '#1a1a2e',
    textColor: '#c9c9c9',
    linkColor: '#6eb5ff',
    selectionColor: '#3a3a5e',
    highlightColor: '#2a2a4e',
  },
  eink: {
    backgroundColor: '#e8e8e8',
    textColor: '#2a2a2a',
    linkColor: '#444444',
    selectionColor: '#c0c0c0',
    highlightColor: '#d0d0d0',
  },
  highContrast: {
    backgroundColor: '#000000',
    textColor: '#ffffff',
    linkColor: '#ffff00',
    selectionColor: '#0000ff',
    highlightColor: '#333333',
  },
  // NEW: Eye-friendly themes
  warmLight: {
    backgroundColor: '#fdf6e3',  // Warm cream (Solarized-inspired)
    textColor: '#4a4235',        // Warm dark brown
    linkColor: '#b58900',        // Amber/gold
    selectionColor: '#eee8d5',   // Lighter cream
    highlightColor: '#f5e6c8',   // Soft warm highlight
  },
  softFocus: {
    backgroundColor: '#f5f5f0',  // Off-white with slight warmth
    textColor: '#404040',        // Medium gray (not pure black)
    linkColor: '#4a7c59',        // Muted sage green
    selectionColor: '#d4e5d8',   // Soft green tint
    highlightColor: '#e8e8dc',   // Neutral light
  },
  ocean: {
    backgroundColor: '#fffbeb',  // Pale cream/yellow (dyslexia-friendly)
    textColor: '#1e3a5f',        // Navy blue (preferred over black)
    linkColor: '#2d6a4f',        // Dark teal
    selectionColor: '#fde68a',   // Light yellow
    highlightColor: '#dbeafe',   // Pale blue
  },
  amoled: {
    backgroundColor: '#000000',  // True black (pixel-off on OLED)
    textColor: '#e4e4e7',        // Light gray (not pure white)
    linkColor: '#60a5fa',        // Soft sky blue
    selectionColor: '#1e293b',   // Dark slate
    highlightColor: '#1c1c1e',   // Near black
  },
  amberNight: {
    backgroundColor: '#1a1410',  // Very dark warm brown
    textColor: '#e5c9a5',        // Warm amber text
    linkColor: '#d4a574',        // Copper/bronze
    selectionColor: '#3d2c1e',   // Dark amber
    highlightColor: '#2a1f16',   // Slightly lighter than bg
  },
  forest: {
    backgroundColor: '#f0f4e8',  // Very pale sage
    textColor: '#2d3b2d',        // Dark forest green
    linkColor: '#4a7c59',        // Medium green
    selectionColor: '#c8dcc0',   // Light sage
    highlightColor: '#d8e8d0',   // Pale green
  },
  custom: {
    backgroundColor: '#ffffff',
    textColor: '#1a1a1a',
    linkColor: '#0066cc',
    selectionColor: '#b4d5fe',
    highlightColor: '#fff3cd',
  },
};
