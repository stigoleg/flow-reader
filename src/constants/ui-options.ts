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

export const THEME_OPTIONS: { value: ThemePreset; label: string; category: 'standard' | 'eye-friendly' }[] = [
  { value: 'light', label: 'Light', category: 'standard' },
  { value: 'sepia', label: 'Sepia', category: 'standard' },
  { value: 'night', label: 'Night', category: 'standard' },
  { value: 'eink', label: 'E-Ink', category: 'standard' },
  { value: 'highContrast', label: 'High Contrast', category: 'standard' },
  { value: 'warmLight', label: 'Warm Light', category: 'eye-friendly' },
  { value: 'softFocus', label: 'Soft Focus', category: 'eye-friendly' },
  { value: 'ocean', label: 'Ocean', category: 'eye-friendly' },
  { value: 'amoled', label: 'AMOLED', category: 'eye-friendly' },
  { value: 'amberNight', label: 'Amber Night', category: 'eye-friendly' },
  { value: 'forest', label: 'Forest', category: 'eye-friendly' },
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
