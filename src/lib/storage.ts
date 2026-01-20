/**
 * High-level storage operations for FlowReader settings, positions, and documents.
 * Thin wrapper over storageFacade. Use storageFacade directly for sync or change notifications.
 */

import type { ReaderSettings, ReadingPosition, StorageSchema, CustomTheme, FlowDocument, DocumentMetadata } from '@/types';
import { DEFAULT_SETTINGS as defaultSettings } from '@/types';

import { storageFacade } from './storage-facade';
import * as chromeStorage from './chrome-storage';
import { logDeprecation } from './logger';

// Re-export StorageError for backwards compatibility
export { StorageError } from './errors';

const CURRENT_DOCUMENT_KEY = 'currentDocument';


export async function getStorage(): Promise<StorageSchema> {
  const state = await storageFacade.getState();
  return {
    version: state.version,
    settings: state.settings,
    presets: state.presets,
    positions: state.positions,
    archiveItems: state.archiveItems,
    recentDocuments: state.recentDocuments,
    customThemes: state.customThemes,
    onboardingCompleted: state.onboardingCompleted,
    exitConfirmationDismissed: state.exitConfirmationDismissed,
  };
}


export async function saveSettings(settings: Partial<ReaderSettings>): Promise<void> {
  await storageFacade.updateSettings(settings);
}

export async function getSettings(): Promise<ReaderSettings> {
  const state = await storageFacade.getState();
  return state.settings;
}

export async function resetSettings(): Promise<void> {
  await storageFacade.updateSettings(defaultSettings);
}


export async function savePosition(urlOrMetadata: string | DocumentMetadata, position: ReadingPosition): Promise<void> {
  const key = typeof urlOrMetadata === 'string' 
    ? getUrlKey(urlOrMetadata) 
    : getUrlKey(getDocumentKey(urlOrMetadata));
  await storageFacade.updatePositions({ [key]: position });
}

export async function getPosition(urlOrMetadata: string | DocumentMetadata): Promise<ReadingPosition | null> {
  const state = await storageFacade.getState();
  const key = typeof urlOrMetadata === 'string' 
    ? getUrlKey(urlOrMetadata) 
    : getUrlKey(getDocumentKey(urlOrMetadata));
  return state.positions[key] || null;
}

/** Uses base64 encoding for collision-free keys */
function getUrlKey(url: string): string {
  const encoded = btoa(encodeURIComponent(url));
  return `pos_${encoded.slice(0, 200)}`;
}

/**
 * Generate a stable storage key for a document.
 * File-based sources use source + file hash. Web/selection sources use URL.
 */
export function getDocumentKey(metadata: DocumentMetadata): string {
  if (metadata.fileHash && ['epub', 'mobi', 'pdf', 'docx'].includes(metadata.source)) {
    return `file_${metadata.source}_${metadata.fileHash}`;
  }
  return metadata.url || `doc_${metadata.createdAt}`;
}


export async function savePreset(name: string, preset: Partial<ReaderSettings>): Promise<void> {
  const state = await storageFacade.getState();
  const presets = { ...state.presets, [name]: preset };
  await storageFacade.updatePresets(presets);
}

export async function getPresets(): Promise<Record<string, Partial<ReaderSettings>>> {
  const state = await storageFacade.getState();
  return state.presets;
}

export async function deletePreset(name: string): Promise<void> {
  const state = await storageFacade.getState();
  const { [name]: _, ...presets } = state.presets;
  await storageFacade.updatePresets(presets);
}


export async function getCustomThemes(): Promise<CustomTheme[]> {
  const state = await storageFacade.getState();
  return state.customThemes;
}

export async function saveCustomTheme(theme: CustomTheme): Promise<void> {
  const state = await storageFacade.getState();
  const existingIndex = state.customThemes.findIndex(t => t.name === theme.name);
  
  let customThemes: CustomTheme[];
  if (existingIndex >= 0) {
    customThemes = [...state.customThemes];
    customThemes[existingIndex] = theme;
  } else {
    customThemes = [...state.customThemes, theme];
  }
  
  await storageFacade.updateCustomThemes(customThemes);
}

export async function deleteCustomTheme(name: string): Promise<void> {
  const state = await storageFacade.getState();
  const customThemes = state.customThemes.filter(t => t.name !== name);
  await storageFacade.updateCustomThemes(customThemes);
}


export async function isOnboardingCompleted(): Promise<boolean> {
  const state = await storageFacade.getState();
  return state.onboardingCompleted;
}

export async function completeOnboarding(): Promise<void> {
  await storageFacade.updateFlags({ onboardingCompleted: true });
}

export async function isExitConfirmationDismissed(): Promise<boolean> {
  const state = await storageFacade.getState();
  return state.exitConfirmationDismissed;
}

export async function dismissExitConfirmation(): Promise<void> {
  await storageFacade.updateFlags({ exitConfirmationDismissed: true });
}

// CURRENT DOCUMENT (for refresh persistence)

export async function saveCurrentDocument(doc: FlowDocument): Promise<void> {
  await chromeStorage.setOne(CURRENT_DOCUMENT_KEY, doc);
}

export async function getCurrentDocument(): Promise<FlowDocument | null> {
  const doc = await chromeStorage.getOne<FlowDocument>(CURRENT_DOCUMENT_KEY);
  return doc || null;
}

export async function clearCurrentDocument(): Promise<void> {
  await chromeStorage.remove(CURRENT_DOCUMENT_KEY);
}


export async function clearStorage(): Promise<void> {
  await storageFacade.clearAll();
}

// DEPRECATED - For backwards compatibility with tests

/**
 * @deprecated Use addRecent from recents-service.ts instead.
 */
export async function addRecentDocument(doc: { id: string; title: string; source: string; timestamp: number; preview: string; url?: string; cachedDocument?: FlowDocument }): Promise<void> {
  logDeprecation('addRecentDocument', 'addRecent from recents-service.ts');
  const state = await storageFacade.getState();
  const recentDocuments = [
    doc,
    ...state.recentDocuments.filter((d) => d.id !== doc.id),
  ].slice(0, 20);
  await chromeStorage.set({ recentDocuments });
}

/**
 * @deprecated Use queryRecents from recents-service.ts instead.
 */
export async function getRecentDocuments(): Promise<StorageSchema['recentDocuments']> {
  logDeprecation('getRecentDocuments', 'queryRecents from recents-service.ts');
  const state = await storageFacade.getState();
  return state.recentDocuments;
}
