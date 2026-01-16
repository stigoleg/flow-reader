import { useMemo } from 'react';
import { getWordCount } from '@/lib/tokenizer';
import type { BookStructure } from '@/types';

interface TimeRemainingProps {
  totalText: string;
  currentBlockIndex: number;
  blocks: { content?: string; items?: string[] }[];
  wpm: number;
  className?: string;
  /** Optional book structure for multi-chapter documents */
  book?: BookStructure;
  /** Current chapter index (required when book is provided) */
  currentChapterIndex?: number;
}

function formatTime(minutes: number): string {
  if (minutes < 1) {
    const seconds = Math.round(minutes * 60);
    return `${seconds}s`;
  }
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export default function TimeRemaining({
  totalText,
  currentBlockIndex,
  blocks,
  wpm,
  className = '',
  book,
  currentChapterIndex = 0,
}: TimeRemainingProps) {
  const { remaining, total } = useMemo(() => {
    if (book && book.chapters.length > 0) {
      // Book: calculate based on word counts across all chapters
      const chapters = book.chapters;
      const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
      
      // Words in completed chapters
      const wordsInCompletedChapters = chapters
        .slice(0, currentChapterIndex)
        .reduce((sum, ch) => sum + ch.wordCount, 0);
      
      // Approximate progress in current chapter based on blocks
      const currentChapter = chapters[currentChapterIndex];
      const chapterBlockProgress = blocks.length > 0 
        ? currentBlockIndex / blocks.length 
        : 0;
      const wordsInCurrentChapter = currentChapter.wordCount * chapterBlockProgress;
      
      const wordsRead = wordsInCompletedChapters + wordsInCurrentChapter;
      const wordsRemaining = Math.max(0, totalWords - wordsRead);
      
      const minutesRemaining = wordsRemaining / wpm;
      const totalMinutes = totalWords / wpm;
      
      return {
        remaining: formatTime(minutesRemaining),
        total: formatTime(totalMinutes),
      };
    }
    
    // Regular document: calculate words read so far
    const totalWords = getWordCount(totalText);
    
    let wordsRead = 0;
    for (let i = 0; i < currentBlockIndex && i < blocks.length; i++) {
      const block = blocks[i];
      const text = block.content || block.items?.join(' ') || '';
      wordsRead += getWordCount(text);
    }
    
    const wordsRemaining = Math.max(0, totalWords - wordsRead);
    const minutesRemaining = wordsRemaining / wpm;
    const totalMinutes = totalWords / wpm;
    
    return {
      remaining: formatTime(minutesRemaining),
      total: formatTime(totalMinutes),
    };
  }, [totalText, currentBlockIndex, blocks, wpm, book, currentChapterIndex]);

  return (
    <span className={`text-xs opacity-60 ${className}`} title={`Total: ${total}`}>
      {remaining} left
    </span>
  );
}
