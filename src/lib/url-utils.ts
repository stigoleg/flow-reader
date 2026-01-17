/**
 * URL Utilities
 * 
 * Shared utilities for URL normalization and hashing.
 * Used for deduplication in archive items and sync tombstones.
 */

/**
 * Tracking parameters to strip from URLs.
 * These are commonly used for analytics and don't affect content identity.
 */
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium', 
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'ref',
];

/**
 * Normalize a URL for consistent comparison and deduplication.
 * 
 * Transformations applied:
 * - Lowercase the hostname
 * - Remove www. prefix
 * - Remove trailing slashes from pathname
 * - Remove common tracking parameters
 * - Sort remaining search params
 * - Remove hash/fragment
 * 
 * @param url - The URL to normalize
 * @returns Normalized URL string, or lowercase original if parsing fails
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Lowercase the hostname and remove www.
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    
    // Remove trailing slash from pathname (but keep root /)
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    
    // Remove common tracking parameters
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    
    // Sort remaining search params for consistency
    parsed.searchParams.sort();
    
    // Remove hash (fragment)
    parsed.hash = '';
    
    return parsed.toString();
  } catch {
    // If URL parsing fails, return as-is but lowercase
    return url.toLowerCase();
  }
}

/**
 * Generate a simple hash from a string.
 * Uses djb2 algorithm for fast, reasonably distributed hashes.
 * 
 * @param str - The string to hash
 * @returns Base36-encoded hash string
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Extract the domain from a URL, removing www. prefix.
 * 
 * @param url - The URL to extract domain from
 * @returns The domain (hostname without www.) or the original URL if parsing fails
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
