import type { FlowDocument, Block, HeadingBlock, ParagraphBlock, ListBlock } from '@/types';
import { createDocument } from './block-utils';
import { computeFileHash } from './file-utils';

// Constants for structure detection
const HEADING_FONT_RATIO_THRESHOLD = 1.15; // Font must be 15% larger than body to be a heading
const BULLET_PATTERNS = /^[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB\u25A0\u25A1\u2013\u2014•◦‣⁃-]\s+/;
const NUMBERED_PATTERN = /^(\d+[\.\):]|\([a-z\d]+\)|[a-z][\.\)])\s+/i;

// PDF.js types
interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNum: number): Promise<PDFPageProxy>;
}

interface PDFPageProxy {
  getTextContent(): Promise<TextContent>;
}

interface TextContent {
  items: TextItem[];
}

interface TextItem {
  str: string;
  hasEOL?: boolean;
  height?: number;           // Font size (height of text)
  transform?: number[];      // Transformation matrix [scaleX, skewX, skewY, scaleY, x, y]
  fontName?: string;         // Font identifier
}

/** Represents a line of text with metadata for structure detection */
interface TextLine {
  text: string;
  fontSize: number;
  isBold: boolean;
  isNumberedListItem: boolean;
  isBulletListItem: boolean;
  isEmptyLine: boolean;  // Track paragraph breaks
}

/** Specific error types for PDF extraction failures */
export type PdfErrorType = 
  | 'no-text-layer'      // Scanned PDF without OCR
  | 'corrupted'          // Invalid or damaged PDF
  | 'password-protected' // PDF requires password
  | 'empty'              // PDF has no pages
  | 'unknown';           // Other errors

export class PdfExtractionError extends Error {
  constructor(
    message: string,
    public readonly type: PdfErrorType,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'PdfExtractionError';
  }
}

/**
 * Extract text content from a PDF file
 */
export async function extractFromPdf(file: File): Promise<FlowDocument> {
  // Dynamically import PDF.js
  let pdfjsLib;
  try {
    pdfjsLib = await import('pdfjs-dist');
  } catch (error) {
    throw new PdfExtractionError(
      'Failed to load PDF processing library.',
      'unknown',
      error
    );
  }

  // Set worker source - use local bundled worker to avoid CSP issues
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');

  let pdf: PDFDocumentProxy;
  try {
    const arrayBuffer = await file.arrayBuffer();
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise as PDFDocumentProxy;
  } catch (error) {
    // Check for specific PDF.js error types
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('password')) {
      throw new PdfExtractionError(
        'This PDF is password-protected. Please provide an unprotected version.',
        'password-protected',
        error
      );
    }
    
    if (errorMessage.includes('Invalid PDF') || errorMessage.includes('corrupted')) {
      throw new PdfExtractionError(
        'This PDF appears to be corrupted or invalid.',
        'corrupted',
        error
      );
    }
    
    throw new PdfExtractionError(
      'Failed to open PDF file: ' + errorMessage,
      'unknown',
      error
    );
  }

  if (pdf.numPages === 0) {
    throw new PdfExtractionError(
      'This PDF has no pages.',
      'empty'
    );
  }

  // Collect all text items with their font info
  const allTextLines: TextLine[] = [];

  // Extract text from each page with font metadata
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    let currentLine = '';
    let currentFontSize = 0;
    let currentFontName = '';
    let itemCount = 0;

    for (const item of textContent.items) {
      const textItem = item as TextItem;
      const text = textItem.str;
      
      // Get font size from height or transform matrix
      const fontSize = textItem.height ?? 
        (textItem.transform ? Math.abs(textItem.transform[3]) : 12);
      const fontName = textItem.fontName ?? '';

      // Accumulate font size weighted by text length for averaging
      if (itemCount === 0 || currentFontSize === 0) {
        currentFontSize = fontSize;
        currentFontName = fontName;
      }
      
      currentLine += text;
      itemCount++;

      // End of line - save it
      if (textItem.hasEOL) {
        const trimmedLine = currentLine.trim();
        // Track both content lines and empty lines (for paragraph breaks)
        allTextLines.push({
          text: trimmedLine,
          fontSize: currentFontSize,
          isBold: fontName.toLowerCase().includes('bold'),
          isBulletListItem: trimmedLine.length > 0 && BULLET_PATTERNS.test(trimmedLine),
          isNumberedListItem: trimmedLine.length > 0 && NUMBERED_PATTERN.test(trimmedLine),
          isEmptyLine: trimmedLine.length === 0,
        });
        currentLine = '';
        currentFontSize = 0;
        currentFontName = '';
        itemCount = 0;
      }
    }

    // Don't forget the last line if it didn't end with EOL
    const trimmedLine = currentLine.trim();
    if (trimmedLine.length > 0) {
      allTextLines.push({
        text: trimmedLine,
        fontSize: currentFontSize,
        isBold: currentFontName.toLowerCase().includes('bold'),
        isBulletListItem: BULLET_PATTERNS.test(trimmedLine),
        isNumberedListItem: NUMBERED_PATTERN.test(trimmedLine),
        isEmptyLine: false,
      });
    }
  }

  // Check if we got any text (filter out empty lines for this check)
  if (allTextLines.filter(l => !l.isEmptyLine).length === 0) {
    throw new PdfExtractionError(
      'No text could be extracted from this PDF. ' +
      'This may be a scanned document without a text layer. ' +
      'OCR support is not available in this version.',
      'no-text-layer'
    );
  }

  // Analyze font sizes to determine structure
  const blocks = analyzeAndCreateBlocks(allTextLines);

  const fileHash = await computeFileHash(file);

  return createDocument(blocks, {
    title: file.name.replace(/\.pdf$/i, ''),
    source: 'pdf',
    fileHash,
  });
}

