import { useReaderStore } from '../store';
import type { TocItem } from '@/types';

interface TocEntryProps {
  item: TocItem;
  currentChapter: number;
  onSelect: (chapterIndex: number) => void;
}

function TocEntry({ item, currentChapter, onSelect }: TocEntryProps) {
  const isActive = item.chapterIndex === currentChapter;
  
  return (
    <>
      <button
        onClick={() => onSelect(item.chapterIndex)}
        className={`toc-entry ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${1 + item.depth * 1}rem` }}
        aria-current={isActive ? 'page' : undefined}
      >
        <span className="toc-entry-label">{item.label}</span>
      </button>
      {item.children?.map((child) => (
        <TocEntry
          key={child.id}
          item={child}
          currentChapter={currentChapter}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

export default function TocPanel() {
  const document = useReaderStore((state) => state.document);
  const currentChapterIndex = useReaderStore((state) => state.currentChapterIndex);
  const isTocOpen = useReaderStore((state) => state.isTocOpen);
  const setTocOpen = useReaderStore((state) => state.setTocOpen);
  const setChapter = useReaderStore((state) => state.setChapter);

  if (!document?.book) {
    return null;
  }

  const { toc, chapters } = document.book;

  const handleSelect = (chapterIndex: number) => {
    setChapter(chapterIndex);
    setTocOpen(false);
  };

  // Calculate reading progress for each chapter
  const getTotalWords = () => chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
  const getWordsBeforeChapter = (index: number) => 
    chapters.slice(0, index).reduce((sum, ch) => sum + ch.wordCount, 0);

  const totalWords = getTotalWords();

  return (
    <>
      {/* Backdrop */}
      {isTocOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-90"
          onClick={() => setTocOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* TOC Panel */}
      <aside
        className={`toc-panel ${isTocOpen ? 'open' : ''}`}
        role="dialog"
        aria-label="Table of Contents"
        aria-modal="true"
        aria-hidden={!isTocOpen}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Contents</h2>
          <button
            onClick={() => setTocOpen(false)}
            className="p-2 hover:bg-black/10 rounded-full transition-colors"
            aria-label="Close table of contents"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Book info */}
        <div className="toc-book-info">
          <div className="toc-book-title">{document.metadata.title}</div>
          {document.metadata.author && (
            <div className="toc-book-author">{document.metadata.author}</div>
          )}
          <div className="toc-book-stats">
            {chapters.length} chapters &middot; {totalWords.toLocaleString()} words
          </div>
        </div>

        {/* TOC list */}
        <nav className="toc-list" aria-label="Chapters">
          {toc.map((item) => (
            <TocEntry
              key={item.id}
              item={item}
              currentChapter={currentChapterIndex}
              onSelect={handleSelect}
            />
          ))}
        </nav>

        {/* Progress overview */}
        <div className="toc-progress">
          <div className="toc-progress-label">
            Chapter {currentChapterIndex + 1} of {chapters.length}
          </div>
          <div className="toc-progress-bar">
            <div
              className="toc-progress-fill"
              style={{
                width: `${((getWordsBeforeChapter(currentChapterIndex) + (chapters[currentChapterIndex]?.wordCount || 0) / 2) / totalWords) * 100}%`,
              }}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
