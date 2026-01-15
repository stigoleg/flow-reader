import type { ReaderSettings } from '@/types';
import { SliderField } from '@/components/ui';
import { BIONIC_INTENSITY, BIONIC_PROPORTION } from '@/constants/settings';

interface BionicSectionProps {
  settings: ReaderSettings;
  onUpdate: (settings: Partial<ReaderSettings>) => void;
}

export function BionicSection({ settings, onUpdate }: BionicSectionProps) {
  return (
    <div className="settings-group">
      <h3>Bionic Reading</h3>
      <div className="space-y-4">
        <SliderField
          label="Intensity"
          value={settings.bionicIntensity}
          min={BIONIC_INTENSITY.min}
          max={BIONIC_INTENSITY.max}
          step={BIONIC_INTENSITY.step}
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(value) => onUpdate({ bionicIntensity: value })}
        />
        <SliderField
          label="Bold Proportion"
          value={settings.bionicProportion}
          min={BIONIC_PROPORTION.min}
          max={BIONIC_PROPORTION.max}
          step={BIONIC_PROPORTION.step}
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(value) => onUpdate({ bionicProportion: value })}
        />
      </div>
    </div>
  );
}
