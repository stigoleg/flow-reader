/**
 * Context Menu
 * 
 * Right-click menu for archive items.
 */

import { useEffect, useRef } from 'react';
import type { ArchiveItem } from '@/types';

interface ContextMenuProps {
  itemId: string;
  position: { x: number; y: number };
  items: ArchiveItem[];
  onOpen: (item: ArchiveItem) => void;
  onRemove: (id: string) => void;
  onRename: (id: string) => void;
  onClose: () => void;
}

export default function ContextMenu({
  itemId,
  position,
  items,
  onOpen,
  onRemove,
  onRename,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const item = items.find(i => i.id === itemId);
  
  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (!menuRef.current) return;
    
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let x = position.x;
    let y = position.y;
    
    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 8;
    }
    
    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 8;
    }
    
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }, [position]);
  
  if (!item) return null;
  
  const handleCopyLink = () => {
    if (item.url) {
      navigator.clipboard.writeText(item.url);
    }
    onClose();
  };
  
  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="context-menu-item"
        onClick={() => {
          onOpen(item);
          onClose();
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        Open
      </button>
      
      {item.url && (
        <button
          className="context-menu-item"
          onClick={handleCopyLink}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          Copy Source Link
        </button>
      )}
      
      <button
        className="context-menu-item"
        onClick={() => {
          onRename(item.id);
          onClose();
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Rename
      </button>
      
      <div className="context-menu-divider" />
      
      <button
        className="context-menu-item danger"
        onClick={() => {
          onRemove(item.id);
          onClose();
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Remove from History
      </button>
    </div>
  );
}
