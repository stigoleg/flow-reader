import type { ThemePreset, PacingGranularity, PacingHighlightStyle, ReadingMode } from '@/types';

export const FONT_OPTIONS = [
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Charter, serif', label: 'Charter' },
  { value: 'Palatino, serif', label: 'Palatino' },
  { value: 'system-ui, sans-serif', label: 'System UI' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Atkinson Hyperlegible, sans-serif', label: 'Atkinson' },
  { value: 'OpenDyslexic, sans-serif', label: 'OpenDyslexic' },
] as const;

export const THEME_OPTIONS: { value: ThemePreset; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'night', label: 'Night' },
  { value: 'eink', label: 'E-Ink' },
  { value: 'highContrast', label: 'High Contrast' },
  { value: 'warmLight', label: 'Warm Light' },
  { value: 'softFocus', label: 'Soft Focus' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'amoled', label: 'AMOLED' },
  { value: 'amberNight', label: 'Amber Night' },
  { value: 'forest', label: 'Forest' },
];

export const GRANULARITY_OPTIONS: { value: PacingGranularity; label: string; description: string }[] = [
  { value: 'block', label: 'Paragraph', description: 'Highlight full paragraphs' },
  { value: 'sentence', label: 'Sentence', description: 'Highlight one sentence at a time' },
  { value: 'word', label: 'Word', description: 'Highlight each word in sequence' },
];

export const HIGHLIGHT_STYLE_OPTIONS: { value: PacingHighlightStyle; label: string }[] = [
  { value: 'background', label: 'Background' },
  { value: 'underline', label: 'Underline' },
  { value: 'box', label: 'Box' },
];

export const MODE_OPTIONS: { value: ReadingMode; label: string }[] = [
  { value: 'pacing', label: 'Pacing' },
  { value: 'bionic', label: 'Bionic' },
  { value: 'rsvp', label: 'RSVP' },
];