/**
 * Analyze text lines and create structured blocks
 */
function analyzeAndCreateBlocks(lines: TextLine[]): Block[] {
  // Calculate the most common font size (body text) - only from non-empty lines
  const fontSizeCounts = new Map<number, number>();
  for (const line of lines) {
    if (line.isEmptyLine) continue;
    // Round to nearest 0.5 to group similar sizes
    const rounded = Math.round(line.fontSize * 2) / 2;
    fontSizeCounts.set(rounded, (fontSizeCounts.get(rounded) ?? 0) + 1);
  }

  // Find the most common font size (body text)
  let bodyFontSize = 12; // Default fallback
  let maxCount = 0;
  for (const [size, count] of fontSizeCounts) {
    if (count > maxCount) {
      maxCount = count;
      bodyFontSize = size;
    }
  }

  const blocks: Block[] = [];
  let blockIndex = 0;
  let pendingParagraph: string[] = [];
  let pendingListItems: string[] = [];
  let pendingListOrdered = false;

  const flushParagraph = () => {
    if (pendingParagraph.length > 0) {
      const content = pendingParagraph.join(' ').trim();
      if (content) {
        blocks.push({
          type: 'paragraph',
          content,
          id: `block-${blockIndex++}`,
        } as ParagraphBlock);
      }
      pendingParagraph = [];
    }
  };

  const flushList = () => {
    if (pendingListItems.length > 0) {
      blocks.push({
        type: 'list',
        ordered: pendingListOrdered,
        items: pendingListItems,
        id: `block-${blockIndex++}`,
      } as ListBlock);
      pendingListItems = [];
    }
  };

  for (const line of lines) {
    // Empty lines indicate paragraph breaks
    if (line.isEmptyLine) {
      flushParagraph();
      flushList();
      continue;
    }

    const fontRatio = line.fontSize / bodyFontSize;
    const isLargerFont = fontRatio >= HEADING_FONT_RATIO_THRESHOLD;
    const isShortLine = line.text.length < 100; // Headings are usually short
    const isHeading = (isLargerFont || line.isBold) && isShortLine;

    // Handle list items
    if (line.isBulletListItem || line.isNumberedListItem) {
      flushParagraph();
      
      const isCurrentlyOrdered = line.isNumberedListItem;
      
      // If list type changes, flush the previous list
      if (pendingListItems.length > 0 && pendingListOrdered !== isCurrentlyOrdered) {
        flushList();
      }
      
      pendingListOrdered = isCurrentlyOrdered;
      
      // Remove the bullet/number prefix
      let itemText = line.text;
      if (line.isBulletListItem) {
        itemText = line.text.replace(BULLET_PATTERNS, '');
      } else {
        itemText = line.text.replace(NUMBERED_PATTERN, '');
      }
      pendingListItems.push(itemText.trim());
      continue;
    }

    // Not a list item - flush any pending list
    flushList();

    // Handle headings
    if (isHeading) {
      flushParagraph();
      
      // Determine heading level based on font size ratio
      let level: 1 | 2 | 3 | 4 | 5 | 6;
      if (fontRatio >= 1.8 || (fontRatio >= 1.5 && line.isBold)) {
        level = 1;
      } else if (fontRatio >= 1.4) {
        level = 2;
      } else if (fontRatio >= 1.2 || line.isBold) {
        level = 3;
      } else {
        level = 4;
      }

      blocks.push({
        type: 'heading',
        level,
        content: line.text,
        id: `block-${blockIndex++}`,
      } as HeadingBlock);
      continue;
    }

    // Regular paragraph text - accumulate
    pendingParagraph.push(line.text);
  }

  // Flush any remaining content
  flushList();
  flushParagraph();

  return blocks;
}

/**
 * Check if a PDF has extractable text
 * Returns an object with the result and error type if applicable
 */
export async function hasPdfTextLayer(file: File): Promise<{ hasText: boolean; error?: PdfErrorType }> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise as PDFDocumentProxy;

    if (pdf.numPages === 0) {
      return { hasText: false, error: 'empty' };
    }

    // Check first page for text
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    return { hasText: textContent.items.length > 0 };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('password')) {
      return { hasText: false, error: 'password-protected' };
    }
    
    if (errorMessage.includes('Invalid PDF') || errorMessage.includes('corrupted')) {
      return { hasText: false, error: 'corrupted' };
    }
    
    return { hasText: false, error: 'unknown' };
  }
}
