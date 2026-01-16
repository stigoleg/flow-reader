import { THEME_PRESETS, type ThemePreset } from '@/types';
import { THEME_OPTIONS } from '@/constants/ui-options';

interface ThemeSectionProps {
  onApplyTheme: (theme: ThemePreset) => void;
}

export function ThemeSection({ onApplyTheme }: ThemeSectionProps) {
  return (
    <div className="settings-group">
      <h3>Theme</h3>
      <div className="flex gap-2 flex-wrap">
        {THEME_OPTIONS.map((theme) => (
          <ThemeButton key={theme.value} theme={theme.value} label={theme.label} onClick={onApplyTheme} />
        ))}
      </div>
    </div>
  );
}

interface ThemeButtonProps {
  theme: ThemePreset;
  label: string;
  onClick: (theme: ThemePreset) => void;
}

function ThemeButton({ theme, label, onClick }: ThemeButtonProps) {
  const colors = THEME_PRESETS[theme];
  return (
    <button
      onClick={() => onClick(theme)}
      className="px-3 py-2 text-sm rounded-lg border border-current/20 hover:border-current/40 transition-colors min-h-[44px] md:py-1.5 md:min-h-0"
      style={{
        backgroundColor: colors.backgroundColor,
        color: colors.textColor,
      }}
    >
      {label}
    </button>
  );
}
