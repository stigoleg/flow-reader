// Settings ranges and defaults - single source of truth for UI controls

export const FONT_SIZE = {
  min: 14,
  max: 32,
  step: 1,
  default: 20,
} as const;

export const LINE_HEIGHT = {
  min: 1.2,
  max: 2.4,
  step: 0.1,
  default: 1.8,
} as const;

export const COLUMN_WIDTH = {
  min: 400,
  max: 900,
  step: 20,
  default: 680,
} as const;

export const WPM = {
  min: 50,
  max: 600,
  step: 10,
  coarseStep: 50,
  fineStep: 10,
  default: 200,
} as const;

export const TARGET_WPM = {
  min: 100,
  max: 1000,
  step: 10,
  default: 300,
} as const;

export const RAMP_STEP = {
  min: 1,
  max: 50,
  step: 1,
  default: 10,
} as const;

export const RAMP_INTERVAL = {
  min: 10,
  max: 300,
  step: 10,
  default: 60,
} as const;

export const BIONIC_INTENSITY = {
  min: 0,
  max: 1,
  step: 0.1,
  default: 0.7,
} as const;

export const BIONIC_PROPORTION = {
  min: 0.2,
  max: 0.6,
  step: 0.05,
  default: 0.4,
} as const;


