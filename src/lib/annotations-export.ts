/**
 * Annotations Export Service
 * 
 * Provides functions to format and export annotations in various formats.
 */

import type { Annotation } from '@/types';

/**
 * Format a single annotation for clipboard copy.
 * Returns the highlighted text and note (if present).
 */
export function formatAnnotationForCopy(annotation: Annotation): string {
  const lines: string[] = [];
  
  // Add the highlighted text with quotes
  lines.push(`"${annotation.anchor.textContent}"`);
  
  // Add note if present
  if (annotation.note && annotation.note.trim()) {
    lines.push(`Note: ${annotation.note.trim()}`);
  }
  
  return lines.join('\n');
}

/**
 * Export annotations as Markdown format.
 */
export function exportAnnotationsAsMarkdown(
  annotations: Annotation[],
  documentTitle: string
): string {
  const lines: string[] = [];
  
  // Title
  lines.push(`# Highlights from "${documentTitle}"`);
  lines.push('');
  
  // Sort annotations by position
  const sorted = sortAnnotationsByPosition(annotations);
  
  sorted.forEach((annotation, index) => {
    // Highlight header
    lines.push(`## Highlight ${index + 1}`);
    
    // Quoted text
    lines.push(`> "${annotation.anchor.textContent}"`);
    lines.push('');
    
    // Note if present
    if (annotation.note && annotation.note.trim()) {
      lines.push(`**Note:** ${annotation.note.trim()}`);
      lines.push('');
    }
    
    // Separator (except for last item)
    if (index < sorted.length - 1) {
      lines.push('---');
      lines.push('');
    }
  });
  
  return lines.join('\n');
}

/**
 * Export annotations as plain text format.
 */
export function exportAnnotationsAsText(
  annotations: Annotation[],
  documentTitle: string
): string {
  const lines: string[] = [];
  
  // Title
  lines.push(`Highlights from "${documentTitle}"`);
  lines.push('');
  
  // Sort annotations by position
  const sorted = sortAnnotationsByPosition(annotations);
  
  sorted.forEach((annotation, index) => {
    lines.push('---');
    lines.push('');
    
    // Quoted text
    lines.push(`"${annotation.anchor.textContent}"`);
    
    // Note if present
    if (annotation.note && annotation.note.trim()) {
      lines.push(`Note: ${annotation.note.trim()}`);
    }
    
    // Extra spacing between items
    if (index < sorted.length - 1) {
      lines.push('');
    }
  });
  
  return lines.join('\n');
}

/**
 * Export annotations as JSON format.
 */
export function exportAnnotationsAsJson(
  annotations: Annotation[],
  documentTitle: string
): string {
  // Sort annotations by position
  const sorted = sortAnnotationsByPosition(annotations);
  
  const exportData = {
    documentTitle,
    exportedAt: new Date().toISOString(),
    annotations: sorted.map(annotation => ({
      text: annotation.anchor.textContent,
      note: annotation.note || null,
      color: annotation.color,
      createdAt: new Date(annotation.createdAt).toISOString(),
    })),
  };
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Copy text to clipboard.
 * Returns true if successful, false otherwise.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Sort annotations by their position in the document.
 */
function sortAnnotationsByPosition(annotations: Annotation[]): Annotation[] {
  return [...annotations].sort((a, b) => {
    // First compare by block ID (numerically if possible)
    const blockA = parseInt(a.anchor.blockId, 10) || 0;
    const blockB = parseInt(b.anchor.blockId, 10) || 0;
    if (blockA !== blockB) return blockA - blockB;
    
    // Then by start word index
    return a.anchor.startWordIndex - b.anchor.startWordIndex;
  });
}

export type ExportFormat = 'markdown' | 'text' | 'json';

/**
 * Export annotations in the specified format.
 */
export function exportAnnotations(
  annotations: Annotation[],
  documentTitle: string,
  format: ExportFormat
): string {
  switch (format) {
    case 'markdown':
      return exportAnnotationsAsMarkdown(annotations, documentTitle);
    case 'text':
      return exportAnnotationsAsText(annotations, documentTitle);
    case 'json':
      return exportAnnotationsAsJson(annotations, documentTitle);
    default:
      return exportAnnotationsAsMarkdown(annotations, documentTitle);
  }
}
