/**
 * EPUB Handler
 * 
 * Parses EPUB files and converts them to FlowReader's internal document model.
 * Uses a custom EPUB parser with the zip adapter for extraction.
 */

import type { FlowDocument, Block, BookStructure, Chapter, TocItem } from '@/types';
import { createZipLoader, type ZipLoader } from './zip-adapter';
import { parseEbookHtml } from './html-parser';
import { getPlainText } from './block-utils';
import { computeFileHash, countWords } from './file-utils';


export type EpubErrorType = 
  | 'invalid-epub'
  | 'drm-protected'
  | 'corrupted'
  | 'no-content'
  | 'unknown';

export class EpubExtractionError extends Error {
  constructor(
    message: string,
    public readonly errorType: EpubErrorType
  ) {
    super(message);
    this.name = 'EpubExtractionError';
  }
}


interface EpubMetadata {
  title: string;
  author?: string;
  language?: string;
  publisher?: string;
  description?: string;
  date?: string;
}

interface SpineItem {
  id: string;
  href: string;
  linear: boolean;
}

interface NavPoint {
  id: string;
  label: string;
  href: string;
  children: NavPoint[];
}


/**
 * Extract a FlowDocument from an EPUB file
 */
export async function extractFromEpub(file: File): Promise<FlowDocument> {
  try {
    const loader = await createZipLoader(file);
    
    await checkForDrm(loader);
    
    const opfPath = await findOpfPath(loader);
    const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
    
    const opfContent = await loader.loadText(opfPath);
    const { metadata, manifest, spine } = parseOpf(opfContent);
    
    const toc = await parseToc(loader, manifest, opfDir);
    
    const chapters = await extractChapters(loader, spine, manifest, opfDir, toc);
    
    if (chapters.length === 0) {
      throw new EpubExtractionError(
        'No readable content found in this EPUB file.',
        'no-content'
      );
    }
    
    const fileHash = await computeFileHash(file);
    
    // Create book structure
    const book: BookStructure = {
      toc: buildFlatToc(toc, chapters),
      chapters,
    };
    
    // The main blocks are the first chapter's blocks (will be updated when navigating)
    const firstChapter = chapters[0];
    
    return {
      metadata: {
        title: metadata.title || file.name.replace(/\.epub$/i, ''),
        author: metadata.author,
        publishedAt: metadata.date,
        source: 'epub',
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
    if (error instanceof EpubExtractionError) {
      throw error;
    }
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[EPUB] Extraction failed:', error);
    
    if (message.includes('Invalid ZIP') || message.includes('not a valid')) {
      throw new EpubExtractionError(
        'This file does not appear to be a valid EPUB.',
        'invalid-epub'
      );
    }
    
    throw new EpubExtractionError(
      `Failed to parse EPUB: ${message}`,
      'unknown'
    );
  }
}


/**
 * Check if EPUB is DRM protected
 */
async function checkForDrm(loader: ZipLoader): Promise<void> {
  try {
    const encryptionXml = await loader.loadText('META-INF/encryption.xml');
    
    // Check for Adobe DRM or other encryption
    if (
      encryptionXml.includes('EncryptedData') &&
      (encryptionXml.includes('http://ns.adobe.com/adept') ||
       encryptionXml.includes('http://www.w3.org/2001/04/xmlenc'))
    ) {
      // Check if it's font obfuscation (allowed) vs content encryption (DRM)
      const hasDrmEncryption = 
        encryptionXml.includes('application/xhtml+xml') ||
        encryptionXml.includes('text/html') ||
        encryptionXml.includes('CipherData');
      
      if (hasDrmEncryption) {
        throw new EpubExtractionError(
          'This EPUB is DRM-protected and cannot be opened. FlowReader only supports DRM-free e-books.',
          'drm-protected'
        );
      }
    }
  } catch (error) {
    // encryption.xml doesn't exist = no DRM
    if (error instanceof EpubExtractionError) {
      throw error;
    }
  }
}

/**
 * Find the path to content.opf from container.xml
 */
async function findOpfPath(loader: ZipLoader): Promise<string> {
  try {
    const containerXml = await loader.loadText('META-INF/container.xml');
    const parser = new DOMParser();
    const doc = parser.parseFromString(containerXml, 'application/xml');
    
    const rootfile = doc.querySelector('rootfile');
    const opfPath = rootfile?.getAttribute('full-path');
    
    if (opfPath) {
      return opfPath;
    }
  } catch (error) {
    // Non-standard EPUB - container.xml is missing, will try fallback
    if (import.meta.env.DEV) {
      console.warn('[EPUB] Could not parse container.xml:', error);
    }
  }
  
  // Fallback: search for .opf file directly
  const files = loader.listFiles();
  const opfFile = files.find(f => f.toLowerCase().endsWith('.opf'));
  
  if (opfFile) {
    return opfFile;
  }
  
  // Log available files for debugging
  console.error('[EPUB] Files in archive:', files.slice(0, 30));
  
  throw new EpubExtractionError(
    'Invalid EPUB: Cannot find META-INF/container.xml or any .opf file.',
    'invalid-epub'
  );
}

/**
 * Parse content.opf to extract metadata, manifest, and spine
 */
function parseOpf(opfContent: string): {
  metadata: EpubMetadata;
  manifest: Map<string, { href: string; mediaType: string }>;
  spine: SpineItem[];
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(opfContent, 'application/xml');
  
  // Extract metadata - try multiple selector patterns for compatibility
  const metadata: EpubMetadata = {
    title: getTextContent(doc, 'dc\\:title, title, metadata > title') || '',
    author: getTextContent(doc, 'dc\\:creator, creator, metadata > creator'),
    language: getTextContent(doc, 'dc\\:language, language, metadata > language'),
    publisher: getTextContent(doc, 'dc\\:publisher, publisher, metadata > publisher'),
    description: getTextContent(doc, 'dc\\:description, description, metadata > description'),
    date: getTextContent(doc, 'dc\\:date, date, metadata > date'),
  };
  
  // Build manifest map
  const manifest = new Map<string, { href: string; mediaType: string }>();
  doc.querySelectorAll('manifest item').forEach(item => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    const mediaType = item.getAttribute('media-type') || '';
    if (id && href) {
      manifest.set(id, { href, mediaType });
    }
  });
  
  // Parse spine
  const spine: SpineItem[] = [];
  doc.querySelectorAll('spine itemref').forEach(itemref => {
    const idref = itemref.getAttribute('idref');
    const manifestItem = idref ? manifest.get(idref) : null;
    if (manifestItem) {
      spine.push({
        id: idref!,
        href: manifestItem.href,
        linear: itemref.getAttribute('linear') !== 'no',
      });
    }
  });
  
  return { metadata, manifest, spine };
}

/**
 * Parse TOC (try NCX first, then nav document)
 */
async function parseToc(
  loader: ZipLoader,
  manifest: Map<string, { href: string; mediaType: string }>,
  opfDir: string
): Promise<NavPoint[]> {
  // Try NCX (EPUB2)
  for (const [, item] of manifest) {
    if (item.mediaType === 'application/x-dtbncx+xml') {
      try {
        const ncxPath = resolvePath(opfDir, item.href);
        const ncxContent = await loader.loadText(ncxPath);
        const toc = parseNcx(ncxContent);
        if (toc.length > 0) return toc;
      } catch (error) {
        console.warn('[EPUB] Failed to parse NCX:', error);
      }
    }
  }
  
  // Try nav document (EPUB3)
  for (const [, item] of manifest) {
    if (item.mediaType === 'application/xhtml+xml' && item.href.includes('nav')) {
      try {
        const navPath = resolvePath(opfDir, item.href);
        const navContent = await loader.loadText(navPath);
        const toc = parseNav(navContent);
        if (toc.length > 0) return toc;
      } catch (error) {
        console.warn('[EPUB] Failed to parse nav document:', error);
      }
    }
  }
  
  // Try any XHTML file that might contain TOC
  for (const [, item] of manifest) {
    if (item.mediaType === 'application/xhtml+xml') {
      try {
        const navPath = resolvePath(opfDir, item.href);
        const navContent = await loader.loadText(navPath);
        if (navContent.includes('epub:type="toc"') || navContent.includes('role="doc-toc"')) {
          const toc = parseNav(navContent);
          if (toc.length > 0) return toc;
        }
      } catch {
        // Continue
      }
    }
  }
  
  return [];
}

/**
 * Parse NCX (EPUB2 TOC format)
 */
function parseNcx(ncxContent: string): NavPoint[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(ncxContent, 'application/xml');
  
  function parseNavPoints(parent: Element): NavPoint[] {
    const navPoints: NavPoint[] = [];
    
    parent.querySelectorAll(':scope > navPoint').forEach(np => {
      const id = np.getAttribute('id') || '';
      const label = np.querySelector('navLabel text')?.textContent?.trim() || '';
      const href = np.querySelector('content')?.getAttribute('src') || '';
      const children = parseNavPoints(np);
      
      if (label && href) {
        navPoints.push({ id, label, href, children });
      }
    });
    
    return navPoints;
  }
  
  const navMap = doc.querySelector('navMap');
  return navMap ? parseNavPoints(navMap) : [];
}

/**
 * Parse nav document (EPUB3 TOC format)
 */
function parseNav(navContent: string): NavPoint[] {
  const parser = new DOMParser();
  
  // Try as XHTML first
  let doc = parser.parseFromString(navContent, 'application/xhtml+xml');
  if (doc.querySelector('parsererror')) {
    doc = parser.parseFromString(navContent, 'text/html');
  }
  
  function parseList(ol: Element): NavPoint[] {
    const navPoints: NavPoint[] = [];
    
    ol.querySelectorAll(':scope > li').forEach((li, index) => {
      const a = li.querySelector(':scope > a, :scope > span > a');
      if (a) {
        const id = `nav-${index}`;
        const label = a.textContent?.trim() || '';
        const href = a.getAttribute('href') || '';
        
        const nestedOl = li.querySelector(':scope > ol');
        const children = nestedOl ? parseList(nestedOl) : [];
        
        if (label && href) {
          navPoints.push({ id, label, href, children });
        }
      }
    });
    
    return navPoints;
  }
  
  // Find the TOC nav element - try multiple patterns
  const tocNav = doc.querySelector('nav[epub\\:type="toc"], nav[*|type="toc"], nav.toc, nav#toc');
  const ol = tocNav?.querySelector('ol');
  
  return ol ? parseList(ol) : [];
}

/**
 * Extract chapters from spine items
 */
async function extractChapters(
  loader: ZipLoader,
  spine: SpineItem[],
  _manifest: Map<string, { href: string; mediaType: string }>,
  opfDir: string,
  toc: NavPoint[]
): Promise<Chapter[]> {
  const chapters: Chapter[] = [];
  const tocMap = buildTocMap(toc);
  
  for (let i = 0; i < spine.length; i++) {
    const spineItem = spine[i];
    
    if (!spineItem.linear) {
      continue;
    }
    
    try {
      const itemPath = resolvePath(opfDir, spineItem.href);
      const html = await loader.loadText(itemPath);
      
      // Parse HTML using ebook-specific parser
      const blocks = parseChapterHtml(html);
      
      if (blocks.length === 0) {
        continue;
      }
      
      // Find chapter title from TOC or first heading
      const baseHref = spineItem.href.split('#')[0];
      const tocEntry = tocMap.get(baseHref);
      const title = tocEntry?.label || findFirstHeading(blocks) || `Chapter ${chapters.length + 1}`;
      
      const plainText = getPlainText(blocks);
      const wordCount = countWords(plainText);
      
      // Skip very short "chapters" that are likely cover pages, copyright, etc.
      if (wordCount < 20 && chapters.length > 0) {
        continue;
      }
      
      chapters.push({
        id: spineItem.id,
        title,
        blocks,
        plainText,
        wordCount,
      });
    } catch (error) {
      // Log but don't skip - might be important content
      console.warn(`[EPUB] Failed to load chapter ${spineItem.href}:`, error);
    }
  }
  
  return chapters;
}

/**
 * Parse chapter HTML and convert to blocks
 */
function parseChapterHtml(html: string): Block[] {
  // Use the ebook-specific parser which is more permissive
  return parseEbookHtml(html);
}

/**
 * Build a map from href to TOC entry for quick lookup
 */
function buildTocMap(toc: NavPoint[]): Map<string, NavPoint> {
  const map = new Map<string, NavPoint>();
  
  function addToMap(navPoints: NavPoint[]) {
    for (const np of navPoints) {
      // Get base href without fragment
      const baseHref = np.href.split('#')[0];
      if (!map.has(baseHref)) {
        map.set(baseHref, np);
      }
      // Also add the full href
      if (!map.has(np.href)) {
        map.set(np.href, np);
      }
      addToMap(np.children);
    }
  }
  
  addToMap(toc);
  return map;
}

/**
 * Build flat TOC with chapter indices
 */
function buildFlatToc(toc: NavPoint[], chapters: Chapter[]): TocItem[] {
  const items: TocItem[] = [];
  
  // Build a map from href patterns to chapter index
  const chapterHrefMap = new Map<string, number>();
  chapters.forEach((ch, idx) => {
    chapterHrefMap.set(ch.id, idx);
  });
  
  function addItems(navPoints: NavPoint[], depth: number) {
    for (const np of navPoints) {
      const baseHref = np.href.split('#')[0];
      
      // Try to find matching chapter
      let chapterIndex = -1;
      
      // Match by ID
      if (chapterHrefMap.has(np.id)) {
        chapterIndex = chapterHrefMap.get(np.id)!;
      }
      
      // Match by href
      if (chapterIndex === -1) {
        for (const [idx, chapter] of chapters.entries()) {
          if (chapter.id.includes(baseHref) || baseHref.includes(chapter.id)) {
            chapterIndex = idx;
            break;
          }
        }
      }
      
      if (chapterIndex >= 0) {
        items.push({
          id: np.id,
          label: np.label,
          chapterIndex,
          depth,
        });
      }
      
      addItems(np.children, depth + 1);
    }
  }
  
  addItems(toc, 0);
  
  // If TOC is empty or incomplete, generate from chapters
  if (items.length === 0 || items.length < chapters.length / 2) {
    items.length = 0;
    chapters.forEach((chapter, index) => {
      items.push({
        id: chapter.id,
        label: chapter.title,
        chapterIndex: index,
        depth: 0,
      });
    });
  }
  
  return items;
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


/**
 * Get text content from first matching element
 */
function getTextContent(doc: Document, selector: string): string | undefined {
  const el = doc.querySelector(selector);
  return el?.textContent?.trim() || undefined;
}

/**
 * Resolve relative path against base directory
 */
function resolvePath(basePath: string, relativePath: string): string {
  // Handle absolute paths
  if (relativePath.startsWith('/')) {
    return relativePath.slice(1);
  }
  
  // Handle URL-encoded paths
  relativePath = decodeURIComponent(relativePath);
  
  // Handle ../ and other relative paths
  const parts = (basePath + relativePath).split('/');
  const resolved: string[] = [];
  
  for (const part of parts) {
    if (part === '..') {
      resolved.pop();
    } else if (part !== '.' && part !== '') {
      resolved.push(part);
    }
  }
  
  return resolved.join('/');
}
