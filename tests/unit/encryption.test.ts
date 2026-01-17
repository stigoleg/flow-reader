/**
 * Encryption Module Tests
 * 
 * Tests for the sync encryption module using WebCrypto.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encrypt, decrypt, generateSalt, getSaltFromBlob } from '@/lib/sync/encryption';
import type { SyncStateDocument } from '@/lib/sync/types';
import { DEFAULT_SETTINGS } from '@/types';

// Create a mock SyncStateDocument for testing
function createMockStateDocument(): SyncStateDocument {
  return {
    schemaVersion: 3,
    updatedAt: Date.now(),
    deviceId: 'test-device-123',
    settings: DEFAULT_SETTINGS,
    presets: { 'fast-reading': { baseWPM: 400 } },
    customThemes: [],
    archiveItems: [
      {
        id: 'item-1',
        type: 'web',
        title: 'Test Article',
        sourceLabel: 'example.com',
        url: 'https://example.com/article',
        createdAt: Date.now() - 100000,
        lastOpenedAt: Date.now(),
      },
    ],
    positions: {
      'https://example.com/article': {
        blockIndex: 5,
        charOffset: 100,
        timestamp: Date.now(),
      },
    },
    onboardingCompleted: true,
    exitConfirmationDismissed: false,
  };
}

describe('Encryption Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSalt', () => {
    it('generates a 16-byte salt', () => {
      const salt = generateSalt();
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(16);
    });

    it('generates unique salts on each call', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      
      // Convert to hex for comparison
      const hex1 = Array.from(salt1).map(b => b.toString(16).padStart(2, '0')).join('');
      const hex2 = Array.from(salt2).map(b => b.toString(16).padStart(2, '0')).join('');
      
      expect(hex1).not.toBe(hex2);
    });
  });

  describe('encrypt and decrypt', () => {
    const passphrase = 'test-passphrase-12345';

    it('encrypts a state document to an EncryptedBlob', async () => {
      const state = createMockStateDocument();
      const salt = generateSalt();
      
      const blob = await encrypt(state, passphrase, salt);
      
      expect(blob).toHaveProperty('version', 1);
      expect(blob).toHaveProperty('algorithm', 'AES-GCM');
      expect(blob).toHaveProperty('salt');
      expect(blob).toHaveProperty('iv');
      expect(blob).toHaveProperty('ciphertext');
      expect(blob).toHaveProperty('encryptedAt');
      expect(typeof blob.salt).toBe('string');
      expect(typeof blob.iv).toBe('string');
      expect(typeof blob.ciphertext).toBe('string');
    });

    it('decrypts an encrypted blob back to the original state', async () => {
      const originalState = createMockStateDocument();
      const salt = generateSalt();
      
      const blob = await encrypt(originalState, passphrase, salt);
      const decryptedState = await decrypt(blob, passphrase);
      
      expect(decryptedState).toEqual(originalState);
    });

    it('decrypts correctly with matching passphrase', async () => {
      const state = createMockStateDocument();
      const salt = generateSalt();
      
      const blob = await encrypt(state, passphrase, salt);
      const decrypted = await decrypt(blob, passphrase);
      
      expect(decrypted.deviceId).toBe(state.deviceId);
      expect(decrypted.schemaVersion).toBe(state.schemaVersion);
      expect(decrypted.archiveItems).toHaveLength(1);
      expect(decrypted.archiveItems[0].title).toBe('Test Article');
    });

    it('fails to decrypt with wrong passphrase', async () => {
      const state = createMockStateDocument();
      const salt = generateSalt();
      
      const blob = await encrypt(state, passphrase, salt);
      
      await expect(decrypt(blob, 'wrong-passphrase')).rejects.toThrow();
    });

    it('produces different ciphertext for same data with different salts', async () => {
      const state = createMockStateDocument();
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      
      const blob1 = await encrypt(state, passphrase, salt1);
      const blob2 = await encrypt(state, passphrase, salt2);
      
      expect(blob1.ciphertext).not.toBe(blob2.ciphertext);
      expect(blob1.salt).not.toBe(blob2.salt);
    });

    it('produces different IV on each encryption', async () => {
      const state = createMockStateDocument();
      const salt = generateSalt();
      
      const blob1 = await encrypt(state, passphrase, salt);
      const blob2 = await encrypt(state, passphrase, salt);
      
      expect(blob1.iv).not.toBe(blob2.iv);
    });
  });

  describe('getSaltFromBlob', () => {
    it('extracts salt from encrypted blob', async () => {
      const state = createMockStateDocument();
      const originalSalt = generateSalt();
      
      const blob = await encrypt(state, 'test-passphrase', originalSalt);
      const extractedSalt = getSaltFromBlob(blob);
      
      expect(extractedSalt).toBeInstanceOf(Uint8Array);
      expect(extractedSalt.length).toBe(16);
      
      // The extracted salt should match the original
      expect(Array.from(extractedSalt)).toEqual(Array.from(originalSalt));
    });
  });

  describe('edge cases', () => {
    it('handles empty archive items', async () => {
      const state = createMockStateDocument();
      state.archiveItems = [];
      state.positions = {};
      
      const salt = generateSalt();
      const blob = await encrypt(state, 'test-passphrase', salt);
      const decrypted = await decrypt(blob, 'test-passphrase');
      
      expect(decrypted.archiveItems).toEqual([]);
      expect(decrypted.positions).toEqual({});
    });

    it('handles unicode content', async () => {
      const state = createMockStateDocument();
      state.archiveItems[0].title = 'Unicode: 日本語 emoji: 🚀 symbols: ñ é ü';
      
      const salt = generateSalt();
      const blob = await encrypt(state, 'test-passphrase', salt);
      const decrypted = await decrypt(blob, 'test-passphrase');
      
      expect(decrypted.archiveItems[0].title).toBe('Unicode: 日本語 emoji: 🚀 symbols: ñ é ü');
    });

    it('handles large state documents', async () => {
      const state = createMockStateDocument();
      
      // Add many archive items
      for (let i = 0; i < 100; i++) {
        state.archiveItems.push({
          id: `item-${i}`,
          type: 'web',
          title: `Article ${i} with a longer title to increase size`,
          sourceLabel: 'example.com',
          url: `https://example.com/article-${i}`,
          createdAt: Date.now() - i * 1000,
          lastOpenedAt: Date.now() - i * 100,
        });
      }
      
      const salt = generateSalt();
      const blob = await encrypt(state, 'test-passphrase', salt);
      const decrypted = await decrypt(blob, 'test-passphrase');
      
      expect(decrypted.archiveItems).toHaveLength(101); // 1 original + 100 added
    });
  });
});
