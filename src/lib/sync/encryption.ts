/**
 * Encryption Module
 * 
 * End-to-end encryption for sync data using WebCrypto API.
 * - PBKDF2 for key derivation from user passphrase
 * - AES-GCM for authenticated encryption
 */

import type { EncryptedBlob, SyncStateDocument } from './types';
import { 
  arrayBufferToBase64, 
  base64ToUint8Array, 
  toArrayBuffer 
} from '../encoding';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Number of PBKDF2 iterations for key derivation */
const PBKDF2_ITERATIONS = 100_000;

/** Salt length in bytes */
const SALT_LENGTH = 16;

/** IV length in bytes for AES-GCM */
const IV_LENGTH = 12;

/** AES key length in bits */
const AES_KEY_LENGTH = 256;

// =============================================================================
// ENCRYPTION SERVICE
// =============================================================================

/**
 * Derive an AES-GCM key from a passphrase using PBKDF2
 */
export async function deriveKey(
  passphrase: string, 
  salt: Uint8Array
): Promise<CryptoKey> {
  // Import passphrase as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-GCM key
  // Note: We use .buffer to get ArrayBuffer for strict TypeScript compatibility
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH,
    },
    false, // Not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a random salt for key derivation
 */
export function generateSalt(): Uint8Array {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Generate a random IV for AES-GCM
 */
function generateIV(): Uint8Array {
  const iv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(iv);
  return iv;
}

/**
 * Encrypt a sync state document
 */
export async function encrypt(
  data: SyncStateDocument, 
  passphrase: string,
  existingSalt?: Uint8Array
): Promise<EncryptedBlob> {
  return encryptData(data, passphrase, existingSalt);
}

/**
 * Encrypt any JSON-serializable data
 */
export async function encryptData<T>(
  data: T, 
  passphrase: string,
  existingSalt?: Uint8Array
): Promise<EncryptedBlob> {
  // Use existing salt or generate new one
  const salt = existingSalt || generateSalt();
  
  // Derive key from passphrase
  const key = await deriveKey(passphrase, salt);
  
  // Generate random IV
  const iv = generateIV();
  
  // Serialize data to JSON
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  
  // Encrypt with AES-GCM
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
    },
    key,
    plaintext
  );

  return {
    version: 1,
    algorithm: 'AES-GCM',
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(new Uint8Array(ciphertext)),
    encryptedAt: Date.now(),
  };
}

/**
 * Decrypt an encrypted blob back to a sync state document
 */
export async function decrypt(
  blob: EncryptedBlob, 
  passphrase: string
): Promise<SyncStateDocument> {
  return decryptData<SyncStateDocument>(blob, passphrase);
}

/**
 * Decrypt an encrypted blob back to any data type
 */
export async function decryptData<T>(
  blob: EncryptedBlob, 
  passphrase: string
): Promise<T> {
  // Validate blob format
  if (blob.version !== 1 || blob.algorithm !== 'AES-GCM') {
    throw new EncryptionError('Unsupported encryption format', 'decrypt');
  }

  // Decode base64 values
  const salt = base64ToUint8Array(blob.salt);
  const iv = base64ToUint8Array(blob.iv);
  const ciphertext = base64ToUint8Array(blob.ciphertext);

  // Derive key from passphrase
  const key = await deriveKey(passphrase, salt);

  try {
    // Decrypt with AES-GCM
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(iv),
      },
      key,
      toArrayBuffer(ciphertext)
    );

    // Parse JSON
    const json = new TextDecoder().decode(plaintext);
    return JSON.parse(json) as T;
  } catch (error) {
    // AES-GCM authentication failure means wrong passphrase or tampered data
    if (error instanceof DOMException && error.name === 'OperationError') {
      throw new EncryptionError(
        'Decryption failed. Incorrect passphrase or corrupted data.',
        'decrypt'
      );
    }
    throw error;
  }
}

/**
 * Verify a passphrase can decrypt a blob without fully decrypting
 * (useful for passphrase validation)
 */
export async function verifyPassphrase(
  blob: EncryptedBlob, 
  passphrase: string
): Promise<boolean> {
  try {
    await decrypt(blob, passphrase);
    return true;
  } catch (error) {
    if (error instanceof EncryptionError) {
      return false;
    }
    throw error;
  }
}

/**
 * Get the salt from an encrypted blob (for consistent key derivation)
 */
export function getSaltFromBlob(blob: EncryptedBlob): Uint8Array {
  return base64ToUint8Array(blob.salt);
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export class EncryptionError extends Error {
  constructor(
    message: string, 
    public readonly operation: 'encrypt' | 'decrypt' | 'derive-key'
  ) {
    super(message);
    this.name = 'EncryptionError';
  }
}



// =============================================================================
// EXPORTS FOR TESTING
// =============================================================================

export const _testing = {
  arrayBufferToBase64,
  base64ToUint8Array,
  PBKDF2_ITERATIONS,
  SALT_LENGTH,
  IV_LENGTH,
  AES_KEY_LENGTH,
};

// Re-export encoding utilities for convenience
export { arrayBufferToBase64, base64ToUint8Array } from '../encoding';
