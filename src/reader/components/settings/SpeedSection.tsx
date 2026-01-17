import type { ReaderSettings } from '@/types';
import { SliderField, CheckboxField } from '@/components/ui';
import { WPM, TARGET_WPM, RAMP_STEP, RAMP_INTERVAL } from '@/constants/settings';

interface SpeedSectionProps {
  settings: ReaderSettings;
  onUpdate: (settings: Partial<ReaderSettings>) => void;
}

export function SpeedSection({ settings, onUpdate }: SpeedSectionProps) {
  return (
    <div className="settings-group">
      <h3>Speed</h3>
      <div className="space-y-4">
        <SliderField
          label="Base Speed"
          value={settings.baseWPM}
          min={WPM.min}
          max={WPM.max}
          step={WPM.step}
          unit=" WPM"
          onChange={(value) => onUpdate({ baseWPM: value })}
        />
        <CheckboxField
          id="rampEnabled"
          label="Enable speed ramp-up"
          checked={settings.rampEnabled}
          onChange={(checked) => onUpdate({ rampEnabled: checked })}
        />
        {settings.rampEnabled && (
          <>
            <SliderField
              label="Target Speed"
              value={settings.targetWPM}
              min={TARGET_WPM.min}
              max={TARGET_WPM.max}
              step={TARGET_WPM.step}
              unit=" WPM"
              onChange={(value) => onUpdate({ targetWPM: value })}
            />
            <SliderField
              label="Increase by"
              value={settings.rampStep}
              min={RAMP_STEP.min}
              max={RAMP_STEP.max}
              step={RAMP_STEP.step}
              unit=" WPM"
              onChange={(value) => onUpdate({ rampStep: value })}
            />
            <SliderField
              label="Every"
              value={settings.rampInterval}
              min={RAMP_INTERVAL.min}
              max={RAMP_INTERVAL.max}
              step={RAMP_INTERVAL.step}
              unit=" seconds"
              onChange={(value) => onUpdate({ rampInterval: value })}
            />
          </>
        )}
      </div>
    </div>
  );
}
