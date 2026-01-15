import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';
import { extractContent } from '@/lib/extraction';

describe('FlowCase Integration', () => {
  it('extracts content from real FlowCase HTML', () => {
    const htmlPath = path.join(__dirname, '../../Flowcase - Bedriftsoversikt.html');
    
    // Skip if the test file doesn't exist
    if (!fs.existsSync(htmlPath)) {
      console.log('Skipping FlowCase integration test - HTML file not found');
      return;
    }
    
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    const result = extractContent(doc, 'https://soprasteria.flowcase.com/cv/preview');
    
    expect(result).not.toBeNull();
    expect(result?.blocks.length).toBeGreaterThan(5);
    
    // Check for expected content
    expect(result?.plainText).toContain('Stig-Ole Gundersen');
    expect(result?.plainText).toContain('Data Intelligence');
    expect(result?.plainText).toContain('Prosjekterfaring');
    
    // Log summary for debugging
    console.log('FlowCase extraction result:');
    console.log('- Title:', result?.metadata.title);
    console.log('- Blocks:', result?.blocks.length);
    console.log('- Plain text length:', result?.plainText.length);
  });
});
