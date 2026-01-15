import type { ReaderSettings } from '@/types';
import { CheckboxField } from '@/components/ui';

interface DisplaySectionProps {
  settings: ReaderSettings;
  onUpdate: (settings: Partial<ReaderSettings>) => void;
}

export function DisplaySection({ settings, onUpdate }: DisplaySectionProps) {
  return (
    <div className="settings-group">
      <h3>Display</h3>
      <div className="space-y-4">
        <CheckboxField
          id="showTimeRemaining"
          label="Show time remaining"
          checked={settings.showTimeRemaining}
          onChange={(checked) => onUpdate({ showTimeRemaining: checked })}
        />
      </div>
    </div>
  );
}
