/**
 * Archive Grid Card
 * 
 * Individual item card for grid view - more visual, thumbnail-focused.
 */

import { memo, useState, useEffect } from 'react';
import type { ArchiveItem } from '@/types';
import { formatRelativeTime } from '@/lib/recents-service';
import { useArchiveStore } from '../store';
import { getDocumentKeyFromArchiveItem, getAnnotationCount } from '@/lib/annotations-service';

interface ArchiveGridCardProps {
  item: ArchiveItem;
  isFocused: boolean;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onClick: () => void;
  onToggleSelection?: (shiftKey: boolean) => void;
}

function getTypeGradient(type: ArchiveItem['type']) {
  switch (type) {
    case 'web':
      return 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
    case 'pdf':
      return 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)';
    case 'docx':
      return 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)';
    case 'epub':
    case 'mobi':
      return 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)';
    case 'paste':
      return 'linear-gradient(135deg, #6b7280 0%, #374151 100%)';
    default:
      return 'linear-gradient(135deg, #6b7280 0%, #374151 100%)';
  }
}

function getTypeIcon(type: ArchiveItem['type']) {
  switch (type) {
    case 'web':
      return (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
        </svg>
      );
    case 'pdf':
      return (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    case 'docx':
      return (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'epub':
    case 'mobi':
      return (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case 'paste':
      return (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      );
    default:
      return (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
  }
}

export default memo(function ArchiveGridCard({
  item,
  isFocused,
  isSelected = false,
  isSelectionMode = false,
  onClick,
  onToggleSelection,
}: ArchiveGridCardProps) {
  const collections = useArchiveStore(state => state.collections);
  const showContextMenu = useArchiveStore(state => state.showContextMenu);
  const [annotationCount, setAnnotationCount] = useState<number>(0);
  
  // Get collections for this item
  const itemCollections = item.collectionIds 
    ? collections.filter(c => item.collectionIds!.includes(c.id))
    : [];

  // Load annotation count
  useEffect(() => {
    const docKey = getDocumentKeyFromArchiveItem(item);
    if (docKey) {
      getAnnotationCount(docKey).then(setAnnotationCount).catch(() => {});
    }
  }, [item]);

  const handleClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || isSelectionMode) {
      e.preventDefault();
      onToggleSelection?.(e.shiftKey);
    } else {
      onClick();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    showContextMenu(item.id, { x: e.clientX, y: e.clientY });
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelection?.(e.shiftKey);
  };

  const progress = item.progress?.percent ?? 0;

  return (
    <div
      className={`archive-grid-card ${isFocused ? 'focused' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
    >
      {/* Selection Checkbox */}
      <div 
        className={`archive-grid-card-checkbox ${isSelected ? 'checked' : ''} ${isSelectionMode ? 'visible' : ''}`}
        onClick={handleCheckboxClick}
        role="checkbox"
        aria-checked={isSelected}
      >
        {isSelected && (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
          </svg>
        )}
      </div>

      {/* Cover / Thumbnail Area */}
      <div 
        className="archive-grid-card-cover"
        style={{ 
          background: item.thumbnail ? `url(${item.thumbnail}) center/cover` : getTypeGradient(item.type)
        }}
      >
        {!item.thumbnail && (
          <div className="archive-grid-card-icon">
            {getTypeIcon(item.type)}
          </div>
        )}
        
        {/* Progress bar at bottom of cover */}
        {progress > 0 && (
          <div className="archive-grid-card-progress">
            <div 
              className="archive-grid-card-progress-bar" 
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        
        {/* Annotation count badge */}
        {annotationCount > 0 && (
          <div className="archive-grid-card-notes-badge">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            {annotationCount}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="archive-grid-card-content">
        <h3 className="archive-grid-card-title" title={item.title}>
          {item.title}
        </h3>
        {item.author && (
          <p className="archive-grid-card-author">{item.author}</p>
        )}
        <p className="archive-grid-card-meta">
          {item.sourceLabel} • {formatRelativeTime(item.lastOpenedAt)}
        </p>
        
        {/* Collection badges */}
        {itemCollections.length > 0 && (
          <div className="archive-grid-card-collections">
            {itemCollections.slice(0, 2).map(collection => (
              <span 
                key={collection.id}
                className="archive-grid-card-collection-dot"
                style={{ backgroundColor: collection.color || 'var(--reader-link)' }}
                title={collection.name}
              />
            ))}
            {itemCollections.length > 2 && (
              <span className="archive-grid-card-collection-more">
                +{itemCollections.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
