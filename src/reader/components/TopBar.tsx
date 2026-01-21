import { useState, useRef, useEffect, useCallback } from 'react';
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
    currentChapterIndex,
    settings,
    togglePlay,
    setWPM,
    adjustWPM,
    setMode,
    toggleSettings,
    toggleToc,
    nextChapter,
    prevChapter,
    renameDocument,
    // Notes
    annotations,
    toggleNotesPanel,
    // Search
    toggleSearch,
    // Edit paste
    setEditPasteOpen,
  } = useReaderStore();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editValue, setEditValue] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const startEditing = useCallback(() => {
    if (document) {
      setEditValue(document.metadata.title);
      setIsEditingTitle(true);
    }
  }, [document]);

  const finishEditing = useCallback(async () => {
    if (editValue.trim() && editValue.trim() !== document?.metadata.title) {
      await renameDocument(editValue.trim());
    }
    setIsEditingTitle(false);
  }, [editValue, document?.metadata.title, renameDocument]);

  const cancelEditing = useCallback(() => {
    setIsEditingTitle(false);
    setEditValue(document?.metadata.title || '');
  }, [document?.metadata.title]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishEditing();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  }, [finishEditing, cancelEditing]);

  const handleExit = () => {
    window.close();
  };

  const isBionic = settings.activeMode === 'bionic';
  const isBook = !!document?.book;
  const chapters = document?.book?.chapters;
  const canGoPrev = isBook && currentChapterIndex > 0;
  const canGoNext = isBook && chapters && currentChapterIndex < chapters.length - 1;
  const currentChapterTitle = chapters?.[currentChapterIndex]?.title;
  
  // Can edit if this is a paste document with stored content
  const canEditPaste = document?.metadata.source === 'paste' && !!document.metadata.pasteContent;

  return (
    <header className="top-bar fixed top-0 left-0 right-0 z-40 px-2 pt-2 md:px-4 md:pt-3" role="banner">
      <div
        className="mx-auto rounded-xl px-2 py-2 shadow-lg md:max-w-4xl md:px-4"
        style={{
          backgroundColor: settings.backgroundColor,
          border: '1px solid rgba(128, 128, 128, 0.2)',
        }}
      >
        {/* Row 1: Main controls */}
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* Left section: Title and chapter nav */}
          <div className="hidden md:flex items-center gap-2 flex-1 min-w-0">
            {isBook ? (
              <>
                {/* TOC Button */}
                <button
                  onClick={toggleToc}
                  className="flex items-center justify-center w-8 h-8 rounded opacity-60 hover:opacity-100"
                  title="Table of Contents (T)"
                  aria-label="Open table of contents"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                </button>
                
                {/* Chapter navigation */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={prevChapter}
                    disabled={!canGoPrev}
                    className="w-6 h-6 flex items-center justify-center rounded opacity-60 hover:opacity-100 disabled:opacity-20"
                    title="Previous Chapter ([)"
                    aria-label="Previous chapter"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-xs opacity-60 min-w-[3rem] text-center">
                    {currentChapterIndex + 1}/{chapters?.length || 0}
                  </span>
                  <button
                    onClick={nextChapter}
                    disabled={!canGoNext}
                    className="w-6 h-6 flex items-center justify-center rounded opacity-60 hover:opacity-100 disabled:opacity-20"
                    title="Next Chapter (])"
                    aria-label="Next chapter"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                
                {/* Chapter title */}
                <h1 className="text-sm font-medium truncate opacity-80 flex-1">
                  {currentChapterTitle || document?.metadata.title || 'FlowReader'}
                </h1>
              </>
            ) : (
              isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  className="text-sm font-medium opacity-80 bg-transparent border-b border-current outline-none px-1 py-0.5 min-w-[100px] max-w-[300px]"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  onBlur={finishEditing}
                />
              ) : (
                <button
                  onClick={startEditing}
                  className="text-sm font-medium truncate opacity-80 hover:opacity-100 text-left cursor-text"
                  title="Click to rename"
                  aria-label="Click to rename document"
                >
                  {document?.metadata.title || 'FlowReader'}
                </button>
              )
            )}
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
                book={document.book}
                currentChapterIndex={currentChapterIndex}
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

            {/* Edit Paste (only for paste documents) */}
            {canEditPaste && (
              <button
                onClick={() => setEditPasteOpen(true)}
                className="flex w-10 h-10 items-center justify-center rounded opacity-60 hover:opacity-100 md:w-8 md:h-8"
                title="Edit pasted text"
                aria-label="Edit pasted content"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            )}

            {/* Notes & Highlights */}
            <button
              onClick={toggleNotesPanel}
              className="relative w-10 h-10 flex items-center justify-center rounded opacity-60 hover:opacity-100 md:w-8 md:h-8"
              title="Notes & Highlights (N)"
              aria-label="Open notes and highlights"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
              {/* Badge showing annotation count */}
              {annotations.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-medium bg-reader-link text-white rounded-full">
                  {annotations.length > 99 ? '99+' : annotations.length}
                </span>
              )}
            </button>

            {/* Search */}
            <button
              onClick={toggleSearch}
              className="w-10 h-10 flex items-center justify-center rounded opacity-60 hover:opacity-100 md:w-8 md:h-8"
              title="Search (Ctrl+F)"
              aria-label="Search in document"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
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

        {/* Row 2: Chapter navigation - mobile only, for books */}
        {isBook && (
          <div className="flex md:hidden items-center justify-between gap-2 mt-2 pt-2 border-t border-current/10">
            <button
              onClick={toggleToc}
              className="flex items-center gap-1 px-2 py-1 rounded bg-black/5 text-xs"
              aria-label="Open table of contents"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <span className="truncate max-w-[120px]">{currentChapterTitle || 'Contents'}</span>
            </button>
            
            <div className="flex items-center gap-1">
              <button
                onClick={prevChapter}
                disabled={!canGoPrev}
                className="w-8 h-8 flex items-center justify-center rounded bg-black/5 disabled:opacity-20"
                aria-label="Previous chapter"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-xs opacity-60 min-w-[3rem] text-center">
                {currentChapterIndex + 1}/{chapters?.length || 0}
              </span>
              <button
                onClick={nextChapter}
                disabled={!canGoNext}
                className="w-8 h-8 flex items-center justify-center rounded bg-black/5 disabled:opacity-20"
                aria-label="Next chapter"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Row 3: Speed Control - mobile only, hidden in bionic mode */}
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
                book={document.book}
                currentChapterIndex={currentChapterIndex}
              />
            )}
          </div>
        )}
      </div>
    </header>
  );
}
