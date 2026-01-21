/**
 * Collections Service
 * 
 * CRUD operations for user-created collections and managing
 * collection membership for archive items.
 */

import type { Collection, ArchiveItem } from '@/types';
import { DEFAULT_COLLECTIONS } from '@/types';
import { storageFacade } from './storage-facade';
import { storageMutex } from './async-mutex';


/**
 * Get all collections.
 * Returns default collections merged with user-created ones.
 */
export async function getCollections(): Promise<Collection[]> {
  const state = await storageFacade.getState();
  return state.collections ?? DEFAULT_COLLECTIONS;
}


/**
 * Save the full collections array.
 */
export async function saveCollections(collections: Collection[]): Promise<void> {
  await storageFacade.updateCollections(collections);
}


/**
 * Create a new collection.
 */
export async function createCollection(
  name: string,
  options?: { icon?: string; color?: string }
): Promise<Collection> {
  return storageMutex.withLock(async () => {
    const collections = await getCollections();
    
    const newCollection: Collection = {
      id: crypto.randomUUID(),
      name: name.trim(),
      icon: options?.icon,
      color: options?.color,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    collections.push(newCollection);
    await saveCollections(collections);
    
    return newCollection;
  });
}


/**
 * Update an existing collection.
 */
export async function updateCollection(
  id: string,
  updates: Partial<Pick<Collection, 'name' | 'icon' | 'color'>>
): Promise<Collection | null> {
  return storageMutex.withLock(async () => {
    const collections = await getCollections();
    const index = collections.findIndex(c => c.id === id);
    
    if (index < 0) {
      return null;
    }
    
    const collection = collections[index];
    
    const updated: Collection = {
      ...collection,
      ...updates,
      updatedAt: Date.now(),
    };
    
    collections[index] = updated;
    await saveCollections(collections);
    
    return updated;
  });
}


/**
 * Delete a collection.
 * Also removes the collection ID from all archive items.
 * 
 * Note: This operation is atomic - it reads state once and performs
 * both updates to avoid race conditions between the two saves.
 */
export async function deleteCollection(id: string): Promise<boolean> {
  return storageMutex.withLock(async () => {
    // Read state once at the beginning to avoid race conditions
    const state = await storageFacade.getState();
    const collections = state.collections ?? DEFAULT_COLLECTIONS;
    const collection = collections.find(c => c.id === id);
    
    if (!collection) {
      return false;
    }
    
    // Prepare updated collections (remove the deleted one)
    const filteredCollections = collections.filter(c => c.id !== id);
    
    // Prepare updated archive items (remove collection ID from all items)
    const now = Date.now();
    const updatedItems = state.archiveItems.map(item => {
      if (item.collectionIds?.includes(id)) {
        const newCollectionIds = item.collectionIds.filter(cid => cid !== id);
        return {
          ...item,
          // Clean up empty array
          collectionIds: newCollectionIds.length > 0 ? newCollectionIds : undefined,
          collectionIdsUpdatedAt: now,
        };
      }
      return item;
    });
    
    // Check if archive items need updating
    const hasItemChanges = updatedItems.some((item, i) => 
      item.collectionIds !== state.archiveItems[i].collectionIds
    );
    
    // Perform both updates (order doesn't matter since we're in a lock)
    await saveCollections(filteredCollections);
    
    if (hasItemChanges) {
      await storageFacade.updateArchiveItems(updatedItems);
    }
    
    return true;
  });
}


/**
 * Get a collection by ID.
 */
export async function getCollection(id: string): Promise<Collection | null> {
  const collections = await getCollections();
  return collections.find(c => c.id === id) ?? null;
}


// ============================================================================
// Archive Item Collection Membership
// ============================================================================


/**
 * Add an archive item to a collection.
 */
export async function addItemToCollection(
  itemId: string,
  collectionId: string
): Promise<ArchiveItem | null> {
  return storageMutex.withLock(async () => {
    const state = await storageFacade.getState();
    const items = state.archiveItems;
    const index = items.findIndex(item => item.id === itemId);
    
    if (index < 0) {
      return null;
    }
    
    const item = items[index];
    const collectionIds = new Set(item.collectionIds ?? []);
    
    // Already in collection
    if (collectionIds.has(collectionId)) {
      return item;
    }
    
    collectionIds.add(collectionId);
    
    const updated: ArchiveItem = {
      ...item,
      collectionIds: Array.from(collectionIds),
      collectionIdsUpdatedAt: Date.now(),
    };
    
    items[index] = updated;
    await storageFacade.updateArchiveItems(items);
    
    return updated;
  });
}


/**
 * Remove an archive item from a collection.
 */
export async function removeItemFromCollection(
  itemId: string,
  collectionId: string
): Promise<ArchiveItem | null> {
  return storageMutex.withLock(async () => {
    const state = await storageFacade.getState();
    const items = state.archiveItems;
    const index = items.findIndex(item => item.id === itemId);
    
    if (index < 0) {
      return null;
    }
    
    const item = items[index];
    
    // Not in collection
    if (!item.collectionIds?.includes(collectionId)) {
      return item;
    }
    
    const updated: ArchiveItem = {
      ...item,
      collectionIds: item.collectionIds.filter(id => id !== collectionId),
      collectionIdsUpdatedAt: Date.now(),
    };
    
    // Clean up empty array
    if (updated.collectionIds?.length === 0) {
      delete updated.collectionIds;
    }
    
    items[index] = updated;
    await storageFacade.updateArchiveItems(items);
    
    return updated;
  });
}


/**
 * Set the collections for an archive item (replaces existing).
 */
export async function setItemCollections(
  itemId: string,
  collectionIds: string[]
): Promise<ArchiveItem | null> {
  return storageMutex.withLock(async () => {
    const state = await storageFacade.getState();
    const items = state.archiveItems;
    const index = items.findIndex(item => item.id === itemId);
    
    if (index < 0) {
      return null;
    }
    
    const item = items[index];
    const updated: ArchiveItem = {
      ...item,
      collectionIds: collectionIds.length > 0 ? collectionIds : undefined,
      collectionIdsUpdatedAt: Date.now(),
    };
    
    items[index] = updated;
    await storageFacade.updateArchiveItems(items);
    
    return updated;
  });
}


/**
 * Toggle an archive item's membership in a collection.
 */
export async function toggleItemInCollection(
  itemId: string,
  collectionId: string
): Promise<{ item: ArchiveItem; added: boolean } | null> {
  return storageMutex.withLock(async () => {
    const state = await storageFacade.getState();
    const items = state.archiveItems;
    const index = items.findIndex(item => item.id === itemId);
    
    if (index < 0) {
      return null;
    }
    
    const item = items[index];
    const isInCollection = item.collectionIds?.includes(collectionId) ?? false;
    
    let updated: ArchiveItem;
    const now = Date.now();
    
    if (isInCollection) {
      // Remove from collection
      updated = {
        ...item,
        collectionIds: item.collectionIds?.filter(id => id !== collectionId),
        collectionIdsUpdatedAt: now,
      };
      if (updated.collectionIds?.length === 0) {
        delete updated.collectionIds;
      }
    } else {
      // Add to collection
      updated = {
        ...item,
        collectionIds: [...(item.collectionIds ?? []), collectionId],
        collectionIdsUpdatedAt: now,
      };
    }
    
    items[index] = updated;
    await storageFacade.updateArchiveItems(items);
    
    return { item: updated, added: !isInCollection };
  });
}


/**
 * Get all archive items in a collection.
 */
export async function getItemsInCollection(collectionId: string): Promise<ArchiveItem[]> {
  const state = await storageFacade.getState();
  return state.archiveItems.filter(
    item => item.collectionIds?.includes(collectionId)
  );
}


/**
 * Add multiple items to a collection.
 */
export async function addItemsToCollection(
  itemIds: string[],
  collectionId: string
): Promise<void> {
  return storageMutex.withLock(async () => {
    const state = await storageFacade.getState();
    const items = state.archiveItems;
    const itemIdSet = new Set(itemIds);
    const now = Date.now();
    
    let hasChanges = false;
    
    const updatedItems = items.map(item => {
      if (!itemIdSet.has(item.id)) {
        return item;
      }
      
      const collectionIds = new Set(item.collectionIds ?? []);
      if (collectionIds.has(collectionId)) {
        return item;
      }
      
      collectionIds.add(collectionId);
      hasChanges = true;
      
      return {
        ...item,
        collectionIds: Array.from(collectionIds),
        collectionIdsUpdatedAt: now,
      };
    });
    
    if (hasChanges) {
      await storageFacade.updateArchiveItems(updatedItems);
    }
  });
}


/**
 * Remove multiple items from a collection.
 */
export async function removeItemsFromCollection(
  itemIds: string[],
  collectionId: string
): Promise<void> {
  return storageMutex.withLock(async () => {
    const state = await storageFacade.getState();
    const items = state.archiveItems;
    const itemIdSet = new Set(itemIds);
    
    let hasChanges = false;
    
    const updatedItems = items.map(item => {
      if (!itemIdSet.has(item.id)) {
        return item;
      }
      
      if (!item.collectionIds?.includes(collectionId)) {
        return item;
      }
      
      hasChanges = true;
      const newCollectionIds = item.collectionIds.filter(id => id !== collectionId);
      
      return {
        ...item,
        collectionIds: newCollectionIds.length > 0 ? newCollectionIds : undefined,
        collectionIdsUpdatedAt: Date.now(),
      };
    });
    
    if (hasChanges) {
      await storageFacade.updateArchiveItems(updatedItems);
    }
  });
}
