export function KeyboardSection() {
  return (
    <div className="settings-group">
      <h3>Keyboard Shortcuts</h3>
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="opacity-70">Play / Pause</span>
          <kbd className="text-right opacity-60">Space</kbd>
          
          <span className="opacity-70">Next</span>
          <kbd className="text-right opacity-60">&#8594; or J</kbd>
          
          <span className="opacity-70">Previous</span>
          <kbd className="text-right opacity-60">&#8592; or K</kbd>
          
          <span className="opacity-70">Speed up</span>
          <kbd className="text-right opacity-60">&#8593;</kbd>
          
          <span className="opacity-70">Speed down</span>
          <kbd className="text-right opacity-60">&#8595;</kbd>
          
          <span className="opacity-70">Cycle mode</span>
          <kbd className="text-right opacity-60">M</kbd>
          
          <span className="opacity-70">Toggle Bionic</span>
          <kbd className="text-right opacity-60">B</kbd>
          
          <span className="opacity-70">Cycle granularity</span>
          <kbd className="text-right opacity-60">G</kbd>
          
          <span className="opacity-70">Close</span>
          <kbd className="text-right opacity-60">Esc</kbd>
        </div>
        
        <button
          onClick={() => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
          className="mt-3 text-xs opacity-60 hover:opacity-100 underline"
        >
          Customize extension shortcuts
        </button>
      </div>
    </div>
  );
}
