import { useMemo } from 'react';
import type { PacingGranularity, PacingSettings } from '@/types';
import { tokenizeIntoSentences, tokenizeIntoWords, findORP } from '@/lib/tokenizer';

interface PacingContentProps {
  text: string;
  granularity: PacingGranularity;
  currentIndex: number; // -1 means no item is active in this block
  indexOffset?: number;
  pacingSettings: PacingSettings;
  onItemClick: (index: number) => void;
}

export default function PacingContent({
  text,
  granularity,
  currentIndex,
  indexOffset = 0,
  pacingSettings,
  onItemClick,
}: PacingContentProps) {
  const { pacingHighlightStyle, pacingDimContext, pacingShowGuide, pacingBoldFocusLetter } = pacingSettings;

  const words = useMemo(() => {
    if (granularity !== 'word') return [];
    return tokenizeIntoWords(text);
  }, [granularity, text]);

  const sentences = useMemo(() => {
    if (granularity !== 'sentence') return [];
    return tokenizeIntoSentences(text);
  }, [granularity, text]);

  if (granularity === 'word' && words.length > 0) {
    return (
      <span className="pacing-text">
        {words.map((word, idx) => {
          const globalIdx = indexOffset + idx;
          const isCurrent = globalIdx === currentIndex;
          const isPast = globalIdx < currentIndex;

          let className = 'pacing-word cursor-pointer';
          if (isCurrent) {
            className += ` pacing-word-active pacing-style-${pacingHighlightStyle}`;
            if (pacingShowGuide) className += ' pacing-word-guide';
          } else if (isPast && pacingDimContext) {
            className += ' pacing-word-past';
          } else if (!isPast && pacingDimContext) {
            className += ' pacing-word-future';
          }

          const space = idx < words.length - 1 ? ' ' : '';
          const orpIndex = findORP(word.text);

          const handleClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            onItemClick(globalIdx);
          };

          if (isCurrent && (pacingShowGuide || pacingBoldFocusLetter)) {
            const beforeORP = word.text.slice(0, orpIndex);
            const orpLetter = word.text[orpIndex] || '';
            const afterORP = word.text.slice(orpIndex + 1);
            const orpPercent = word.text.length > 0 
              ? ((orpIndex + 0.5) / word.text.length) * 100 
              : 50;

            return (
              <span
                key={idx}
                className={className}
                style={{ '--orp-position': `${orpPercent}%` } as React.CSSProperties}
                onClick={handleClick}
              >
                {beforeORP}
                <span className={`pacing-orp-letter ${pacingBoldFocusLetter ? 'pacing-orp-bold' : ''}`}>
                  {orpLetter}
                </span>
                {afterORP}{space}
              </span>
            );
          }

          return (
            <span key={idx} className={className} onClick={handleClick}>
              {word.text}{space}
            </span>
          );
        })}
      </span>
    );
  }

  if (granularity === 'sentence' && sentences.length > 0) {
    return (
      <span className="pacing-text">
        {sentences.map((sentence, idx) => {
          const globalIdx = indexOffset + idx;
          const isCurrent = globalIdx === currentIndex;
          const isPast = globalIdx < currentIndex;

          let className = 'pacing-sentence cursor-pointer';
          if (isCurrent) {
            className += ` pacing-sentence-active pacing-style-${pacingHighlightStyle}`;
          } else if (isPast && pacingDimContext) {
            className += ' pacing-sentence-past';
          } else if (!isPast && pacingDimContext) {
            className += ' pacing-sentence-future';
          }

          const handleClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            onItemClick(globalIdx);
          };

          return (
            <span key={idx} className={className} onClick={handleClick}>
              {sentence.text}{' '}
            </span>
          );
        })}
      </span>
    );
  }

  return <>{text}</>;
}
