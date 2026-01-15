import type { ReaderSettings } from '@/types';
import { SliderField, CheckboxField } from '@/components/ui';
import { WPM, TARGET_WPM } from '@/constants/settings';

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
            <div>
              <label className="block text-sm mb-1 opacity-70">
                Increase by {settings.rampStep} WPM every {settings.rampInterval}s
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
