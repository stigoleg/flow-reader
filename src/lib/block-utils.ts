import type { Block, FlowDocument, DocumentMetadata } from '@/types';

export function getBlockText(block: Block): string {
  return block.type === 'list' ? block.items.join(' ') : block.content;
}

export function getPlainText(blocks: Block[]): string {
  return blocks.map(getBlockText).join(' ');
}

export function createDocument(
  blocks: Block[],
  metadata: Omit<DocumentMetadata, 'createdAt'>
): FlowDocument {
  return {
    metadata: { ...metadata, createdAt: Date.now() },
    blocks,
    plainText: getPlainText(blocks),
  };
}
