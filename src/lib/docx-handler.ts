import type { FlowDocument } from '@/types';
import { parseHtmlToBlocks } from './html-parser';
import { createDocument } from './block-utils';

async function getMammoth() {
  const mammoth = await import('mammoth');
  return mammoth.default || mammoth;
}

export async function extractFromDocx(file: File): Promise<FlowDocument> {
  const mammoth = await getMammoth();
  const arrayBuffer = await file.arrayBuffer();

  const result = await mammoth.convertToHtml({ arrayBuffer });
  const blocks = parseHtmlToBlocks(result.value, { handleTables: true });
  
  return createDocument(blocks, {
    title: file.name.replace(/\.docx?$/i, ''),
    source: 'docx',
  });
}
