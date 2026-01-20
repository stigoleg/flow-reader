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
 * Export annotations as HTML format with styled highlight colors.
 */
export function exportAnnotationsAsHtml(
  annotations: Annotation[],
  documentTitle: string
): string {
  const sorted = sortAnnotationsByPosition(annotations);
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  
  const highlightsHtml = sorted.map((annotation, index) => {
    const noteHtml = annotation.note?.trim()
      ? `<p class="note">${escapeHtml(annotation.note.trim())}</p>`
      : '';
    const starHtml = annotation.isFavorite
      ? '<span class="star" title="Favorite">★</span>'
      : '';
    
    return `
    <div class="highlight${annotation.isFavorite ? ' favorite' : ''}">
      <div class="highlight-number">${index + 1}${starHtml}</div>
      <blockquote style="background-color: ${annotation.color}40; border-left-color: ${annotation.color};">
        "${escapeHtml(annotation.anchor.textContent)}"
      </blockquote>
      ${noteHtml}
      <div class="meta">${formatDate(annotation.createdAt)}</div>
    </div>`;
  }).join('\n');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Highlights from "${escapeHtml(documentTitle)}"</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      max-width: 700px;
      margin: 0 auto;
      padding: 2rem;
      background: #fafafa;
      color: #333;
      line-height: 1.6;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
      color: #1a1a1a;
    }
    .subtitle {
      color: #666;
      font-size: 0.9rem;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e0e0e0;
    }
    .highlight {
      margin-bottom: 1.5rem;
      position: relative;
    }
    .highlight-number {
      position: absolute;
      left: -2rem;
      top: 0.5rem;
      font-size: 0.75rem;
      color: #999;
    }
    blockquote {
      margin: 0;
      padding: 0.75rem 1rem;
      border-left: 4px solid;
      border-radius: 0 4px 4px 0;
      font-style: italic;
    }
    .note {
      margin: 0.5rem 0 0 1rem;
      padding-left: 0.75rem;
      border-left: 2px solid #ddd;
      color: #555;
      font-size: 0.95rem;
    }
    .meta {
      font-size: 0.75rem;
      color: #999;
      margin-top: 0.5rem;
      margin-left: 1rem;
    }
    .star {
      color: #f59e0b;
      margin-left: 0.25rem;
    }
    .highlight.favorite {
      background: linear-gradient(90deg, #fef3c720 0%, transparent 100%);
      padding-left: 0.5rem;
      margin-left: -0.5rem;
      border-radius: 4px;
    }
    @media print {
      body { background: white; padding: 1rem; }
      .highlight { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Highlights from "${escapeHtml(documentTitle)}"</h1>
  <p class="subtitle">${sorted.length} highlight${sorted.length !== 1 ? 's' : ''} · Exported ${formatDate(Date.now())}</p>
  ${highlightsHtml}
</body>
</html>`;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
      isFavorite: annotation.isFavorite || false,
      tags: annotation.tags || [],
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
 * Download content as a file.
 * Creates a temporary download link and triggers the download.
 */
export function downloadAsFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the object URL
  URL.revokeObjectURL(url);
}

/**
 * Get the file extension and mime type for an export format.
 */
export function getFileInfoForFormat(format: ExportFormat): { extension: string; mimeType: string } {
  switch (format) {
    case 'markdown':
      return { extension: 'md', mimeType: 'text/markdown' };
    case 'text':
      return { extension: 'txt', mimeType: 'text/plain' };
    case 'json':
      return { extension: 'json', mimeType: 'application/json' };
    case 'html':
      return { extension: 'html', mimeType: 'text/html' };
    default:
      return { extension: 'txt', mimeType: 'text/plain' };
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

export type ExportFormat = 'markdown' | 'text' | 'json' | 'html';

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
    case 'html':
      return exportAnnotationsAsHtml(annotations, documentTitle);
    default:
      return exportAnnotationsAsMarkdown(annotations, documentTitle);
  }
}

// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================

/**
 * Exported annotation data structure (from JSON export).
 */
export interface AnnotationsExportData {
  documentTitle: string;
  exportedAt: string;
  annotations: Array<{
    text: string;
    note: string | null;
    color: string;
    isFavorite?: boolean;
    tags?: string[];
    createdAt: string;
  }>;
}

/**
 * Parse annotations from a JSON string.
 * Returns null if the JSON is invalid or doesn't match expected structure.
 */
export function parseAnnotationsFromJson(jsonString: string): AnnotationsExportData | null {
  try {
    const data = JSON.parse(jsonString);
    
    // Validate structure
    if (!data || typeof data !== 'object') return null;
    if (typeof data.documentTitle !== 'string') return null;
    if (!Array.isArray(data.annotations)) return null;
    
    // Validate each annotation has required fields
    for (const ann of data.annotations) {
      if (typeof ann.text !== 'string') return null;
      if (typeof ann.color !== 'string') return null;
      if (typeof ann.createdAt !== 'string') return null;
    }
    
    return data as AnnotationsExportData;
  } catch {
    return null;
  }
}

/**
 * Result of an import operation.
 */
export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Prompt user to select a JSON file for import.
 * Returns the parsed data or null if cancelled/invalid.
 */
export function promptImportFile(): Promise<{ data: AnnotationsExportData; filename: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      
      try {
        const text = await file.text();
        const data = parseAnnotationsFromJson(text);
        if (data) {
          resolve({ data, filename: file.name });
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    
    input.oncancel = () => resolve(null);
    input.click();
  });
}
