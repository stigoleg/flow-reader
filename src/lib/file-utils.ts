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
 * Supported document file extensions for import.
 */
export const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.epub', '.mobi', '.azw', '.azw3'] as const;

export type DocumentFileType = 'pdf' | 'docx' | 'epub' | 'mobi';

/**
 * Check if a filename has a supported document extension.
 * Handles case where browser appends .zip to epub files.
 */
export function isSupportedFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  // Handle case where browser appends .zip to epub files
  const normalized = lower.replace(/\.zip$/, '');
  return SUPPORTED_EXTENSIONS.some(ext => normalized.endsWith(ext));
}

/**
 * Get the document type from a filename.
 * Returns null if the file type is not supported.
 */
export function getFileType(filename: string): DocumentFileType | null {
  const lower = filename.toLowerCase();
  // Handle case where browser appends .zip to epub files
  const normalized = lower.replace(/\.zip$/, '');
  if (normalized.endsWith('.pdf')) return 'pdf';
  if (normalized.endsWith('.docx')) return 'docx';
  if (normalized.endsWith('.epub')) return 'epub';
  if (normalized.endsWith('.mobi') || normalized.endsWith('.azw') || normalized.endsWith('.azw3')) return 'mobi';
  return null;
}

/**
 * Compute a hash from a text string for stable identification.
 * Uses a simple but effective hash algorithm (djb2 variant).
 * Returns a 16-character hex string for consistency with file hashes.
 * 
 * This is synchronous and suitable for paste content deduplication.
 */
export function computeTextHash(text: string): string {
  // Use djb2 hash algorithm - fast and good distribution
  let hash1 = 5381;
  let hash2 = 52711;
  
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ char;
    hash2 = ((hash2 << 5) + hash2) ^ char;
  }
  
  // Combine the two hashes and convert to hex
  // Using two hashes reduces collision probability
  const combined = (Math.abs(hash1) * 4096 + Math.abs(hash2)).toString(16);
  
  // Pad to ensure consistent length and take first 16 chars
  return combined.padStart(16, '0').slice(0, 16);
}
