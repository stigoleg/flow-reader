import { memo } from 'react';
import type { Block, Annotation } from '@/types';
import type { ModeConfig, BionicConfig, PacingConfig, PositionState, BlockHandlers } from './types';
import type { SearchMatch } from '@/lib/search-utils';
import BionicMode from '../modes/BionicMode';
import PacingContent from './PacingContent';
import ListItemRenderer from './ListItemRenderer';

export interface BlockRendererProps {
  block: Block;
  index: number;
  isActive: boolean;
  mode: ModeConfig;
  bionicConfig: BionicConfig;
  pacingConfig: PacingConfig;
  position: PositionState;
  handlers: BlockHandlers;
  /** Annotations for this document */
  annotations?: Annotation[];
  /** Callback when an annotated word is clicked */
  onAnnotationClick?: (annotation: Annotation) => void;
  /** Search results for highlighting */
  searchResults?: SearchMatch[];
  /** Index of the currently focused search result */
  currentSearchIndex?: number;
}

/**
 * Renders a single block of content (heading, paragraph, list, quote, code).
 * Memoized to prevent re-renders when position changes in other blocks.
 */
export default memo(function BlockRenderer({
  block,
  index,
  isActive,
  mode,
  bionicConfig,
  pacingConfig,
  position,
  handlers,
  annotations = [],
  onAnnotationClick,
  searchResults = [],
  currentSearchIndex = -1,
}: BlockRendererProps) {
  const getDimClass = () => {
    if (!mode.isPacing || !pacingConfig.pacingDimContext) return '';
    return !isActive ? 'opacity-40' : '';
  };

  const renderContent = (text: string) => {
    if (mode.isBionic) {
      return (
        <BionicMode 
          text={text} 
          intensity={bionicConfig.intensity} 
          proportion={bionicConfig.proportion}
          adaptive={bionicConfig.adaptive}
        />
      );
    }

    // Render ALL blocks with PacingContent when in pacing mode (not just active)
    // This ensures consistent word spacing across all paragraphs
    if (mode.isPacing && pacingConfig.granularity !== 'block') {
      return (
        <PacingContent
          text={text}
          granularity={pacingConfig.granularity}
          // Pass -1 as currentIndex for non-active blocks so no word is highlighted
          currentIndex={isActive 
            ? (pacingConfig.granularity === 'word' ? position.wordIndex : position.sentenceIndex)
            : -1
          }
          pacingSettings={pacingConfig}
          onItemClick={pacingConfig.granularity === 'word' ? handlers.onWordClick : handlers.onSentenceClick}
          blockIndex={index}
          annotations={annotations}
          onAnnotationClick={onAnnotationClick}
          searchResults={searchResults}
          currentSearchIndex={currentSearchIndex}
        />
      );
    }

    return text;
  };

  const getBlockActiveStyles = () => {
    if (!isActive) return '';
    if (mode.isPacing && pacingConfig.granularity === 'block') {
      return `pacing-block-active pacing-style-${pacingConfig.highlightStyle} -mx-2 px-2 rounded`;
    }
    if (!mode.isPacing) {
      return 'bg-reader-highlight/20 -mx-2 px-2 rounded';
    }
    return '';
  };

  const dimClass = getDimClass();
  const activeStyles = getBlockActiveStyles();
  const combinedClassName = `cursor-pointer ${activeStyles} ${dimClass}`.trim();

  switch (block.type) {
    case 'heading': {
      const HeadingTag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      return (
        <HeadingTag data-block-index={index} className={combinedClassName} onClick={handlers.onClick}>
          {renderContent(block.content)}
        </HeadingTag>
      );
    }

    case 'paragraph':
      return (
        <p data-block-index={index} className={combinedClassName} onClick={handlers.onClick}>
          {renderContent(block.content)}
        </p>
      );

    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul';
      return (
        <ListTag data-block-index={index} className={combinedClassName} onClick={handlers.onClick}>
          {block.items.map((item, i) => (
            <ListItemRenderer
              key={i}
              item={item}
              itemIndex={i}
              isBlockActive={isActive}
              mode={mode}
              bionicConfig={bionicConfig}
              pacingConfig={pacingConfig}
              position={position}
              allItems={block.items}
              onWordClick={handlers.onWordClick}
              onSentenceClick={handlers.onSentenceClick}
            />
          ))}
        </ListTag>
      );
    }

    case 'quote':
      return (
        <blockquote data-block-index={index} className={combinedClassName} onClick={handlers.onClick}>
          {renderContent(block.content)}
        </blockquote>
      );

    case 'code':
      return (
        <pre data-block-index={index} className={combinedClassName} onClick={handlers.onClick}>
          <code className={block.language ? `language-${block.language}` : ''}>
            {block.content}
          </code>
        </pre>
      );

    default:
      return null;
  }
});
