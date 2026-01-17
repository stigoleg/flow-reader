/**
 * Content Sync Manager
 * 
 * Handles syncing of document content (EPUB, PDF, MOBI, DOCX, web content)
 * as separate files from the main state file.
 * 
 * Uses gzip compression to reduce file sizes before sync.
 */

import type { FlowDocument, ArchiveItem } from '@/types';
import type { 
  SyncProvider, 
  ContentManifest, 
  ContentManifestItem,
  EncryptedBlob,
} from './types';
import { encryptData, decryptData } from './encryption';


const CONTENT_FILE_EXTENSION = '.enc';


/** Wrapper type for encrypted compressed content */
interface EncryptedContentData {
  /** Base64-encoded gzip-compressed FlowDocument */
  data: string;
}


export class ContentSyncManager {
  private passphrase: string | null = null;
  private encryptionSalt: Uint8Array | null = null;

  /**
   * Set encryption credentials for content files
   */
  setEncryption(passphrase: string, salt: Uint8Array): void {
    this.passphrase = passphrase;
    this.encryptionSalt = salt;
  }

  /**
   * Clear encryption credentials
   */
  clearEncryption(): void {
    this.passphrase = null;
    this.encryptionSalt = null;
  }

  /**
   * Check if encryption is configured
   */
  hasEncryption(): boolean {
    return this.passphrase !== null && this.encryptionSalt !== null;
  }

  /**
   * Generate a stable content filename from an archive item
   * Uses fileHash for file-based content, or URL hash for web content
   */
  getContentFileName(item: ArchiveItem): string {
    const identifier = item.fileHash || this.hashString(item.url || item.id);
    return `${identifier}${CONTENT_FILE_EXTENSION}`;
  }

  /**
   * Compress a FlowDocument using gzip
   * Returns compressed data as Uint8Array
   */
  async compressDocument(doc: FlowDocument): Promise<Uint8Array> {
    const json = JSON.stringify(doc);
    const encoder = new TextEncoder();
    const data = encoder.encode(json);
    
    // Use CompressionStream API (available in modern browsers)
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(data);
    writer.close();
    
    const compressedChunks: Uint8Array[] = [];
    const reader = cs.readable.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      compressedChunks.push(value);
    }
    
