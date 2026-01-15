import { useMemo } from 'react';
import { getWordCount } from '@/lib/tokenizer';

interface TimeRemainingProps {
  totalText: string;
  currentBlockIndex: number;
  blocks: { content?: string; items?: string[] }[];
  wpm: number;
  className?: string;
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
}: TimeRemainingProps) {
  const { remaining, total } = useMemo(() => {
    const totalWords = getWordCount(totalText);
    
    // Calculate words read so far
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
  }, [totalText, currentBlockIndex, blocks, wpm]);

  return (
    <span className={`text-xs opacity-60 ${className}`} title={`Total: ${total}`}>
      {remaining} left
    </span>
  );
}
