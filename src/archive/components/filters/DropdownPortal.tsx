/**
 * DropdownPortal
 * 
 * A portal-based dropdown menu that renders above all content.
 * Handles positioning, focus management, and close behavior.
 */

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DropdownPortalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

interface Position {
  top: number;
  left: number;
  maxHeight: number;
}

export default function DropdownPortal({
  isOpen,
  onClose,
  triggerRef,
  children,
  align = 'left',
  className = '',
}: DropdownPortalProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0, maxHeight: 300 });

  // Calculate position based on trigger element
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const menuWidth = 200; // Estimated menu width
    const padding = 16;

    // Calculate vertical position
    const spaceBelow = viewportHeight - rect.bottom - padding;
    const spaceAbove = rect.top - padding;
    const preferBelow = spaceBelow >= 200 || spaceBelow >= spaceAbove;

    let top: number;
    let maxHeight: number;

    if (preferBelow) {
      top = rect.bottom + 4;
      maxHeight = Math.min(spaceBelow - 4, 400);
    } else {
      maxHeight = Math.min(spaceAbove - 4, 400);
      top = rect.top - maxHeight - 4;
    }

    // Calculate horizontal position
    let left: number;
    if (align === 'right') {
      left = Math.max(padding, rect.right - menuWidth);
    } else {
      left = rect.left;
    }

    // Ensure menu doesn't go off right edge
    if (left + menuWidth > viewportWidth - padding) {
      left = viewportWidth - menuWidth - padding;
    }

    // Ensure menu doesn't go off left edge
    if (left < padding) {
      left = padding;
    }

    setPosition({ top, left, maxHeight });
  }, [triggerRef, align]);

  // Update position on open and resize
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, updatePosition]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose();
      }
    };

    // Use mousedown for immediate response
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, triggerRef]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, triggerRef]);

  // Focus first focusable element when opened
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const focusable = menuRef.current.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    // Small delay to ensure DOM is ready
    requestAnimationFrame(() => {
      focusable?.focus();
    });
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={menuRef}
      className={`dropdown-portal ${className}`}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        maxHeight: position.maxHeight,
        zIndex: 9999,
      }}
      role="listbox"
    >
      {children}
    </div>,
    document.body
  );
}