    // Combine chunks into single Uint8Array
    const totalLength = compressedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const compressed = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of compressedChunks) {
      compressed.set(chunk, offset);
      offset += chunk.length;
    }
    
    return compressed;
  }

  /**
   * Decompress gzipped data back to FlowDocument
   */
  async decompressDocument(data: Uint8Array): Promise<FlowDocument> {
    // Use DecompressionStream API
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    // Convert to ArrayBuffer for strict TypeScript compatibility
    writer.write(this.toArrayBuffer(data));
    writer.close();
    
    const decompressedChunks: Uint8Array[] = [];
    const reader = ds.readable.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      decompressedChunks.push(value);
    }
    
    // Combine chunks
    const totalLength = decompressedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const decompressed = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of decompressedChunks) {
      decompressed.set(chunk, offset);
      offset += chunk.length;
    }
    
    const decoder = new TextDecoder();
    const json = decoder.decode(decompressed);
    return JSON.parse(json) as FlowDocument;
  }

  /**
   * Calculate SHA-256 checksum of data
   */
  async calculateChecksum(data: Uint8Array): Promise<string> {
    // Convert to ArrayBuffer to satisfy TypeScript strict mode
    const buffer = this.toArrayBuffer(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = new Uint8Array(hashBuffer);
    return this.arrayToHex(hashArray);
  }

  /**
   * Upload content for an archive item
   */
  async uploadContent(
    provider: SyncProvider,
    item: ArchiveItem,
    document: FlowDocument
  ): Promise<ContentManifestItem | null> {
    try {
      // Ensure content folder exists
      await provider.ensureContentFolder();
      
      // Compress the document
      const compressed = await this.compressDocument(document);
      const checksum = await this.calculateChecksum(compressed);
      
      // Encrypt if encryption is configured
      let blob: Blob;
      if (this.hasEncryption()) {
        const contentData: EncryptedContentData = { data: this.arrayToBase64(compressed) };
        const encryptedBlob = await encryptData(
          contentData,
          this.passphrase!,
          this.encryptionSalt!
        );
        blob = new Blob([JSON.stringify(encryptedBlob)], { type: 'application/json' });
      } else {
        // Convert Uint8Array to ArrayBuffer for Blob compatibility
        const arrayBuffer = this.toArrayBuffer(compressed);
        blob = new Blob([arrayBuffer], { type: 'application/gzip' });
      }
      
      const filename = this.getContentFileName(item);
      const result = await provider.uploadContentFile(filename, blob);
      
      if (!result.success) {
        console.error(`Failed to upload content for ${item.title}:`, result.error);
        return null;
      }
      
      // Create manifest item
      const manifestItem: ContentManifestItem = {
        fileHash: item.fileHash || this.hashString(item.url || item.id),
        archiveItemId: item.id,
        type: item.type,
        title: item.title,
        compressedSize: blob.size,
        originalSize: JSON.stringify(document).length,
        syncedAt: Date.now(),
        checksum,
      };
      
      return manifestItem;
    } catch (error) {
      console.error(`Error uploading content for ${item.title}:`, error);
      return null;
    }
  }

  /**
   * Download content for an archive item
   */
  async downloadContent(
    provider: SyncProvider,
    manifestItem: ContentManifestItem
  ): Promise<FlowDocument | null> {
    try {
      const filename = `${manifestItem.fileHash}${CONTENT_FILE_EXTENSION}`;
      const blob = await provider.downloadContentFile(filename);
      
      if (!blob) {
        return null;
      }
      
      let compressed: Uint8Array;
      
      // Check if encrypted
      if (this.hasEncryption()) {
        const text = await blob.text();
        const encryptedBlob = JSON.parse(text) as EncryptedBlob;
        const decrypted = await decryptData<EncryptedContentData>(encryptedBlob, this.passphrase!);
        compressed = this.base64ToArray(decrypted.data);
      } else {
        compressed = new Uint8Array(await blob.arrayBuffer());
      }
      
      // Verify checksum
      const checksum = await this.calculateChecksum(compressed);
      if (checksum !== manifestItem.checksum) {
        console.warn(`Checksum mismatch for ${manifestItem.title}`);
        // Continue anyway - the file might still be valid
      }
      
      // Decompress
      return await this.decompressDocument(compressed);
    } catch (error) {
      console.error(`Error downloading content for ${manifestItem.title}:`, error);
      return null;
    }
  }

  /**
   * Sync all content between local and remote
   * Returns updated manifest and list of downloaded content
   */
  async syncContent(
    provider: SyncProvider,
    localItems: ArchiveItem[],
    remoteManifest: ContentManifest | undefined
  ): Promise<ContentSyncResult> {
    const result: ContentSyncResult = {
      manifest: remoteManifest || { version: 1, items: {} },
      uploaded: [],
      downloaded: [],
      errors: [],
    };
    
    try {
      // Ensure content folder exists
      await provider.ensureContentFolder();
      
      // Find items that need to be uploaded (have cachedDocument but not in remote manifest)
      for (const item of localItems) {
        if (!item.cachedDocument) continue;
        
        const fileHash = item.fileHash || this.hashString(item.url || item.id);
        
        // Check if already synced
        if (result.manifest.items[fileHash]) {
          continue;
        }
        
        // Upload the content
        const manifestItem = await this.uploadContent(provider, item, item.cachedDocument);
        if (manifestItem) {
          result.manifest.items[fileHash] = manifestItem;
          result.uploaded.push(item.id);
        } else {
          result.errors.push({ itemId: item.id, error: 'Upload failed' });
        }
      }
      
      // Find content that exists in remote but not locally
      for (const [fileHash, manifestItem] of Object.entries(result.manifest.items)) {
        const localItem = localItems.find(item => 
          (item.fileHash || this.hashString(item.url || item.id)) === fileHash
        );
        
        // If local item exists but doesn't have cachedDocument, download it
        if (localItem && !localItem.cachedDocument) {
          const document = await this.downloadContent(provider, manifestItem);
          if (document) {
            result.downloaded.push({ itemId: localItem.id, document });
          } else {
            result.errors.push({ itemId: localItem.id, error: 'Download failed' });
          }
        }
      }
      
    } catch (error) {
      console.error('Content sync error:', error);
      result.errors.push({ 
        itemId: 'sync', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
    
    return result;
  }

  /**
   * Remove orphaned content files (items that no longer exist in archive)
   */
  async pruneOrphanedContent(
    provider: SyncProvider,
    manifest: ContentManifest,
    archiveItemIds: Set<string>
  ): Promise<ContentManifest> {
    const updatedManifest = { ...manifest, items: { ...manifest.items } };
    
    for (const [fileHash, item] of Object.entries(manifest.items)) {
      if (!archiveItemIds.has(item.archiveItemId)) {
        try {
          const filename = `${fileHash}${CONTENT_FILE_EXTENSION}`;
          await provider.deleteContentFile(filename);
          delete updatedManifest.items[fileHash];
        } catch (error) {
          console.error(`Failed to delete orphaned content ${fileHash}:`, error);
        }
      }
    }
    
    return updatedManifest;
  }


  private hashString(str: string): string {
    // Simple hash for generating stable IDs from strings
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private arrayToHex(array: Uint8Array): string {
    return Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private arrayToBase64(array: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < array.byteLength; i++) {
      binary += String.fromCharCode(array[i]);
    }
    return btoa(binary);
  }

  private base64ToArray(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Convert Uint8Array to ArrayBuffer (for WebCrypto API compatibility with strict TypeScript)
   */
  private toArrayBuffer(uint8Array: Uint8Array): ArrayBuffer {
    return uint8Array.buffer.slice(
      uint8Array.byteOffset, 
      uint8Array.byteOffset + uint8Array.byteLength
    ) as ArrayBuffer;
  }

  /**
   * Delete content file for a specific item from the sync provider
   * Called when an item is deleted locally
   */
  async deleteItemContent(
    provider: SyncProvider,
    item: ArchiveItem
  ): Promise<void> {
    const filename = this.getContentFileName(item);
    try {
      await provider.deleteContentFile(filename);
      if (import.meta.env.DEV) console.log(`Deleted synced content: ${filename}`);
    } catch (error) {
      // Ignore errors - file may not exist remotely
      if (import.meta.env.DEV) console.log(`Could not delete synced content ${filename}:`, error);
    }
  }
}


export interface ContentSyncResult {
  /** Updated manifest with all synced content */
  manifest: ContentManifest;
  /** IDs of items that were uploaded */
  uploaded: string[];
  /** Items that were downloaded (with their documents) */
  downloaded: Array<{ itemId: string; document: FlowDocument }>;
  /** Errors that occurred during sync */
  errors: Array<{ itemId: string; error: string }>;
}


export const contentSyncManager = new ContentSyncManager();
