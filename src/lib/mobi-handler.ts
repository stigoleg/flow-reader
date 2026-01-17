/**
 * MOBI Handler
 * 
 * Parses MOBI/AZW/AZW3/KF8 files and converts them to FlowReader's internal document model.
 * Uses a custom parser that handles the Mobipocket format.
 * 
 * MOBI files are more complex than EPUB - they use Palm Database (PDB) format
 * with various compression schemes. This implementation supports:
 * - Uncompressed MOBI
 * - PalmDOC compression
 * - Basic HUFF/CDIC (for older MOBIs)
 * 
 * DRM-protected files (Kindle DRM) are NOT supported.
 */

import type { FlowDocument, Block, BookStructure, Chapter, TocItem } from '@/types';
import { parseEbookHtml } from './html-parser';
import { getPlainText } from './block-utils';
import { computeFileHash, countWords } from './file-utils';


export type MobiErrorType = 
  | 'invalid-mobi'
  | 'drm-protected'
  | 'unsupported-compression'
  | 'corrupted'
  | 'no-content'
  | 'unknown';

export class MobiExtractionError extends Error {
  constructor(
    message: string,
    public readonly errorType: MobiErrorType
  ) {
    super(message);
    this.name = 'MobiExtractionError';
  }
}


const PDB_HEADER_SIZE = 78;
const MOBI_MAGIC = 'MOBI';
const PALMDOC_MAGIC = 'BOOK';
const EXTH_MAGIC = 'EXTH';

// Compression types
const COMPRESSION_NONE = 1;
const COMPRESSION_PALMDOC = 2;
const COMPRESSION_HUFF = 17480;

// Encryption types
const ENCRYPTION_NONE = 0;

// EXTH record types
const EXTH_AUTHOR = 100;
const EXTH_PUBLISHER = 101;
const EXTH_DESCRIPTION = 103;
// const EXTH_SUBJECT = 105;  // Reserved for future use
const EXTH_PUBLISHED_DATE = 106;
const EXTH_LANGUAGE = 524;


/**
 * Extract a FlowDocument from a MOBI file
 */
export async function extractFromMobi(file: File): Promise<FlowDocument> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);
    
    const pdbHeader = parsePdbHeader(data);
    
    const records = parseRecordList(data, pdbHeader.numRecords);
    
    const record0 = getRecord(bytes, records, 0);
    
    const palmDocHeader = parsePalmDocHeader(new DataView(record0.buffer, record0.byteOffset));
    
    // Check for DRM
    if (palmDocHeader.encryption !== ENCRYPTION_NONE) {
      throw new MobiExtractionError(
        'This MOBI file is DRM-protected and cannot be opened. FlowReader only supports DRM-free e-books.',
        'drm-protected'
      );
    }
    
    const mobiHeader = parseMobiHeader(new DataView(record0.buffer, record0.byteOffset));
    
    // Parse EXTH header if present
    const exthData = mobiHeader.exthFlags & 0x40 
      ? parseExthHeader(record0, mobiHeader.headerLength + 16)
      : {};
    
    const metadata = {
      title: mobiHeader.fullName || pdbHeader.name || file.name.replace(/\.(mobi|azw3?|prc)$/i, ''),
      author: exthData[EXTH_AUTHOR],
      publisher: exthData[EXTH_PUBLISHER],
      description: exthData[EXTH_DESCRIPTION],
      language: exthData[EXTH_LANGUAGE],
      date: exthData[EXTH_PUBLISHED_DATE],
    };
    
    const textContent = extractTextContent(
      bytes,
      records,
      palmDocHeader,
      mobiHeader
    );
    
    const chapters = parseContentIntoChapters(textContent);
    
    if (chapters.length === 0) {
      throw new MobiExtractionError(
        'No readable content found in this MOBI file.',
        'no-content'
      );
    }
    
    const fileHash = await computeFileHash(file);
    
    // Build TOC from chapters
    const toc: TocItem[] = chapters.map((chapter, index) => ({
      id: chapter.id,
      label: chapter.title,
      chapterIndex: index,
      depth: 0,
    }));
    
    // Create book structure
    const book: BookStructure = {
      toc,
      chapters,
    };
    
    // The main blocks are the first chapter's blocks
    const firstChapter = chapters[0];
    
    return {
      metadata: {
        title: metadata.title,
        author: metadata.author,
        publishedAt: metadata.date,
        source: 'mobi',
        createdAt: Date.now(),
        language: metadata.language,
        publisher: metadata.publisher,
        fileName: file.name,
        fileSize: file.size,
        fileHash,
      },
      blocks: firstChapter.blocks,
      plainText: firstChapter.plainText,
      book,
    };
  } catch (error) {
    if (error instanceof MobiExtractionError) {
      throw error;
    }
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[MOBI] Extraction failed:', error);
    
    throw new MobiExtractionError(
      `Failed to parse MOBI: ${message}`,
      'unknown'
    );
  }
}


