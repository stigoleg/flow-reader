import type { ReaderSettings } from '@/types';
import { ButtonGroup, CheckboxField, SliderField } from '@/components/ui';
import { GRANULARITY_OPTIONS, HIGHLIGHT_STYLE_OPTIONS } from '@/constants/ui-options';

interface PacingSectionProps {
  settings: ReaderSettings;
  onUpdate: (settings: Partial<ReaderSettings>) => void;
}

export function PacingSection({ settings, onUpdate }: PacingSectionProps) {
  return (
    <div className="settings-group">
      <h3>Pacing</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-2 opacity-70">Highlight</label>
          <ButtonGroup
            options={GRANULARITY_OPTIONS}
            value={settings.pacingGranularity}
            onChange={(value) => onUpdate({ pacingGranularity: value })}
          />
        </div>
        <div>
          <label className="block text-sm mb-2 opacity-70">Style</label>
          <ButtonGroup
            options={HIGHLIGHT_STYLE_OPTIONS}
            value={settings.pacingHighlightStyle}
            onChange={(value) => onUpdate({ pacingHighlightStyle: value })}
          />
        </div>
        <CheckboxField
          id="pacingDimContext"
          label="Dim surrounding text"
          checked={settings.pacingDimContext}
          onChange={(checked) => onUpdate({ pacingDimContext: checked })}
        />
        <CheckboxField
          id="pacingShowGuide"
          label="Show reading guide"
          checked={settings.pacingShowGuide}
          onChange={(checked) => onUpdate({ pacingShowGuide: checked })}
        />
        {settings.pacingGranularity === 'word' && (
          <>
            <CheckboxField
              id="pacingBoldFocusLetter"
              label="Bold focus letter (like Bionic)"
              checked={settings.pacingBoldFocusLetter}
              onChange={(checked) => onUpdate({ pacingBoldFocusLetter: checked })}
            />
            <CheckboxField
              id="pacingAdaptiveSpeed"
              label="Adaptive speed (vary by word complexity)"
              checked={settings.pacingAdaptiveSpeed}
              onChange={(checked) => onUpdate({ pacingAdaptiveSpeed: checked })}
            />
          </>
        )}
        <CheckboxField
          id="pacingReadabilitySpeed"
          label="Adjust speed by paragraph difficulty"
          checked={settings.pacingReadabilitySpeed}
          onChange={(checked) => onUpdate({ pacingReadabilitySpeed: checked })}
        />
        <CheckboxField
          id="pacingPauseOnPunctuation"
          label="Pause on punctuation"
          checked={settings.pacingPauseOnPunctuation}
          onChange={(checked) => onUpdate({ pacingPauseOnPunctuation: checked })}
        />
        <SliderField
          label="Heading pause"
          value={settings.pacingHeadingPause}
          min={1.0}
          max={5.0}
          step={0.5}
          unit="x"
          onChange={(value) => onUpdate({ pacingHeadingPause: value })}
        />
      </div>
    </div>
  );
}
