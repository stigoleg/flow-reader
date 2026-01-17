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
  onItemClick: (item: ArchiveItem) => void;
  onItemRemove: (id: string) => void;
}

export default function ArchiveList({
  items,
  focusedIndex,
  onItemClick,
  onItemRemove,
}: ArchiveListProps) {
  return (
    <div className="space-y-2" role="list" aria-label="Archive items">
      {items.map((item, index) => (
        <ArchiveItemCard
          key={item.id}
          item={item}
          isFocused={index === focusedIndex}
          onClick={() => onItemClick(item)}
          onRemove={() => onItemRemove(item.id)}
        />
      ))}
    </div>
  );
}