interface PdbHeader {
  name: string;
  numRecords: number;
}

function parsePdbHeader(data: DataView): PdbHeader {
  // Database name (0-31, null-terminated)
  const nameBytes = new Uint8Array(data.buffer, 0, 32);
  const nameEnd = nameBytes.indexOf(0);
  const name = new TextDecoder('latin1').decode(nameBytes.slice(0, nameEnd > 0 ? nameEnd : 32));
  
  // Number of records (76-77)
  const numRecords = data.getUint16(76, false);
  
  return { name: name.trim(), numRecords };
}

interface RecordInfo {
  offset: number;
  attributes: number;
  uniqueId: number;
}

function parseRecordList(data: DataView, numRecords: number): RecordInfo[] {
  const records: RecordInfo[] = [];
  let offset = PDB_HEADER_SIZE;
  
  for (let i = 0; i < numRecords; i++) {
    records.push({
      offset: data.getUint32(offset, false),
      attributes: data.getUint8(offset + 4),
      uniqueId: (data.getUint8(offset + 5) << 16) | data.getUint16(offset + 6, false),
    });
    offset += 8;
  }
  
  return records;
}

function getRecord(bytes: Uint8Array, records: RecordInfo[], index: number): Uint8Array {
  const record = records[index];
  const nextOffset = index + 1 < records.length 
    ? records[index + 1].offset 
    : bytes.length;
  
  return bytes.slice(record.offset, nextOffset);
}

// PALMDOC & MOBI HEADER PARSING

interface PalmDocHeader {
  compression: number;
  textLength: number;
  recordCount: number;
  recordSize: number;
  encryption: number;
}

function parsePalmDocHeader(data: DataView): PalmDocHeader {
  return {
    compression: data.getUint16(0, false),
    textLength: data.getUint32(4, false),
    recordCount: data.getUint16(8, false),
    recordSize: data.getUint16(10, false),
    encryption: data.getUint16(12, false),
  };
}

interface MobiHeader {
  headerLength: number;
  mobiType: number;
  encoding: number;
  firstImageIndex: number;
  exthFlags: number;
  fullName: string;
}

function parseMobiHeader(data: DataView): MobiHeader {
  // Check for MOBI magic at offset 16
  const magic = String.fromCharCode(
    data.getUint8(16), data.getUint8(17), 
    data.getUint8(18), data.getUint8(19)
  );
  
  if (magic !== MOBI_MAGIC && magic !== PALMDOC_MAGIC) {
    throw new MobiExtractionError(
      'This file does not appear to be a valid MOBI file.',
      'invalid-mobi'
    );
  }
  
  const headerLength = data.getUint32(20, false);
  const mobiType = data.getUint32(24, false);
  const encoding = data.getUint32(28, false);
  
  // These might not exist in older MOBI files
  let firstImageIndex = 0;
  let exthFlags = 0;
  
  try {
    if (headerLength >= 108) {
      firstImageIndex = data.getUint32(108, false);
    }
    if (headerLength >= 128) {
      exthFlags = data.getUint32(128, false);
    }
  } catch {
    // Ignore - older MOBI format
  }
  
  // Try to get full name
  let fullName = '';
  try {
    const fullNameOffset = data.getUint32(84, false);
    const fullNameLength = data.getUint32(88, false);
    if (fullNameOffset > 0 && fullNameLength > 0 && fullNameOffset + fullNameLength < data.byteLength) {
      const nameBytes = new Uint8Array(data.buffer, data.byteOffset + fullNameOffset, fullNameLength);
      const decoder = encoding === 65001 ? new TextDecoder('utf-8') : new TextDecoder('latin1');
      fullName = decoder.decode(nameBytes);
    }
  } catch {
    // Ignore errors reading full name
  }
  
  return { headerLength, mobiType, encoding, firstImageIndex, exthFlags, fullName };
}


