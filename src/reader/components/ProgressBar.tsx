import { useReaderStore } from '../store';

export default function ProgressBar() {
  const { document, currentBlockIndex, currentChapterIndex } = useReaderStore();

  if (!document || document.blocks.length === 0) {
    return null;
  }

  let progress: number;
  
  if (document.book && document.book.chapters.length > 0) {
    // Book: calculate progress across all chapters using word counts
    const chapters = document.book.chapters;
    const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
    
    // Words completed in previous chapters
    const wordsInPrevChapters = chapters
      .slice(0, currentChapterIndex)
      .reduce((sum, ch) => sum + ch.wordCount, 0);
    
    // Approximate words completed in current chapter based on block progress
    const currentChapter = chapters[currentChapterIndex];
    const chapterProgress = (currentBlockIndex + 1) / document.blocks.length;
    const wordsInCurrentChapter = currentChapter.wordCount * chapterProgress;
    
    progress = ((wordsInPrevChapters + wordsInCurrentChapter) / totalWords) * 100;
  } else {
    // Regular document: progress by blocks
    progress = ((currentBlockIndex + 1) / document.blocks.length) * 100;
  }

  return (
    <div className="progress-bar">
      <div
        className="progress-bar-fill"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
