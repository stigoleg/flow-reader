import type { ReaderSettings } from '@/types';
import { SelectField, SliderField } from '@/components/ui';
import { FONT_OPTIONS } from '@/constants/ui-options';
import { FONT_SIZE, LINE_HEIGHT, COLUMN_WIDTH } from '@/constants/settings';

interface TypographySectionProps {
  settings: ReaderSettings;
  onUpdate: (settings: Partial<ReaderSettings>) => void;
}

export function TypographySection({ settings, onUpdate }: TypographySectionProps) {
  return (
    <div className="settings-group">
      <h3>Typography</h3>
      <div className="space-y-4">
        <SelectField
          label="Font"
          value={settings.fontFamily}
          options={FONT_OPTIONS}
          onChange={(value) => onUpdate({ fontFamily: value })}
        />
        <SliderField
          label="Font Size"
          value={settings.fontSize}
          min={FONT_SIZE.min}
          max={FONT_SIZE.max}
          step={FONT_SIZE.step}
          unit="px"
          onChange={(value) => onUpdate({ fontSize: value })}
        />
        <SliderField
          label="Line Height"
          value={settings.lineHeight}
          min={LINE_HEIGHT.min}
          max={LINE_HEIGHT.max}
          step={LINE_HEIGHT.step}
          onChange={(value) => onUpdate({ lineHeight: value })}
        />
        <SliderField
          label="Column Width"
          value={settings.columnWidth}
          min={COLUMN_WIDTH.min}
          max={COLUMN_WIDTH.max}
          step={COLUMN_WIDTH.step}
          unit="px"
          onChange={(value) => onUpdate({ columnWidth: value })}
        />
      </div>
    </div>
  );
}
