/**
 * useTextSelection Hook
 * 
 * Detects text selections in the reader and extracts word position information
 * for annotation creation.
 */

import { useState, useEffect, useCallback, RefObject } from 'react';

/** Selection range with position information for annotation creation */
export interface SelectionRange {
  /** Block index where selection starts */
  startBlockIndex: number;
  /** Word index within the starting block */
  startWordIndex: number;
  /** Block index where selection ends */
  endBlockIndex: number;
  /** Word index within the ending block */
  endWordIndex: number;
  /** The selected text content */
  textContent: string;
  /** Bounding rectangle for positioning the toolbar */
  rect: DOMRect;
}

interface UseTextSelectionOptions {
  /** Whether text selection detection is enabled */
  enabled: boolean;
  /** Callback when selection changes (optional) */
  onSelectionChange?: (selection: SelectionRange | null) => void;
}

/**
 * Hook to detect and parse text selections for annotation creation.
 * 
 * Listens for mouseup/touchend events and parses data-word-index and 
 * data-block-index attributes from the selected text.
 */
export function useTextSelection(
  containerRef: RefObject<HTMLElement | null>,
  options: UseTextSelectionOptions
): {
  selection: SelectionRange | null;
  clearSelection: () => void;
} {
  const { enabled, onSelectionChange } = options;
  const [selection, setSelection] = useState<SelectionRange | null>(null);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const parseSelection = useCallback(() => {
    if (!enabled) return;

    const windowSelection = window.getSelection();
    if (!windowSelection || windowSelection.isCollapsed || windowSelection.rangeCount === 0) {
      if (selection !== null) {
        setSelection(null);
        onSelectionChange?.(null);
      }
      return;
    }

    const range = windowSelection.getRangeAt(0);
    const selectedText = windowSelection.toString().trim();
    
    if (!selectedText) {
      if (selection !== null) {
        setSelection(null);
        onSelectionChange?.(null);
      }
      return;
    }

    // Find the word spans at the start and end of the selection
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;

    // Walk up from the text nodes to find elements with data attributes
    const startWordSpan = findWordSpan(startContainer);
    const endWordSpan = findWordSpan(endContainer);

    if (!startWordSpan || !endWordSpan) {
      // Selection doesn't include annotatable content
      if (selection !== null) {
        setSelection(null);
        onSelectionChange?.(null);
      }
      return;
    }

    // Extract word indices
    const startWordIndex = parseInt(startWordSpan.getAttribute('data-word-index') || '-1', 10);
    const endWordIndex = parseInt(endWordSpan.getAttribute('data-word-index') || '-1', 10);

    if (startWordIndex === -1 || endWordIndex === -1) {
      if (selection !== null) {
        setSelection(null);
        onSelectionChange?.(null);
      }
      return;
    }

    // Find block indices by walking up to find data-block-index
    const startBlock = findBlockElement(startWordSpan);
    const endBlock = findBlockElement(endWordSpan);

    const startBlockIndex = startBlock 
      ? parseInt(startBlock.getAttribute('data-block-index') || '-1', 10)
      : -1;
    const endBlockIndex = endBlock
      ? parseInt(endBlock.getAttribute('data-block-index') || '-1', 10)
      : -1;

    if (startBlockIndex === -1 || endBlockIndex === -1) {
      if (selection !== null) {
        setSelection(null);
        onSelectionChange?.(null);
      }
      return;
    }

    // Get the bounding rectangle for toolbar positioning
    const rect = range.getBoundingClientRect();

    const newSelection: SelectionRange = {
      startBlockIndex,
      startWordIndex,
      endBlockIndex,
      endWordIndex,
      textContent: selectedText,
      rect,
    };

    setSelection(newSelection);
    onSelectionChange?.(newSelection);
  }, [enabled, selection, onSelectionChange]);

  useEffect(() => {
    if (!enabled) {
      if (selection !== null) {
        setSelection(null);
      }
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const handleSelectionEnd = () => {
      // Small delay to let the selection settle
      setTimeout(parseSelection, 10);
    };

    // Listen for selection changes
    container.addEventListener('mouseup', handleSelectionEnd);
    container.addEventListener('touchend', handleSelectionEnd);

    // Also listen for selection changes (keyboard selection)
    document.addEventListener('selectionchange', parseSelection);

    return () => {
      container.removeEventListener('mouseup', handleSelectionEnd);
      container.removeEventListener('touchend', handleSelectionEnd);
      document.removeEventListener('selectionchange', parseSelection);
    };
  }, [enabled, containerRef, parseSelection, selection]);

  return { selection, clearSelection };
}

/**
 * Find the nearest word span element from a text node.
 */
function findWordSpan(node: Node): HTMLElement | null {
  let current: Node | null = node;
  
  while (current && current !== document.body) {
    if (current instanceof HTMLElement) {
      // Check if this element or an ancestor has data-word-index
      if (current.hasAttribute('data-word-index')) {
        return current;
      }
      // Also check parent if we're inside the word span's children (ORP spans)
      const parent = current.parentElement;
      if (parent?.hasAttribute('data-word-index')) {
        return parent;
      }
    }
    current = current.parentNode;
  }
  
  return null;
}

/**
 * Find the block element containing this element.
 */
function findBlockElement(element: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element;
  
  while (current && current !== document.body) {
    if (current.hasAttribute('data-block-index')) {
      return current;
    }
    current = current.parentElement;
  }
  
  return null;
}
