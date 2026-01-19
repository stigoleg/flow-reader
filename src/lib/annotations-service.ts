/**
 * Annotations Service
 * 
 * CRUD operations for text annotations (highlights and notes).
 * Annotations are stored per-document using a document key.
 */

import type { Annotation, AnnotationAnchor, DocumentMetadata, ArchiveItem } from '@/types';
import { HIGHLIGHT_COLORS } from '@/types';
import { storageFacade } from './storage-facade';
import { normalizeUrl } from './url-utils';
import { recordAnnotationCreated } from './stats-service';
import { storageMutex } from './async-mutex';


/**
 * Generate a stable document key for annotations.
 * Uses fileHash if available, otherwise normalized URL, otherwise title-based key.
 */
export function getDocumentAnnotationKey(metadata: DocumentMetadata): string {
  // Prefer fileHash for stable identification (files)
  if (metadata.fileHash) {
    return `hash:${metadata.fileHash}`;
  }
  
  // For web content, use normalized URL
  if (metadata.url) {
    return `url:${normalizeUrl(metadata.url)}`;
  }
  
  // Fallback: title + createdAt (for paste content)
  return `doc:${metadata.title.toLowerCase().replace(/\s+/g, '-')}-${metadata.createdAt}`;
}


/**
 * Generate document key from an ArchiveItem.
 * Uses the same logic as getDocumentAnnotationKey for consistency.
 */
export function getDocumentKeyFromArchiveItem(item: ArchiveItem): string | null {
  // Prefer fileHash for stable identification (files)
  // Also check cachedDocument.metadata.fileHash as fallback for older items
  const fileHash = item.fileHash || item.cachedDocument?.metadata.fileHash;
  if (fileHash) {
    return `hash:${fileHash}`;
  }
  
  // For web content, use normalized URL
  // Also check cachedDocument.metadata.url as fallback
  const url = item.url || item.cachedDocument?.metadata.url;
  if (url) {
    return `url:${normalizeUrl(url)}`;
  }
  
  // For paste content, we need createdAt
  if (item.type === 'paste' && item.createdAt) {
    return `doc:${item.title.toLowerCase().replace(/\s+/g, '-')}-${item.createdAt}`;
  }
  
  // Cannot determine key
  return null;
}


/**
 * Get annotation count for a document.
 */
export async function getAnnotationCount(documentKey: string): Promise<number> {
  const annotations = await getAnnotations(documentKey);
  return annotations.length;
}


/**
 * Get all annotations for a document.
 */
export async function getAnnotations(documentKey: string): Promise<Annotation[]> {
  const state = await storageFacade.getState();
  return state.annotations?.[documentKey] ?? [];
}


/**
 * Get all annotations across all documents.
 */
export async function getAllAnnotations(): Promise<Record<string, Annotation[]>> {
  const state = await storageFacade.getState();
  return state.annotations ?? {};
}


/**
 * Create a new annotation.
 */
export function createAnnotation(
  anchor: AnnotationAnchor,
  color: string,
  note?: string
): Annotation {
  const now = Date.now();
  
  return {
    id: crypto.randomUUID(),
    type: note ? 'note' : 'highlight',
    color,
    anchor,
    note,
    createdAt: now,
    updatedAt: now,
  };
}


/**
 * Save an annotation for a document.
 * If annotation with same ID exists, it will be updated.
 */
export async function saveAnnotation(
  documentKey: string,
  annotation: Annotation
): Promise<Annotation> {
  return storageMutex.withLock(async () => {
    const allAnnotations = await getAllAnnotations();
    const docAnnotations = allAnnotations[documentKey] ?? [];
    
    // Check if annotation already exists
    const existingIndex = docAnnotations.findIndex(a => a.id === annotation.id);
    
    if (existingIndex >= 0) {
      // Update existing
      docAnnotations[existingIndex] = {
        ...annotation,
        updatedAt: Date.now(),
      };
    } else {
      // Add new
      docAnnotations.push(annotation);
      
      // Record new annotation creation for stats (fire-and-forget, outside lock)
      // Schedule this to run after lock release
      setTimeout(() => {
        recordAnnotationCreated().catch(err => {
          console.error('[Annotations] Failed to record annotation stat:', err);
        });
      }, 0);
    }
    
    allAnnotations[documentKey] = docAnnotations;
    await storageFacade.updateAnnotations(allAnnotations);
    
    return annotation;
  });
}


/**
 * Update an existing annotation.
 */
