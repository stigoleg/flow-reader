/**
 * Encoding Utilities
 * 
 * Shared utilities for base64 encoding/decoding and Unicode-safe conversions.
 * Used by encryption and sync modules.
 */

// BASE64 CONVERSION

/**
 * Convert ArrayBuffer or Uint8Array to base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// UNICODE-SAFE BASE64

/**
 * Encode a Unicode string to base64 (handles non-Latin1 characters)
 * Uses TextEncoder to convert to UTF-8 bytes first
 */
export function unicodeToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return arrayBufferToBase64(bytes);
}

/**
 * Decode a base64 string to Unicode (handles non-Latin1 characters)
 * Uses TextDecoder to convert from UTF-8 bytes
 */
export function base64ToUnicode(base64: string): string {
  const bytes = base64ToUint8Array(base64);
  return new TextDecoder().decode(bytes);
}


/**
 * Convert Uint8Array to ArrayBuffer (for WebCrypto API compatibility with strict TypeScript)
 */
export function toArrayBuffer(uint8Array: Uint8Array): ArrayBuffer {
  return uint8Array.buffer.slice(
    uint8Array.byteOffset, 
    uint8Array.byteOffset + uint8Array.byteLength
  ) as ArrayBuffer;
}
