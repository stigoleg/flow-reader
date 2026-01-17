/**
 * Archive Item Card
 * 
 * Individual item in the archive list.
 */

import { useCallback } from 'react';
import type { ArchiveItem } from '@/types';
import { formatRelativeTime, getTypeBadgeLabel } from '@/lib/recents-service';
import { useArchiveStore, getItemSyncStatus } from '../store';

interface ArchiveItemCardProps {
  item: ArchiveItem;
  isFocused: boolean;
  onClick: () => void;
  onRemove: () => void;
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

export default function ArchiveItemCard({
  item,
  isFocused,
  onClick,
  onRemove,
}: ArchiveItemCardProps) {
  const showContextMenu = useArchiveStore(state => state.showContextMenu);
  const syncEnabled = useArchiveStore(state => state.syncEnabled);
  
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
  
  // Get sync status for this item (only relevant when sync is enabled)
  const syncStatus = syncEnabled ? getItemSyncStatus(item) : null;
  
  return (
    <div
      className={`archive-item ${isFocused ? 'focused' : ''}`}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      role="listitem"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Icon */}
      <div className="archive-item-icon" style={{ color: 'var(--reader-link)' }}>
        {getTypeIcon(item.type)}
      </div>
      
      {/* Content */}
      <div className="archive-item-content">
        <h3 className="archive-item-title">{item.title}</h3>
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
}
