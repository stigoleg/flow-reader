import { useReaderStore } from '../store';
import { MODE_OPTIONS } from '@/constants/ui-options';
import WPMInput from './WPMInput';
import TimeRemaining from './TimeRemaining';

interface TopBarProps {
  onImportClick: () => void;
}

export default function TopBar({ onImportClick }: TopBarProps) {
  const {
    document,
    isPlaying,
    currentWPM,
    currentBlockIndex,
    settings,
    togglePlay,
    setWPM,
    adjustWPM,
    setMode,
    toggleSettings,
  } = useReaderStore();

  const handleExit = () => {
    window.close();
  };

  const isBionic = settings.activeMode === 'bionic';

  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-2 pt-2 md:px-4 md:pt-3" role="banner">
      <div
        className="mx-auto rounded-xl px-2 py-2 shadow-lg md:max-w-4xl md:px-4"
        style={{
          backgroundColor: settings.backgroundColor,
          border: '1px solid rgba(128, 128, 128, 0.2)',
        }}
      >
        {/* Row 1: Main controls */}
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* Left section: Title (hidden on mobile) */}
          <div className="hidden md:block flex-1 min-w-0">
            <h1 className="text-sm font-medium truncate opacity-80">
              {document?.metadata.title || 'FlowReader'}
            </h1>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center gap-1 bg-black/5 rounded-lg p-0.5" role="tablist" aria-label="Reading mode">
            {MODE_OPTIONS.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setMode(mode.value)}
                role="tab"
                aria-selected={settings.activeMode === mode.value}
                className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all min-w-[44px] md:px-3 md:py-1 ${
                  settings.activeMode === mode.value
                    ? 'bg-white shadow-sm'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Speed Control - desktop only, invisible in bionic mode */}
          <div
            className="hidden md:flex items-center gap-3"
            style={{ visibility: isBionic ? 'hidden' : 'visible' }}
          >
            <WPMInput
              value={currentWPM}
              onChange={setWPM}
              onAdjust={adjustWPM}
            />
            {settings.showTimeRemaining && document && (
              <TimeRemaining
                totalText={document.plainText}
                currentBlockIndex={currentBlockIndex}
                blocks={document.blocks}
                wpm={currentWPM}
              />
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 md:gap-2" role="toolbar" aria-label="Reader controls">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-black/5 hover:bg-black/10 md:w-8 md:h-8"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              aria-label={isPlaying ? 'Pause reading' : 'Start reading'}
              aria-pressed={isPlaying}
            >
              {isPlaying ? (
                <svg className="w-5 h-5 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg className="w-5 h-5 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 24 24">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              )}
            </button>

            {/* Import */}
            <button
              onClick={onImportClick}
              className="flex w-10 h-10 items-center justify-center rounded opacity-60 hover:opacity-100 md:w-8 md:h-8"
              title="Import file"
              aria-label="Import document"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </button>

            {/* Settings */}
            <button
              onClick={toggleSettings}
              className="w-10 h-10 flex items-center justify-center rounded opacity-60 hover:opacity-100 md:w-8 md:h-8"
              title="Settings"
              aria-label="Open settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>

            {/* Exit */}
            <button
              onClick={handleExit}
              className="w-10 h-10 flex items-center justify-center rounded opacity-60 hover:opacity-100 md:w-8 md:h-8"
              title="Exit Reader"
              aria-label="Close reader"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Row 2: Speed Control - mobile only, hidden in bionic mode */}
        {!isBionic && (
          <div className="flex md:hidden items-center justify-center gap-3 mt-2 pt-2 border-t border-current/10">
            <WPMInput
              value={currentWPM}
              onChange={setWPM}
              onAdjust={adjustWPM}
            />
            {settings.showTimeRemaining && document && (
              <TimeRemaining
                totalText={document.plainText}
                currentBlockIndex={currentBlockIndex}
                blocks={document.blocks}
                wpm={currentWPM}
              />
            )}
          </div>
        )}
      </div>
    </header>
  );
}
