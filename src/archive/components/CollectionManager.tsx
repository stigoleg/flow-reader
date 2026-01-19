/**
 * Collection Manager Modal
 * 
 * Modal for managing user collections - create, edit, delete.
 */

import { useState, useRef, useEffect } from 'react';
import type { Collection } from '@/types';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface CollectionManagerProps {
  collections: Collection[];
  onClose: () => void;
  onCreate: (name: string, options?: { icon?: string; color?: string }) => Promise<Collection | null>;
  onUpdate: (id: string, updates: Partial<Pick<Collection, 'name' | 'icon' | 'color'>>) => Promise<void>;
  onDelete: (id: string) => Promise<boolean>;
}

// Common emojis for collections
const EMOJI_OPTIONS = ['📚', '⭐', '💡', '🔖', '📌', '🎯', '💼', '🏠', '🎨', '🔬', '📰', '✨'];

export default function CollectionManager({
  collections,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: CollectionManagerProps) {
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionIcon, setNewCollectionIcon] = useState('📁');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  
  useEscapeKey(() => {
    if (showEmojiPicker) {
      setShowEmojiPicker(null);
    } else if (editingId) {
      setEditingId(null);
    } else {
      onClose();
    }
  });
  
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);
  
  const handleCreate = async () => {
    const name = newCollectionName.trim();
    if (!name) return;
    
    const created = await onCreate(name, { icon: newCollectionIcon });
    if (created) {
      setNewCollectionName('');
      setNewCollectionIcon('📁');
    }
  };
  
  const handleStartEdit = (collection: Collection) => {
    setEditingId(collection.id);
    setEditingName(collection.name);
  };
  
  const handleFinishEdit = async () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (name) {
      await onUpdate(editingId, { name });
    }
    setEditingId(null);
    setEditingName('');
  };
  
  const handleDelete = async (id: string) => {
    const collection = collections.find(c => c.id === id);
    if (!collection) return;
    
    if (confirm(`Delete "${collection.name}"? Items in this collection will not be deleted.`)) {
      await onDelete(id);
    }
  };
  
  const handleIconChange = async (collectionId: string, icon: string) => {
    await onUpdate(collectionId, { icon });
    setShowEmojiPicker(null);
  };
  
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-manager-title"
        style={{ maxWidth: '480px' }}
      >
        <div className="modal-header">
          <h2 id="collection-manager-title" className="modal-title">Manage Collections</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="modal-body">
          {/* Create new collection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 opacity-70">
              Create new collection
            </label>
            <div className="flex gap-2">
              {/* Emoji picker trigger */}
              <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker(showEmojiPicker === 'new' ? null : 'new')}
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-lg transition-colors"
                  style={{
                    backgroundColor: 'rgba(128, 128, 128, 0.1)',
                    border: '1px solid rgba(128, 128, 128, 0.3)',
                  }}
                  title="Choose icon"
                >
                  {newCollectionIcon}
                </button>
                {showEmojiPicker === 'new' && (
                  <div 
                    className="absolute top-full left-0 mt-1 p-2 rounded-lg shadow-lg z-50 grid grid-cols-6 gap-1 min-w-max"
                    style={{
                      backgroundColor: 'var(--reader-bg)',
                      border: '1px solid rgba(128, 128, 128, 0.3)',
                    }}
                  >
                    {EMOJI_OPTIONS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setNewCollectionIcon(emoji);
                          setShowEmojiPicker(null);
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/10 transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <input
                ref={inputRef}
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                }}
                placeholder="Collection name..."
                className="flex-1 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 transition-colors"
                style={{
                  backgroundColor: 'rgba(128, 128, 128, 0.1)',
                  border: '1px solid rgba(128, 128, 128, 0.3)',
                }}
              />
              <button
                onClick={handleCreate}
                disabled={!newCollectionName.trim()}
                className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: 'var(--reader-link)',
                  color: 'white',
                }}
              >
                Add
              </button>
            </div>
          </div>
          
          {/* Collections list */}
          {collections.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2 opacity-50">Your Collections</h3>
              <div className="space-y-1">
                {collections.map(collection => (
                  <CollectionRow
                    key={collection.id}
                    collection={collection}
                    isEditing={editingId === collection.id}
                    editingName={editingName}
                    showEmojiPicker={showEmojiPicker === collection.id}
                    onEditingNameChange={setEditingName}
                    onStartEdit={() => handleStartEdit(collection)}
                    onFinishEdit={handleFinishEdit}
                    onDelete={() => handleDelete(collection.id)}
                    onToggleEmojiPicker={() => setShowEmojiPicker(
                      showEmojiPicker === collection.id ? null : collection.id
                    )}
                    onIconChange={(icon) => handleIconChange(collection.id, icon)}
                    editInputRef={editingId === collection.id ? editInputRef : undefined}
                  />
                ))}
              </div>
            </div>
          )}
          
          {collections.length === 0 && (
            <p className="text-center opacity-50 py-4">
              No collections yet. Create one above!
            </p>
          )}
        </div>
        
        <div className="modal-footer">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ 
              backgroundColor: 'var(--reader-link)',
              color: 'white',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}


interface CollectionRowProps {
  collection: Collection;
  isEditing: boolean;
  editingName: string;
  showEmojiPicker: boolean;
  onEditingNameChange: (name: string) => void;
  onStartEdit: () => void;
  onFinishEdit: () => void;
  onDelete: () => void;
  onToggleEmojiPicker: () => void;
  onIconChange: (icon: string) => void;
  editInputRef?: React.RefObject<HTMLInputElement | null>;
}

function CollectionRow({
  collection,
  isEditing,
  editingName,
  showEmojiPicker,
  onEditingNameChange,
  onStartEdit,
  onFinishEdit,
  onDelete,
  onToggleEmojiPicker,
  onIconChange,
  editInputRef,
}: CollectionRowProps) {
  return (
    <div 
      className="flex items-center gap-2 p-2 rounded-lg transition-colors"
      style={{ backgroundColor: 'rgba(128, 128, 128, 0.05)' }}
    >
      {/* Icon picker */}
      <div className="relative">
        <button
          onClick={onToggleEmojiPicker}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/10 transition-colors"
          title="Change icon"
        >
          {collection.icon || '📁'}
        </button>
        {showEmojiPicker && (
          <div 
            className="absolute top-full left-0 mt-1 p-2 rounded-lg shadow-lg z-50 grid grid-cols-6 gap-1 min-w-max"
            style={{
              backgroundColor: 'var(--reader-bg)',
              border: '1px solid rgba(128, 128, 128, 0.3)',
            }}
          >
            {EMOJI_OPTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => onIconChange(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/10 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Name */}
      {isEditing ? (
        <input
          ref={editInputRef}
          type="text"
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onBlur={onFinishEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onFinishEdit();
            if (e.key === 'Escape') onFinishEdit();
          }}
          className="flex-1 px-2 py-1 rounded focus:outline-none focus:ring-2"
          style={{
            backgroundColor: 'rgba(128, 128, 128, 0.1)',
          }}
        />
      ) : (
        <span 
          className="flex-1 cursor-pointer"
          onClick={onStartEdit}
          title="Click to rename"
        >
          {collection.name}
        </span>
      )}
      
      {/* Delete button */}
      {!isEditing && (
        <button
          onClick={onDelete}
          className="p-1 rounded opacity-40 hover:opacity-100 hover:text-red-500 transition-all"
          title="Delete collection"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}
