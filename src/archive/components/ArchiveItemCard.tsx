/**
 * Archive Item Card
 * 
 * Individual item in the archive list.
 */

import { useCallback, useRef, useEffect, useState, memo } from 'react';
import type { ArchiveItem } from '@/types';
import { formatRelativeTime, getTypeBadgeLabel } from '@/lib/recents-service';
import { useArchiveStore, getItemSyncStatus } from '../store';
import { getDocumentKeyFromArchiveItem, getAnnotationCount } from '@/lib/annotations-service';

interface ArchiveItemCardProps {
  item: ArchiveItem;
  isFocused: boolean;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onClick: () => void;
  onRemove: () => void;
  onToggleSelection?: (shiftKey: boolean) => void;
  onViewNotes?: (item: ArchiveItem) => void;
}

function getTypeIcon(type: ArchiveItem['type']) {
  switch (type) {
    case 'web':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
        </svg>
      );
    case 'pdf':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    case 'docx':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'epub':
    case 'mobi':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case 'paste':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
  }
}

export default memo(function ArchiveItemCard({
  item,
  isFocused,
  isSelected = false,
  isSelectionMode = false,
  onClick,
  onRemove,
  onToggleSelection,
  onViewNotes,
}: ArchiveItemCardProps) {
  const showContextMenu = useArchiveStore(state => state.showContextMenu);
  const syncEnabled = useArchiveStore(state => state.syncEnabled);
  const collections = useArchiveStore(state => state.collections);
  const renamingItemId = useArchiveStore(state => state.renamingItemId);
  const finishRenaming = useArchiveStore(state => state.finishRenaming);
  const cancelRenaming = useArchiveStore(state => state.cancelRenaming);
  
  const isRenaming = renamingItemId === item.id;
  const [editValue, setEditValue] = useState(item.title);
  const [annotationCount, setAnnotationCount] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Get collections for this item
  const itemCollections = item.collectionIds 
    ? collections.filter(c => item.collectionIds!.includes(c.id))
    : [];
  
  // Focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);
  
  // Reset edit value when item changes
  useEffect(() => {
    setEditValue(item.title);
  }, [item.title]);
  
  // Load annotation count for this item
  useEffect(() => {
    const documentKey = getDocumentKeyFromArchiveItem(item);
    if (documentKey) {
      getAnnotationCount(documentKey).then(setAnnotationCount);
    } else {
      setAnnotationCount(0);
    }
  }, [item]);
  
  const handleViewNotes = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onViewNotes?.(item);
  }, [item, onViewNotes]);
  
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    showContextMenu(item.id, { x: e.clientX, y: e.clientY });
  }, [item.id, showContextMenu]);
  
  const handleContinueClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  }, [onClick]);
  
  const handleRemoveClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  }, [onRemove]);
  
  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation(); // Prevent parent from opening the file
      finishRenaming(editValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelRenaming();
      setEditValue(item.title);
    }
  }, [editValue, finishRenaming, cancelRenaming, item.title]);
  
  const handleRenameBlur = useCallback(() => {
    finishRenaming(editValue);
  }, [editValue, finishRenaming]);
  
  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelection?.(e.shiftKey);
  }, [onToggleSelection]);
  
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // In selection mode, clicking the card toggles selection
    if (isSelectionMode) {
      onToggleSelection?.(e.shiftKey);
    } else {
      onClick();
    }
  }, [isSelectionMode, onToggleSelection, onClick]);
  
  // Get sync status for this item (only relevant when sync is enabled)
  const syncStatus = syncEnabled ? getItemSyncStatus(item) : null;
  
  return (
    <div
      className={`archive-item ${isFocused ? 'focused' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={handleCardClick}
      onContextMenu={handleContextMenu}
      role="listitem"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (isSelectionMode) {
            onToggleSelection?.(e.shiftKey);
          } else {
            onClick();
          }
        }
      }}
    >
      {/* Selection Checkbox */}
      <div 
        className={`selection-checkbox ${isSelected ? 'checked' : ''} ${isSelectionMode ? 'visible' : ''}`}
        onClick={handleCheckboxClick}
        role="checkbox"
        aria-checked={isSelected}
        tabIndex={-1}
      >
        {isSelected && (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
          </svg>
        )}
      </div>
      
      {/* Icon */}
      <div className="archive-item-icon" style={{ color: 'var(--reader-link)' }}>
        {getTypeIcon(item.type)}
      </div>
      
      {/* Content */}
      <div className="archive-item-content">
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            className="archive-item-title-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameBlur}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <h3 className="archive-item-title">{item.title}</h3>
        )}
        <div className="archive-item-meta">
          <span className="archive-item-source">{item.sourceLabel}</span>
          <span className="opacity-50">•</span>
          <span className="archive-item-badge">{getTypeBadgeLabel(item.type)}</span>
          <span className="opacity-50">•</span>
          <span>{formatRelativeTime(item.lastOpenedAt)}</span>
          {item.progress && (
            <>
              <span className="opacity-50">•</span>
              <span style={{ color: 'var(--reader-link)' }}>{item.progress.label}</span>
            </>
          )}
          {annotationCount > 0 && (
            <button
              onClick={handleViewNotes}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs hover:bg-reader-text/10 transition-colors"
              style={{ color: 'var(--reader-link)' }}
              title={`${annotationCount} note${annotationCount !== 1 ? 's' : ''} - Click to view`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              {annotationCount}
            </button>
          )}
          {syncStatus && syncStatus !== 'not-applicable' && (
            <>
              <span className="opacity-50">•</span>
              <span 
                className={`sync-status-indicator ${syncStatus}`}
                title={syncStatus === 'synced' ? 'Synced across devices' : 'Not yet synced'}
              >
                {syncStatus === 'synced' ? (
                  <svg className="w-3.5 h-3.5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                )}
              </span>
            </>
          )}
        </div>
        {item.author && (
          <p className="text-sm opacity-60 mt-0.5">{item.author}</p>
        )}
        {itemCollections.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {itemCollections.map(collection => (
              <span 
                key={collection.id} 
                className="collection-badge"
                title={collection.name}
              >
                {collection.icon && (
                  <span className="collection-badge-icon">{collection.icon}</span>
                )}
                <span>{collection.name}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="archive-item-actions">
        <button
          onClick={handleRemoveClick}
          className="p-2 rounded opacity-40 hover:opacity-100 transition-opacity"
          aria-label="Remove from history"
          title="Remove from history"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <button
          onClick={handleContinueClick}
          className="archive-item-continue"
        >
          Continue
        </button>
      </div>
    </div>
  );
});