export async function updateAnnotation(
  documentKey: string,
  id: string,
  updates: Partial<Pick<Annotation, 'color' | 'note'>>
): Promise<Annotation | null> {
  return storageMutex.withLock(async () => {
    const allAnnotations = await getAllAnnotations();
    const docAnnotations = allAnnotations[documentKey];
    
    if (!docAnnotations) {
      return null;
    }
    
    const index = docAnnotations.findIndex(a => a.id === id);
    
    if (index < 0) {
      return null;
    }
    
    const annotation = docAnnotations[index];
    const updated: Annotation = {
      ...annotation,
      ...updates,
      // Update type based on whether there's a note
      type: (updates.note !== undefined ? (updates.note ? 'note' : 'highlight') : annotation.type),
      updatedAt: Date.now(),
    };
    
    docAnnotations[index] = updated;
    allAnnotations[documentKey] = docAnnotations;
    await storageFacade.updateAnnotations(allAnnotations);
    
    return updated;
  });
}


/**
 * Delete an annotation.
 */
export async function deleteAnnotation(
  documentKey: string,
  id: string
): Promise<boolean> {
  return storageMutex.withLock(async () => {
    const allAnnotations = await getAllAnnotations();
    const docAnnotations = allAnnotations[documentKey];
    
    if (!docAnnotations) {
      return false;
    }
    
    const index = docAnnotations.findIndex(a => a.id === id);
    
    if (index < 0) {
      return false;
    }
    
    docAnnotations.splice(index, 1);
    
    // Remove document key if no annotations left
    if (docAnnotations.length === 0) {
      delete allAnnotations[documentKey];
    } else {
      allAnnotations[documentKey] = docAnnotations;
    }
    
    await storageFacade.updateAnnotations(allAnnotations);
    
    return true;
  });
}


/**
 * Delete all annotations for a document.
 */
export async function deleteDocumentAnnotations(documentKey: string): Promise<boolean> {
  return storageMutex.withLock(async () => {
    const allAnnotations = await getAllAnnotations();
    
    if (!allAnnotations[documentKey]) {
      return false;
    }
    
    delete allAnnotations[documentKey];
    await storageFacade.updateAnnotations(allAnnotations);
    
    return true;
  });
}


/**
 * Get the default highlight color.
 */
export function getDefaultHighlightColor(): string {
  return HIGHLIGHT_COLORS[0].color;
}


/**
 * Check if a word position falls within an annotation's range.
 */
export function isWordInAnnotation(
  blockId: string,
  wordIndex: number,
  annotation: Annotation
): boolean {
  const { anchor } = annotation;
  
  // Single block annotation
  if (anchor.blockId === anchor.endBlockId) {
    return (
      blockId === anchor.blockId &&
      wordIndex >= anchor.startWordIndex &&
      wordIndex <= anchor.endWordIndex
    );
  }
  
  // Multi-block annotation - need block ordering info
  // For now, handle start block, end block, and assume blocks in between
  if (blockId === anchor.blockId) {
    return wordIndex >= anchor.startWordIndex;
  }
  
  if (blockId === anchor.endBlockId) {
    return wordIndex <= anchor.endWordIndex;
  }
  
  // For blocks in between, we'd need block ordering
  // This will be enhanced when we have access to the block structure
  return false;
}


/**
 * Get annotations that apply to a specific block.
 * Returns annotations sorted by start word index.
 */
export function getBlockAnnotations(
  blockId: string,
  annotations: Annotation[]
): Annotation[] {
  return annotations
    .filter(a => 
      a.anchor.blockId === blockId || 
      a.anchor.endBlockId === blockId
    )
    .sort((a, b) => {
      // Sort by start position within block
      const aStart = a.anchor.blockId === blockId ? a.anchor.startWordIndex : 0;
      const bStart = b.anchor.blockId === blockId ? b.anchor.startWordIndex : 0;
      return aStart - bStart;
    });
}


/**
 * Get the highlight color for a word if it's annotated.
 * Returns null if word is not annotated.
 */
export function getWordHighlightColor(
  blockId: string,
  wordIndex: number,
  annotations: Annotation[]
): string | null {
  for (const annotation of annotations) {
    if (isWordInAnnotation(blockId, wordIndex, annotation)) {
      return annotation.color;
    }
  }
  return null;
}


/**
 * Get annotation at a specific word position.
 * Returns null if no annotation at that position.
 */
export function getAnnotationAtPosition(
  blockId: string,
  wordIndex: number,
  annotations: Annotation[]
): Annotation | null {
  for (const annotation of annotations) {
    if (isWordInAnnotation(blockId, wordIndex, annotation)) {
      return annotation;
    }
  }
  return null;
}
