import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { 
  useReaderStore,
  selectDocument,
  selectIsLoading,
  selectError,
  selectSettings,
  selectSettingsLoaded,
} from './store';
import TopBar from './components/TopBar';
import ReaderView from './components/ReaderView';
import SettingsPanel from './components/SettingsPanel';
import ProgressBar from './components/ProgressBar';
import ImportPanel from './components/ImportPanel';
import HelpOverlay from './components/HelpOverlay';
import CompletionOverlay from './components/CompletionOverlay';
import Onboarding, { useOnboarding } from './components/Onboarding';
import type { FlowDocument } from '@/types';

export default function App() {
  // Use selectors for primitive state (no shallow needed)
  const document = useReaderStore(selectDocument);
  const isLoading = useReaderStore(selectIsLoading);
  const error = useReaderStore(selectError);
  const settings = useReaderStore(selectSettings);
  const settingsLoaded = useReaderStore(selectSettingsLoaded);
  
  // Use useShallow for selectors that return objects
  const { isPlaying } = useReaderStore(
    useShallow(state => ({ isPlaying: state.isPlaying }))
  );
  const { isImportOpen, isHelpOpen, isCompletionOpen } = useReaderStore(
    useShallow(state => ({
      isImportOpen: state.isImportOpen,
      isHelpOpen: state.isHelpOpen,
      isCompletionOpen: state.isCompletionOpen,
    }))
  );
  
  // Actions are stable references in Zustand, select individually
  const setDocument = useReaderStore(state => state.setDocument);
  const setError = useReaderStore(state => state.setError);
  const setImportOpen = useReaderStore(state => state.setImportOpen);
  const setHelpOpen = useReaderStore(state => state.setHelpOpen);
  const setCompletionOpen = useReaderStore(state => state.setCompletionOpen);
  const loadSettings = useReaderStore(state => state.loadSettings);
  const setPosition = useReaderStore(state => state.setPosition);
  const restorePosition = useReaderStore(state => state.restorePosition);
  const saveCurrentPosition = useReaderStore(state => state.saveCurrentPosition);
  
  const onboarding = useOnboarding();

  // Load settings from storage on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Load document from background script on mount
  useEffect(() => {
    async function loadDocument() {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_PENDING_DOCUMENT' });
        if (response) {
          setDocument(response as FlowDocument);
        } else {
          // No document - show import panel
          setImportOpen(true);
        }
      } catch {
        setError('Failed to load document. Please try again.');
      }
    }

    loadDocument();
  }, [setDocument, setError]);

  // Restore reading position when document loads
  useEffect(() => {
    if (document && settingsLoaded) {
      restorePosition();
    }
  }, [document, settingsLoaded, restorePosition]);

  // Save position when playback is paused
  useEffect(() => {
    if (!isPlaying && document) {
      saveCurrentPosition();
    }
  }, [isPlaying, document, saveCurrentPosition]);

  // Save position before unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (document) {
        saveCurrentPosition();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [document, saveCurrentPosition]);

  // Apply theme CSS variables
  useEffect(() => {
    const root = window.document.documentElement;
    root.style.setProperty('--reader-bg', settings.backgroundColor);
    root.style.setProperty('--reader-text', settings.textColor);
    root.style.setProperty('--reader-link', settings.linkColor);
    root.style.setProperty('--reader-selection', settings.selectionColor);
    root.style.setProperty('--reader-highlight', settings.highlightColor);
    root.style.setProperty('--font-reader', settings.fontFamily);
    root.style.setProperty('--font-size', `${settings.fontSize}px`);
    root.style.setProperty('--line-height', String(settings.lineHeight));
    root.style.setProperty('--paragraph-spacing', `${settings.paragraphSpacing}px`);

    // Update body background
    window.document.body.style.backgroundColor = settings.backgroundColor;
    window.document.body.style.color = settings.textColor;
  }, [settings]);

  if (isLoading || !settingsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current mx-auto mb-4"></div>
          <p className="opacity-60">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md px-4">
          <h1 className="text-xl font-semibold mb-2">FlowReader</h1>
          <p className="opacity-70 mb-4">{error}</p>
          <button
            onClick={() => setImportOpen(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Import Content
          </button>
          <ImportPanel isOpen={isImportOpen} onClose={() => setImportOpen(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen fade-in">
      <ProgressBar />
      <TopBar onImportClick={() => setImportOpen(true)} />
      <ReaderView />
      <SettingsPanel />
      <ImportPanel isOpen={isImportOpen} onClose={() => setImportOpen(false)} />
      <HelpOverlay isOpen={isHelpOpen} onClose={() => setHelpOpen(false)} />
      <CompletionOverlay 
        isOpen={isCompletionOpen} 
        onClose={() => setCompletionOpen(false)}
        onReadAgain={() => {
          setCompletionOpen(false);
          setPosition(0, 0);
        }}
        onImportNew={() => {
          setCompletionOpen(false);
          setImportOpen(true);
        }}
      />
      {onboarding.checked && onboarding.showOnboarding && (
        <Onboarding onComplete={onboarding.close} />
      )}
    </div>
  );
}
