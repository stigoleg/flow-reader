/**
 * OAuth Utilities
 *
 * Shared OAuth/PKCE helpers for sync provider adapters.
 * Implements RFC 7636 (PKCE) for secure OAuth 2.0 authorization.
 */

// PKCE (Proof Key for Code Exchange)

/**
 * Generates a cryptographically random code verifier for PKCE.
 * Returns a URL-safe base64 encoded string of 32 random bytes.
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generates a code challenge from a code verifier using SHA-256.
 * The challenge is the base64url-encoded SHA-256 hash of the verifier.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Encodes a Uint8Array as a URL-safe base64 string.
 * Replaces + with -, / with _, and removes trailing = padding.
 */
export function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
