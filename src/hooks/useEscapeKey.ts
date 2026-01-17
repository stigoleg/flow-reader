/**
 * useEscapeKey Hook
 * 
 * Handles escape key press to close modals, dialogs, or overlays.
 * Automatically cleans up the event listener on unmount.
 */

import { useEffect } from 'react';

/**
 * Hook to handle escape key press.
 * 
 * @param onEscape - Callback to run when Escape is pressed
 * @param enabled - Whether the hook is active (default: true)
 * 
 * @example
 * ```tsx
 * function MyModal({ onClose }: { onClose: () => void }) {
 *   useEscapeKey(onClose);
 *   return <div>Modal content</div>;
 * }
 * ```
 */
export function useEscapeKey(onEscape: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onEscape, enabled]);
}
