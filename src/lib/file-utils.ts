/**
 * File Utilities
 * 
 * Provides utilities for working with imported files, including
 * hashing for stable position keying.
 */

/**
 * Compute a SHA-256 hash of a file for stable identification.
 * Uses Web Crypto API which is available in browser contexts.
 * 
 * For large files, we hash only a sample to avoid memory issues:
 * - First 64KB
 * - Last 64KB
 * - File size
 * 
 * This provides a unique enough fingerprint while being fast.
 */
export async function computeFileHash(file: File): Promise<string> {
  const SAMPLE_SIZE = 64 * 1024; // 64KB
  
  let dataToHash: ArrayBuffer;
  
  if (file.size <= SAMPLE_SIZE * 2) {
    // Small file - hash entire content
    dataToHash = await file.arrayBuffer();
  } else {
    // Large file - hash samples + size
    const firstChunk = await file.slice(0, SAMPLE_SIZE).arrayBuffer();
    const lastChunk = await file.slice(-SAMPLE_SIZE).arrayBuffer();
    
    // Combine chunks with size as a simple fingerprint
    const sizeBuffer = new ArrayBuffer(8);
    new DataView(sizeBuffer).setBigUint64(0, BigInt(file.size), true);
    
    const combined = new Uint8Array(SAMPLE_SIZE * 2 + 8);
    combined.set(new Uint8Array(firstChunk), 0);
    combined.set(new Uint8Array(lastChunk), SAMPLE_SIZE);
    combined.set(new Uint8Array(sizeBuffer), SAMPLE_SIZE * 2);
    
    dataToHash = combined.buffer;
  }
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataToHash);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Return first 16 chars for a shorter but still unique key
  return hashHex.slice(0, 16);
}

/**
 * Count words in a text string.
 * Uses a simple split on whitespace, filtering empty strings.
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Extract file extension from filename (lowercase, without dot)
 */
export function getFileExtension(filename: string): string {
  const match = filename.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Check if a file is a supported ebook format
 */
export function isEbookFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ['epub', 'mobi', 'azw', 'azw3'].includes(ext);
}

/**
 * Check if a file is an EPUB
 */
export function isEpubFile(filename: string): boolean {
  return getFileExtension(filename) === 'epub';
}

/**
 * Check if a file is a MOBI/Kindle format
 */
export function isMobiFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ['mobi', 'azw', 'azw3'].includes(ext);
}
