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
          
          // Always calculate ORP for consistent DOM structure
          const orpIndex = findORP(word.text);
          const beforeORP = word.text.slice(0, orpIndex);
          const orpLetter = word.text[orpIndex] || '';
          const afterORP = word.text.slice(orpIndex + 1);
          
          // Calculate ORP position for guide indicator
          const orpPercent = word.text.length > 0 
            ? ((orpIndex + 0.5) / word.text.length) * 100 
            : 50;

          const handleClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            onItemClick(globalIdx);
          };

          // Determine if ORP letter should be styled
          // Only apply bold styling when this word is current and pacingBoldFocusLetter is enabled
          const orpLetterClass = isCurrent && pacingBoldFocusLetter 
            ? 'pacing-orp-letter pacing-orp-bold' 
            : 'pacing-orp-letter';

          // Always render with consistent 3-span structure to prevent layout shifts
          // The structure is: beforeORP + orpLetter + afterORP
          // This ensures DOM consistency whether word is active or not
          return (
            <span
              key={idx}
              className={className}
              style={{ '--orp-position': `${orpPercent}%` } as React.CSSProperties}
              onClick={handleClick}
            >
              <span className="pacing-word-before">{beforeORP}</span>
              <span className={orpLetterClass}>{orpLetter}</span>
              <span className="pacing-word-after">{afterORP}</span>
              {space}
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
