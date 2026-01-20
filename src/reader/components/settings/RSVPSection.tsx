import type { ReaderSettings } from '@/types';
import { SliderField, CheckboxField } from '@/components/ui';
import { RSVP_CHUNK_SIZE } from '@/constants/settings';

interface RSVPSectionProps {
  settings: ReaderSettings;
  onUpdate: (settings: Partial<ReaderSettings>) => void;
}

export function RSVPSection({ settings, onUpdate }: RSVPSectionProps) {
  return (
    <div className="settings-group">
      <h3>RSVP</h3>
      <div className="space-y-4">
        <SliderField
          label="Words per flash"
          value={settings.rsvpChunkSize}
          min={RSVP_CHUNK_SIZE.min}
          max={RSVP_CHUNK_SIZE.max}
          step={RSVP_CHUNK_SIZE.step}
          formatValue={(v) => `${v} word${v > 1 ? 's' : ''}`}
          onChange={(value) => onUpdate({ rsvpChunkSize: value })}
        />
        <CheckboxField
          id="rsvpPauseOnPunctuation"
          label="Pause on punctuation"
          checked={settings.rsvpPauseOnPunctuation}
          onChange={(checked) => onUpdate({ rsvpPauseOnPunctuation: checked })}
        />
        <p className="text-xs opacity-50 mt-2">
          RSVP (Rapid Serial Visual Presentation) flashes words at your reading speed.
          Higher chunk sizes show more words at once.
        </p>
      </div>
    </div>
  );
}