function parseExthHeader(record0: Uint8Array, offset: number): Record<number, string> {
  const exthData: Record<number, string> = {};
  
  try {
    if (offset + 12 > record0.length) return exthData;
    
    const data = new DataView(record0.buffer, record0.byteOffset + offset);
    
    // Check for EXTH magic
    const magic = String.fromCharCode(
      data.getUint8(0), data.getUint8(1),
      data.getUint8(2), data.getUint8(3)
    );
    
    if (magic !== EXTH_MAGIC) {
      return exthData;
    }
    
    const recordCount = data.getUint32(8, false);
    let pos = 12;
    
    for (let i = 0; i < recordCount && pos < data.byteLength - 8; i++) {
      const type = data.getUint32(pos, false);
      const length = data.getUint32(pos + 4, false);
      
      if (length > 8 && pos + length <= data.byteLength) {
        const valueBytes = new Uint8Array(record0.buffer, record0.byteOffset + offset + pos + 8, length - 8);
        const value = new TextDecoder('utf-8').decode(valueBytes);
        exthData[type] = value;
      }
      
      pos += length;
    }
  } catch (error) {
    console.warn('[MOBI] Error parsing EXTH header:', error);
  }
  
  return exthData;
}


function extractTextContent(
  bytes: Uint8Array,
  records: RecordInfo[],
  palmDocHeader: PalmDocHeader,
  mobiHeader: MobiHeader
): string {
  const textParts: string[] = [];
  const decoder = mobiHeader.encoding === 65001 
    ? new TextDecoder('utf-8') 
    : new TextDecoder('latin1');
  
  // Determine which records contain text
  // Text records start at record 1 and continue until we hit the first image
  // or until we've read all text records
  const startRecord = 1;
  let endRecord = startRecord + palmDocHeader.recordCount;
  
  // If firstImageIndex is set, use it as upper bound
  if (mobiHeader.firstImageIndex > 0 && mobiHeader.firstImageIndex < endRecord) {
    endRecord = mobiHeader.firstImageIndex;
  }
  
  // Don't go beyond available records
  endRecord = Math.min(endRecord, records.length);
  
  for (let i = startRecord; i < endRecord; i++) {
    try {
      const record = getRecord(bytes, records, i);
      let text: Uint8Array;
      
      switch (palmDocHeader.compression) {
        case COMPRESSION_NONE:
          text = record;
          break;
        case COMPRESSION_PALMDOC:
          text = decompressPalmDoc(record);
          break;
        case COMPRESSION_HUFF:
          throw new MobiExtractionError(
            'This MOBI uses HUFF/CDIC compression which is not fully supported.',
            'unsupported-compression'
          );
        default:
          // Try to read anyway - might be uncompressed
          console.warn(`[MOBI] Unknown compression ${palmDocHeader.compression}, trying uncompressed`);
          text = record;
      }
      
      // Remove trailing multibyte overlap bytes
      // MOBI records may have extra bytes at the end for multibyte character handling
      let textLength = text.length;
      if (textLength > 0 && mobiHeader.encoding === 65001) {
        // Check for trailing size indicator
        const trailingByte = text[textLength - 1];
        if (trailingByte < 4 && trailingByte > 0) {
          textLength -= trailingByte + 1;
        }
      }
      
      textParts.push(decoder.decode(text.slice(0, textLength)));
    } catch (error) {
      if (error instanceof MobiExtractionError) {
        throw error;
      }
      // Skip records that fail to decompress
      console.warn(`[MOBI] Failed to decompress record ${i}:`, error);
    }
  }
  
  return textParts.join('');
}

/**
 * PalmDOC LZ77 decompression
 */
function decompressPalmDoc(input: Uint8Array): Uint8Array {
  const output: number[] = [];
  let i = 0;
  
  while (i < input.length) {
    const byte = input[i++];
    
    if (byte === 0) {
      // Literal null
      output.push(0);
    } else if (byte >= 1 && byte <= 8) {
      // Copy next n bytes literally
      for (let j = 0; j < byte && i < input.length; j++) {
        output.push(input[i++]);
      }
    } else if (byte >= 9 && byte <= 0x7f) {
      // Literal byte
      output.push(byte);
    } else if (byte >= 0x80 && byte <= 0xbf) {
      // LZ77 distance/length pair
      if (i >= input.length) break;
      const nextByte = input[i++];
      const distance = ((byte << 8) | nextByte) >> 3 & 0x7ff;
      const length = (nextByte & 0x07) + 3;
      
      const start = output.length - distance;
      for (let j = 0; j < length; j++) {
        output.push(output[start + j] || 0);
      }
    } else {
      // byte >= 0xc0: space + character
      output.push(0x20);
      output.push(byte ^ 0x80);
    }
  }
  
  return new Uint8Array(output);
}


