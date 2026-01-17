/**
 * Sync Types
 * 
 * Type definitions for the sync subsystem including:
 * - Sync state document structure
 * - Provider interfaces
 * - OAuth tokens
 * - Sync status and results
 */

import type { 
  ReaderSettings, 
  ReadingPosition, 
  CustomTheme,
  ArchiveItemType,
  ArchiveProgress,
} from '@/types';


/** Available sync provider types */
export type SyncProviderType = 'dropbox' | 'onedrive' | 'folder';

/** OAuth token storage */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp
  tokenType: string;
  scope?: string;
}

/** Provider upload result */
export interface UploadResult {
  success: boolean;
  etag?: string;
  updatedAt: number;
  error?: string;
}

/** Remote file metadata */
export interface RemoteMetadata {
  updatedAt: number;
  etag?: string;
  size: number;
  exists: boolean;
}

/** Provider interface for sync adapters */
export interface SyncProvider {
  readonly name: string;
  readonly providerType: SyncProviderType;
  readonly needsAuth: boolean;

  // Authentication (for OAuth providers)
  startAuth?(): Promise<string>; // Returns auth URL
  completeAuth?(code: string, codeVerifier?: string): Promise<OAuthTokens>;
  refreshToken?(): Promise<OAuthTokens>;

  // State file operations
  upload(blob: EncryptedBlob): Promise<UploadResult>;
  download(): Promise<EncryptedBlob | null>;
  getRemoteMetadata(): Promise<RemoteMetadata>;

  // Content file operations (for multi-file sync)
  listContentFiles(): Promise<string[]>;
  uploadContentFile(filename: string, data: Blob): Promise<UploadResult>;
  downloadContentFile(filename: string): Promise<Blob | null>;
  deleteContentFile(filename: string): Promise<void>;
  ensureContentFolder(): Promise<void>;

  // Connection management
  isConnected(): Promise<boolean>;
  disconnect(): Promise<void>;
}


/** Encrypted blob format for storage in cloud providers */
export interface EncryptedBlob {
  /** Format version */
  version: 1;
  /** Encryption algorithm */
  algorithm: 'AES-GCM';
  /** PBKDF2 salt (base64) */
  salt: string;
  /** AES-GCM initialization vector (base64) */
  iv: string;
  /** Encrypted data (base64) */
  ciphertext: string;
  /** Timestamp when encrypted */
  encryptedAt: number;
}

// CONTENT MANIFEST (for multi-file content sync)

/** Manifest tracking synced content files */
export interface ContentManifest {
  /** Version of the manifest format */
  version: 1;
  /** Map of content items by their file hash or ID */
  items: Record<string, ContentManifestItem>;
}

/** Information about a synced content file */
export interface ContentManifestItem {
  /** Stable identifier (SHA-256 of original file, or URL hash for web content) */
  fileHash: string;
  /** Associated archive item ID */
  archiveItemId: string;
  /** Content type (epub, pdf, etc.) */
  type: ArchiveItemType;
  /** Title for identification */
  title: string;
  /** Compressed size in bytes */
  compressedSize: number;
  /** Original (uncompressed) size in bytes */
  originalSize: number;
  /** When this content was last synced */
  syncedAt: number;
  /** SHA-256 checksum of compressed content for integrity */
  checksum: string;
}


/** Archive item for sync (excludes large cachedDocument) */
export interface SyncArchiveItem {
  id: string;
  type: ArchiveItemType;
  title: string;
  author?: string;
  sourceLabel: string;
  url?: string;
  createdAt: number;
  lastOpenedAt: number;
  progress?: ArchiveProgress;
  lastPosition?: ReadingPosition;
  fileHash?: string;
  /** Size-limited paste content only */
  pasteContent?: string;
  // Note: cachedDocument is explicitly excluded
}

/** The sync state document that gets encrypted and synced */
export interface SyncStateDocument {
  /** Schema version for migrations */
  schemaVersion: number;
  /** Last update timestamp (monotonic) */
  updatedAt: number;
  /** Device ID that last updated this state */
  deviceId: string;

  // User settings
  settings: ReaderSettings;
  presets: Record<string, Partial<ReaderSettings>>;
  customThemes: CustomTheme[];

  // Archive data (metadata only)
  archiveItems: SyncArchiveItem[];

  // Reading positions
  positions: Record<string, ReadingPosition>;

  // Content manifest (tracks synced document content)
  contentManifest?: ContentManifest;

  // Deleted items tombstones (prevents deleted items from being re-synced)
  // Maps item ID (or fileHash/normalized URL) to deletion timestamp
  deletedItems?: Record<string, number>;

  // Flags
  onboardingCompleted: boolean;
  exitConfirmationDismissed: boolean;
}


/** Sync configuration stored locally */
export interface SyncConfig {
  enabled: boolean;
  provider: SyncProviderType | null;
  
  // Provider-specific tokens (stored encrypted)
  dropboxTokens?: OAuthTokens;
  onedriveTokens?: OAuthTokens;
  
  // Folder sync path handle (stored as serialized handle)
  folderHandle?: FileSystemDirectoryHandle;
  folderPath?: string; // Display path for UI
  
  // Salt for key derivation (stored with tokens)
  encryptionSalt?: string;
}


/** Current sync status */
export type SyncStatus = 
  | { state: 'disabled' }
  | { state: 'idle'; lastSyncTime?: number }
  | { state: 'syncing'; startedAt: number }
  | { state: 'error'; message: string; lastAttempt: number; retryAt?: number };

/** Sync operation result */
export interface SyncResult {
  success: boolean;
  timestamp: number;
  action: 'uploaded' | 'downloaded' | 'merged' | 'no-change' | 'error';
  conflicts?: ConflictInfo[];
  error?: string;
}

/** Information about a sync conflict */
export interface ConflictInfo {
  type: 'settings' | 'archive-item' | 'position' | 'preset' | 'theme';
  itemId?: string;
  localValue?: unknown;
  remoteValue?: unknown;
  resolution: 'local-wins' | 'remote-wins' | 'merged';
}


/** Result of merging local and remote state */
export interface MergeResult {
  /** The merged state document */
  merged: SyncStateDocument;
  /** List of conflicts that occurred */
  conflicts: ConflictInfo[];
  /** Whether any actual changes were made */
  hasChanges: boolean;
}


/** Sync event types */
export type SyncEventType = 
  | 'sync-started'
  | 'sync-completed'
  | 'sync-failed'
  | 'conflict-detected'
  | 'provider-connected'
  | 'provider-disconnected';

/** Sync event payload */
export interface SyncEvent {
  type: SyncEventType;
  timestamp: number;
  data?: SyncResult | ConflictInfo | { provider: SyncProviderType };
}

export type SyncEventCallback = (event: SyncEvent) => void;
