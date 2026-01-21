import { useEffect, useRef, useState, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { 
  useReaderStore,
  selectDocument,
  selectIsLoading,
  selectError,
  selectSettings,
  selectSettingsLoaded,
  selectIsFocusMode,
} from './store';
import TopBar from './components/TopBar';
import ReaderView from './components/ReaderView';
import SettingsPanel from './components/SettingsPanel';
import TocPanel from './components/TocPanel';
import ProgressBar from './components/ProgressBar';
import ImportPanel from './components/ImportPanel';
import HelpOverlay from './components/HelpOverlay';
import CompletionOverlay from './components/CompletionOverlay';
import Onboarding, { useOnboarding } from './components/Onboarding';
import OfflineIndicator from '@/components/OfflineIndicator';
import { useStorageSync } from './hooks/useStorageSync';
import { getCurrentDocument } from '@/lib/storage';
import { getAnnotations, getDocumentAnnotationKey } from '@/lib/annotations-service';
import type { FlowDocument } from '@/types';

// Focus mode hover timeout (show UI on mouse move)
const FOCUS_MODE_HOVER_TIMEOUT = 2000;

export default function App() {
  // Use selectors for primitive state (no shallow needed)
  const document = useReaderStore(selectDocument);
  const isLoading = useReaderStore(selectIsLoading);
  const error = useReaderStore(selectError);
  const settings = useReaderStore(selectSettings);
  const settingsLoaded = useReaderStore(selectSettingsLoaded);
  const isFocusMode = useReaderStore(selectIsFocusMode);
  
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
  const setLoading = useReaderStore(state => state.setLoading);
  const setImportOpen = useReaderStore(state => state.setImportOpen);
  const setHelpOpen = useReaderStore(state => state.setHelpOpen);
  const setCompletionOpen = useReaderStore(state => state.setCompletionOpen);
  const loadSettings = useReaderStore(state => state.loadSettings);
  const setPosition = useReaderStore(state => state.setPosition);
  const restorePosition = useReaderStore(state => state.restorePosition);
  const saveCurrentPosition = useReaderStore(state => state.saveCurrentPosition);
  const scrollToAnnotation = useReaderStore(state => state.scrollToAnnotation);
  
  const onboarding = useOnboarding();
  
  // Focus mode hover state - show UI on mouse movement
  const [focusModeHover, setFocusModeHover] = useState(false);
  const focusModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFocusModeHint, setShowFocusModeHint] = useState(false);
  
  // Track when focus mode changes to show hint
  const prevFocusModeRef = useRef(isFocusMode);
  useEffect(() => {
    if (isFocusMode && !prevFocusModeRef.current) {
      // Just entered focus mode - show hint
      setShowFocusModeHint(true);
      const timer = setTimeout(() => setShowFocusModeHint(false), 3000);
      return () => clearTimeout(timer);
    }
    prevFocusModeRef.current = isFocusMode;
  }, [isFocusMode]);
  
  // Handle mouse movement in focus mode
  const handleMouseMove = useCallback(() => {
    if (!isFocusMode) return;
    
    setFocusModeHover(true);
    
    // Clear existing timer
    if (focusModeTimerRef.current) {
      clearTimeout(focusModeTimerRef.current);
    }
    
    // Hide UI after timeout
    focusModeTimerRef.current = setTimeout(() => {
      setFocusModeHover(false);
    }, FOCUS_MODE_HOVER_TIMEOUT);
  }, [isFocusMode]);
  
  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (focusModeTimerRef.current) {
        clearTimeout(focusModeTimerRef.current);
      }
    };
  }, []);
  
  // Subscribe to storage changes for live sync updates
  useStorageSync();
  
  // Track which document we've restored position for to prevent loops
  // (setChapter modifies document, which would re-trigger restorePosition)
  const restoredDocRef = useRef<string | null>(null);
  
  // Track annotation ID to navigate to after document loads
  const pendingAnnotationIdRef = useRef<string | null>(null);

  // Load settings from storage on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Load document from background script on mount
  useEffect(() => {
    async function loadDocument() {
      try {
        // First, try to get pending document from background script
        const response = await chrome.runtime.sendMessage({ type: 'GET_PENDING_DOCUMENT' });
        if (response?.document) {
          setDocument(response.document as FlowDocument);
          // Store annotation ID for navigation after document loads
          if (response.annotationId) {
            pendingAnnotationIdRef.current = response.annotationId;
          }
          return;
        }
        
        // No pending document - this is likely a page refresh
        // Try to load the previously-open document from storage
        const savedDoc = await getCurrentDocument();
        if (savedDoc) {
          setDocument(savedDoc);
          return;
        }
        
        // No document anywhere - show import panel
        // Must set loading to false so the UI doesn't get stuck
        setLoading(false);
        setImportOpen(true);
      } catch {
        setError('Failed to load document. Please try again.');
      }
    }

    loadDocument();
  }, [setDocument, setError, setLoading]);

  // Restore reading position when document loads
  // Only restore once per document to prevent loops (setChapter modifies document)
  useEffect(() => {
    if (document && settingsLoaded) {
      // Create a unique key for this document
      const docKey = document.metadata.fileHash || document.metadata.url || `${document.metadata.createdAt}`;
      
      // Only restore if we haven't already restored for this document
      if (restoredDocRef.current !== docKey) {
        restoredDocRef.current = docKey;
        
        // Check if we need to navigate to a specific annotation
        if (pendingAnnotationIdRef.current) {
          const annotationId = pendingAnnotationIdRef.current;
          pendingAnnotationIdRef.current = null; // Clear after use
          
          // First restore the saved reading position (for playback)
          // Then scroll to the annotation (for viewing)
          const documentKey = getDocumentAnnotationKey(document.metadata);
          
          // Restore position first, then scroll to annotation
          restorePosition().then(() => {
            getAnnotations(documentKey).then(annotations => {
              const annotation = annotations.find(a => a.id === annotationId);
              if (annotation) {
                // Scroll to annotation without changing reading position
                scrollToAnnotation(annotation);
              }
            }).catch((error) => {
              // Error loading annotations - position is already restored
              if (import.meta.env.DEV) {
                console.warn('[FlowReader:Reader] Failed to load annotations for navigation:', error);
              }
            });
          });
        } else {
          // No pending annotation, restore normal position
          restorePosition();
        }
      }
    }
  }, [document, settingsLoaded, restorePosition, scrollToAnnotation]);

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

  // Build focus mode class names
  const focusModeClasses = isFocusMode 
    ? `reader-focus-mode${focusModeHover ? ' focus-mode-hover' : ''}`
    : '';

  return (
    <div 
      className={`min-h-screen fade-in ${focusModeClasses}`}
      onMouseMove={handleMouseMove}
    >
      <ProgressBar />
      <TopBar onImportClick={() => setImportOpen(true)} />
      <ReaderView />
      <SettingsPanel />
      <TocPanel />
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
      {/* Focus mode hint - shows briefly when entering focus mode */}
      {showFocusModeHint && (
        <div className="focus-mode-indicator">
          Focus mode enabled. Press F or Esc to exit.
        </div>
      )}
      <OfflineIndicator />
    </div>
  );
}
