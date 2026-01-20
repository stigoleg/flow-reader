import type { PacingGranularity, PacingHighlightStyle, PacingSettings } from '@/types';

export interface ModeConfig {
  isPacing: boolean;
  isBionic: boolean;
}

export interface BionicConfig {
  intensity: number;
  proportion: number;
  adaptive: boolean;
}

export interface PacingConfig extends PacingSettings {
  granularity: PacingGranularity;
  highlightStyle: PacingHighlightStyle;
}

export interface PositionState {
  sentenceIndex: number;
  wordIndex: number;
}

export interface BlockHandlers {
  onClick: () => void;
  onWordClick: (wordIndex: number) => void;
  onSentenceClick: (sentenceIndex: number) => void;
}
