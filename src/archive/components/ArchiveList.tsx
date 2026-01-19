/**
 * Archive List
 * 
 * Displays the list of archive items.
 */

import type { ArchiveItem } from '@/types';
import ArchiveItemCard from './ArchiveItemCard';

interface ArchiveListProps {
  items: ArchiveItem[];
  focusedIndex: number;
  selectedItemIds?: Set<string>;
  isSelectionMode?: boolean;
  onItemClick: (item: ArchiveItem) => void;
  onItemRemove: (id: string) => void;
  onToggleSelection?: (id: string, shiftKey: boolean) => void;
  onViewNotes?: (item: ArchiveItem) => void;
}

export default function ArchiveList({
  items,
  focusedIndex,
  selectedItemIds = new Set(),
  isSelectionMode = false,
  onItemClick,
  onItemRemove,
  onToggleSelection,
  onViewNotes,
}: ArchiveListProps) {
  return (
    <div className="space-y-2" role="list" aria-label="Archive items">
      {items.map((item, index) => (
        <ArchiveItemCard
          key={item.id}
          item={item}
          isFocused={index === focusedIndex}
          isSelected={selectedItemIds.has(item.id)}
          isSelectionMode={isSelectionMode}
          onClick={() => onItemClick(item)}
          onRemove={() => onItemRemove(item.id)}
          onToggleSelection={(shiftKey) => onToggleSelection?.(item.id, shiftKey)}
          onViewNotes={onViewNotes}
        />
      ))}
    </div>
  );
}