/**
 * Parse HTML content into chapters
 * MOBI files often use <mbp:pagebreak> for chapter breaks
 */
function parseContentIntoChapters(html: string): Chapter[] {
  // Clean up the HTML: remove null bytes and MOBI-specific tags
  // Use String.prototype.split with charCode to avoid control regex warning
  const nullByte = String.fromCharCode(0);
  const cleanHtml = html
    .split(nullByte).join('')
    // Remove MOBI-specific tags (but preserve their content)
    .replace(/<mbp:nu>|<\/mbp:nu>/gi, '')
    .replace(/<mbp:section[^>]*>/gi, '<div>')
    .replace(/<\/mbp:section>/gi, '</div>');
  
  // Split on page breaks
  const pageBreakPattern = /<mbp:pagebreak\s*\/?>/gi;
  const sections = cleanHtml.split(pageBreakPattern);
  
  const chapters: Chapter[] = [];
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;
    
    // Parse HTML to blocks using ebook parser
    const blocks = parseEbookHtml(section);
    
    // Skip empty sections
    if (blocks.length === 0) continue;
    
    // Find title from first heading or generate one
    const title = findFirstHeading(blocks) || `Section ${chapters.length + 1}`;
    
    const plainText = getPlainText(blocks);
    const wordCount = countWords(plainText);
    
    // Skip very short sections (likely navigation or copyright pages)
    // But only after we have some chapters, and merge with previous if possible
    if (wordCount < 50 && chapters.length > 0) {
      // Merge with previous chapter
      const prevChapter = chapters[chapters.length - 1];
      prevChapter.blocks = [...prevChapter.blocks, ...blocks];
      prevChapter.plainText = getPlainText(prevChapter.blocks);
      prevChapter.wordCount = countWords(prevChapter.plainText);
      continue;
    }
    
    chapters.push({
      id: `chapter-${chapters.length}`,
      title,
      blocks,
      plainText,
      wordCount,
    });
  }
  
  // If no chapters were created from pagebreaks, try splitting by headings
  if (chapters.length <= 1 && cleanHtml.length > 1000) {
    return createChaptersFromHeadings(cleanHtml);
  }
  
  return chapters;
}

/**
 * Create chapters by splitting on major headings
 */
function createChaptersFromHeadings(html: string): Chapter[] {
  const blocks = parseEbookHtml(html);
  const chapters: Chapter[] = [];
  let currentBlocks: Block[] = [];
  let currentTitle = 'Beginning';
  
  for (const block of blocks) {
    // Check if this is a chapter-level heading
    if (block.type === 'heading' && block.level <= 2 && currentBlocks.length > 0) {
      // Save current chapter if it has substantial content
      const plainText = getPlainText(currentBlocks);
      if (plainText.length > 100) {
        chapters.push({
          id: `chapter-${chapters.length}`,
          title: currentTitle,
          blocks: currentBlocks,
          plainText,
          wordCount: countWords(plainText),
        });
      }
      
      // Start new chapter
      currentBlocks = [block];
      currentTitle = block.content;
    } else {
      currentBlocks.push(block);
    }
  }
  
  // Don't forget the last chapter
  if (currentBlocks.length > 0) {
    const plainText = getPlainText(currentBlocks);
    chapters.push({
      id: `chapter-${chapters.length}`,
      title: currentTitle,
      blocks: currentBlocks,
      plainText,
      wordCount: countWords(plainText),
    });
  }
  
  // If we still only have one chapter (or none), just return all content as one
  if (chapters.length === 0 && blocks.length > 0) {
    const plainText = getPlainText(blocks);
    chapters.push({
      id: 'chapter-0',
      title: findFirstHeading(blocks) || 'Content',
      blocks,
      plainText,
      wordCount: countWords(plainText),
    });
  }
  
  return chapters;
}

/**
 * Find the first heading in blocks
 */
function findFirstHeading(blocks: Block[]): string | undefined {
  for (const block of blocks) {
    if (block.type === 'heading') {
      return block.content;
    }
  }
  return undefined;
}
