/**
 * Archive Grid
 * 
 * Displays archive items in a responsive grid layout.
 */

import type { ArchiveItem } from '@/types';
import ArchiveGridCard from './ArchiveGridCard';

interface ArchiveGridProps {
  items: ArchiveItem[];
  focusedIndex: number;
  selectedItemIds?: Set<string>;
  isSelectionMode?: boolean;
  onItemClick: (item: ArchiveItem) => void;
  onToggleSelection?: (id: string, shiftKey: boolean) => void;
}

export default function ArchiveGrid({
  items,
  focusedIndex,
  selectedItemIds = new Set(),
  isSelectionMode = false,
  onItemClick,
  onToggleSelection,
}: ArchiveGridProps) {
  return (
    <div className="archive-grid" role="list" aria-label="Archive items">
      {items.map((item, index) => (
        <ArchiveGridCard
          key={item.id}
          item={item}
          isFocused={index === focusedIndex}
          isSelected={selectedItemIds.has(item.id)}
          isSelectionMode={isSelectionMode}
          onClick={() => onItemClick(item)}
          onToggleSelection={(shiftKey) => onToggleSelection?.(item.id, shiftKey)}
        />
      ))}
    </div>
  );
}
