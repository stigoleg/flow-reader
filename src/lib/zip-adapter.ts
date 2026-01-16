/**
 * Zip Adapter for E-book Parsing
 * 
 * Provides a loader interface for reading files from ZIP archives (EPUB, CBZ).
 * Uses fflate for decompression.
 */

import { unzipSync, strFromU8 } from 'fflate';

export interface ZipEntry {
  filename: string;
  data: Uint8Array;
}

export interface ZipLoader {
  entries: ZipEntry[];
  loadText(filename: string): Promise<string>;
  loadBlob(filename: string): Promise<Blob>;
  getSize(filename: string): number;
}

/**
 * Create a zip loader from a File or ArrayBuffer
 */
export async function createZipLoader(source: File | ArrayBuffer): Promise<ZipLoader> {
  const arrayBuffer = source instanceof File 
    ? await source.arrayBuffer() 
    : source;
  
  const data = new Uint8Array(arrayBuffer);
  
  // Unzip all entries
  const unzipped = unzipSync(data);
  
  // Convert to our entry format
  const entries: ZipEntry[] = Object.entries(unzipped).map(([filename, fileData]) => ({
    filename,
    data: fileData,
  }));
  
  // Create lookup map for fast access
  const entryMap = new Map<string, Uint8Array>();
  for (const entry of entries) {
    entryMap.set(entry.filename, entry.data);
    // Also store with normalized path (without leading slash)
    const normalized = entry.filename.replace(/^\//, '');
    if (normalized !== entry.filename) {
      entryMap.set(normalized, entry.data);
    }
  }
  
  return {
    entries,
    
    async loadText(filename: string): Promise<string> {
      const data = entryMap.get(filename) || entryMap.get(filename.replace(/^\//, ''));
      if (!data) {
        throw new Error(`File not found in archive: ${filename}`);
      }
      return strFromU8(data);
    },
    
    async loadBlob(filename: string): Promise<Blob> {
      const data = entryMap.get(filename) || entryMap.get(filename.replace(/^\//, ''));
      if (!data) {
        throw new Error(`File not found in archive: ${filename}`);
      }
      // Determine MIME type from extension
      const mimeType = getMimeType(filename);
      // Create a proper ArrayBuffer copy to avoid SharedArrayBuffer type issues
      const buffer = new ArrayBuffer(data.byteLength);
      new Uint8Array(buffer).set(data);
      return new Blob([buffer], { type: mimeType });
    },
    
    getSize(filename: string): number {
      const data = entryMap.get(filename) || entryMap.get(filename.replace(/^\//, ''));
      return data?.length ?? 0;
    },
  };
}

/**
 * Get MIME type from filename extension
 */
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    'html': 'text/html',
    'htm': 'text/html',
    'xhtml': 'application/xhtml+xml',
    'xml': 'application/xml',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'txt': 'text/plain',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'otf': 'font/otf',
    'ncx': 'application/x-dtbncx+xml',
    'opf': 'application/oebps-package+xml',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
