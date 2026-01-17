import type { FlowDocument } from '@/types';
import { createDocument } from './block-utils';
import { computeFileHash } from './file-utils';

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

  const textParts: string[] = [];
  const paragraphs: string[] = [];

  // Extract text from each page
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    let pageText = '';
    for (const item of textContent.items) {
      const textItem = item as TextItem;
      pageText += textItem.str;
      if (textItem.hasEOL) {
        pageText += '\n';
      }
    }

    textParts.push(pageText);
  }

  // Join all pages
  const fullText = textParts.join('\n\n');

  // Split into paragraphs
  const rawParagraphs = fullText.split(/\n\n+/);
  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (trimmed.length > 0) {
      paragraphs.push(trimmed);
    }
  }

  // Check if we got any text
  if (paragraphs.length === 0) {
    throw new PdfExtractionError(
      'No text could be extracted from this PDF. ' +
      'This may be a scanned document without a text layer. ' +
      'OCR support is not available in this version.',
      'no-text-layer'
    );
  }

  // Create blocks
  const blocks = paragraphs.map((content, index) => ({
    type: 'paragraph' as const,
    content,
    id: `block-${index}`,
  }));

  const fileHash = await computeFileHash(file);

  return createDocument(blocks, {
    title: file.name.replace(/\.pdf$/i, ''),
    source: 'pdf',
    fileHash,
  });
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
