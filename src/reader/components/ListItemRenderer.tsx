import { memo, useMemo } from 'react';
import { tokenizeIntoSentences, tokenizeIntoWords } from '@/lib/tokenizer';
import type { ModeConfig, BionicConfig, PacingConfig, PositionState } from './types';
import BionicMode from '../modes/BionicMode';
import PacingContent from './PacingContent';

interface ListItemRendererProps {
  item: string;
  itemIndex: number;
  isBlockActive: boolean;
  mode: ModeConfig;
  bionicConfig: BionicConfig;
  pacingConfig: PacingConfig;
  position: PositionState;
  allItems: string[];
  onWordClick: (wordIndex: number) => void;
  onSentenceClick: (sentenceIndex: number) => void;
}

/**
 * Renders a single list item with mode-specific formatting.
 * Memoized to prevent re-renders when position changes in other list items.
 */
export default memo(function ListItemRenderer({
  item,
  itemIndex,
  isBlockActive,
  mode,
  bionicConfig,
  pacingConfig,
  position,
  allItems,
  onWordClick,
  onSentenceClick,
}: ListItemRendererProps) {
  const wordOffset = useMemo(() => {
    let offset = 0;
    for (let i = 0; i < itemIndex; i++) {
      offset += tokenizeIntoWords(allItems[i]).length;
    }
    return offset;
  }, [itemIndex, allItems]);

  const sentenceOffset = useMemo(() => {
    if (pacingConfig.granularity !== 'sentence') return 0;
    let offset = 0;
    for (let i = 0; i < itemIndex; i++) {
      offset += tokenizeIntoSentences(allItems[i]).length;
    }
    return offset;
  }, [itemIndex, allItems, pacingConfig.granularity]);

  if (mode.isBionic) {
    return (
      <li>
        <BionicMode text={item} intensity={bionicConfig.intensity} proportion={bionicConfig.proportion} />
      </li>
    );
  }

  // Render ALL list items with PacingContent when in pacing mode (not just active block)
  // This ensures consistent word spacing across all items
  if (mode.isPacing && pacingConfig.granularity !== 'block') {
    return (
      <li>
        <PacingContent
          text={item}
          granularity={pacingConfig.granularity}
          // Pass -1 as currentIndex for non-active blocks so no word is highlighted
          currentIndex={isBlockActive 
            ? (pacingConfig.granularity === 'word' ? position.wordIndex : position.sentenceIndex)
            : -1
          }
          indexOffset={pacingConfig.granularity === 'word' ? wordOffset : sentenceOffset}
          pacingSettings={pacingConfig}
          onItemClick={pacingConfig.granularity === 'word' ? onWordClick : onSentenceClick}
        />
      </li>
    );
  }

  return <li>{item}</li>;
});
