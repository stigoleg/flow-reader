import { Readability } from '@mozilla/readability';
import type { FlowDocument, Block } from '@/types';
import { parseHtmlToBlocks } from './html-parser';
import { getBlockText, createDocument } from './block-utils';
import { cleanArticleDocument, setCleanupDebug } from './article-cleanup';
import { normalizeArticleMarkup, setNormalizeDebug } from './article-normalize';

/**
 * Enable debug logging for extraction pipeline.
 * Set to true during development to see which nodes are removed/normalized.
 */
const DEBUG_EXTRACTION = false;

/**
 * Elements to remove BEFORE Readability parsing.
 * These are typically outside the main article content.
 * IMPORTANT: These selectors must NOT match html, head, or body elements!
 */
const ELEMENTS_TO_REMOVE_PRE = [
  // Video/audio players
  '[class*="player-control"]', '[class*="video-control"]', '[class*="video-player"]',
  '[class*="vjs-"]', '[class*="jw-"]', '[class*="plyr"]', '[class*="mejs"]',
  '.video-js', '[data-testid*="video"]',
  '[class*="audio-player"]', '[class*="podcast-player"]', '[class*="listen-button"]',
  '[class*="audio-controls"]',
  // Keyboard shortcuts / help
  '[class*="keyboard-shortcuts"]', '[class*="hotkey"]', '[class*="shortcut-list"]',
  '[aria-label*="keyboard"]', '[class*="help-modal"]',
  // Ads
  '[class*="ad-container"]', '[class*="advertisement"]', '[id*="google_ads"]',
  '[class*="sponsored"]', '[data-ad]',
  // Social / sharing
  '[class*="share-buttons"]', '[class*="social-share"]', '[class*="sharing-tools"]',
  // Comments
  '[class*="comments-section"]', '[id*="disqus"]', '[class*="comment-form"]',
  // Newsletter / signup
  '[class*="newsletter"]', '[class*="subscribe-form"]', '[class*="email-signup"]',
  // Cookie / privacy banners (use more specific selectors to avoid matching html/body)
  'div[class*="cookie-banner"]', 'div[class*="gdpr"]', 'div[class*="consent-banner"]',
  'aside[class*="cookie-banner"]', 'aside[class*="gdpr"]', 'aside[class*="consent-banner"]',
  'section[class*="cookie-banner"]', 'section[class*="gdpr"]', 'section[class*="consent-banner"]',
  'div[class*="privacy-notice"]',
  // Navigation / layout
  '[role="navigation"]', '[class*="site-header"]', '[class*="site-footer"]',
  '[class*="mega-menu"]',
  // Interactive elements
  'button:not([class*="accordion"])', 'input', 'select', 'form:not([class*="search"])',
  '[role="slider"]', '[role="progressbar"]', '[role="menubar"]',
  // Related content
  '[class*="related-articles"]', '[class*="recommended"]', '[class*="more-stories"]',
  '[class*="read-next"]',
  // Summary/takeaway boxes (English + Norwegian)
  '[class*="summary"]', '[class*="ai-summary"]', '[class*="tldr"]', '[class*="tl-dr"]',
  '[class*="key-points"]', '[class*="highlights"]', '[class*="takeaway"]',
  '[class*="oppsummering"]', '[class*="sammendrag"]', '[class*="kortversjon"]',
  '[class*="hovedpoeng"]',
  // Info/fact boxes
  '[class*="infobox"]', '[class*="info-box"]', '[class*="factbox"]', '[class*="fact-box"]',
  '[class*="callout"]', '[class*="pullquote"]', '[class*="faktaboks"]', '[class*="infoboks"]',
];

/**
 * Additional structural elements to remove before Readability.
 * These are semantic elements that should never contain article content.
 */
const STRUCTURAL_PRE_SELECTORS = [
  'nav', 'aside', 
  'header:not(article header)', 
  'footer:not(article footer)',
  '[role="complementary"]', '[role="banner"]', '[role="contentinfo"]',
  // Media elements that Readability might keep
  'figure', 'picture', 'video', 'audio', 'canvas', 'embed', 'object',
];

/**
 * Text content patterns that indicate non-article content.
 * These are checked against block text after extraction.
 */
const NON_ARTICLE_TEXT_PATTERNS = [
  // AI summary indicators (Norwegian)
  /oppsummeringen er laget med kunstig intelligens/i,
  /kvalitetssikret av .+ journalister/i,
  /kortversjonen/i,
  /les hele saken/i,
  // AI summary indicators (English)
  /this summary was (generated|created) (by|with|using) (ai|artificial intelligence)/i,
  /ai[- ]generated summary/i,
  /key (takeaways|points|highlights)/i,
  /^(summary|tldr|tl;dr)$/i,
  /in (this article|brief)/i,
  // Interactive elements text
  /^vis (mer|mindre)$/i,
  /^show (more|less)$/i,
  /^read (more|less)$/i,
  /^les (mer|mindre)$/i,
  /^expand$/i,
  /^collapse$/i,
  /^utvid$/i,
  /^skjul$/i,
];

const UI_TEXT_PATTERNS = [
  /^\d{1,2}:\d{2}(:\d{2})?$/,
  /^\d+%$/,
  /^\d+\s*(seconds?|minutes?|hours?|sekunder?|minutter?|timer?)$/i,
  /^(play|pause|mute|unmute|volume|stop|rewind|forward)$/i,
  /^(spill|stopp|lyd|volum)$/i,
  /^(fullscreen|exit fullscreen|fullskjerm|avslutt fullskjerm)$/i,
  /^(advertisement|annonse|ad|reklame|sponsored)$/i,
  /^lytt (til saken|igjen)/i,
  /^listen (to article|again)/i,
  /keyboard\s*shortcuts?/i,
  /hurtigtaster/i,
  /shortcuts?\s*open\/close/i,
  /^\d+\s+seconds?\s+of\s+\d+/i,
  /avspilling har en varighet/i,
  /^volume\s+\d+%$/i,
  /^(close|open|show|hide|toggle|lukk|åpne|vis|skjul)$/i,
  /^(subtitles?|captions?|undertekster?)\s*(on|off|på|av)?$/i,
  /^(increase|decrease)\s+(caption|subtitle)\s+size$/i,
  /^seek\s+(forward|backward|fremover|bakover)$/i,
  /^søk\s+(fremover|bakover)$/i,
  // Interactive button text
  /^vis (mer|mindre)$/i,
  /^show (more|less)$/i,
  /^read (more|less)$/i,
  /^les (mer|mindre)$/i,
  /^expand$/i,
  /^collapse$/i,
  /^utvid$/i,
];

const MIN_PARAGRAPH_LENGTH = 15;  // Minimum length for paragraphs (not headings)
const MAX_NUMERIC_RATIO = 0.6;

// Elements that should never be removed (would break the document)
const PROTECTED_TAGS = new Set(['HTML', 'HEAD', 'BODY']);

/**
 * Safely remove an element, but never remove html, head, or body
 */
function safeRemove(el: Element): void {
  if (!PROTECTED_TAGS.has(el.tagName)) {
    el.remove();
  }
}

/**
 * Clean DOM before Readability parsing.
 * Removes elements that are clearly not article content.
 */
function cleanupDomPre(doc: Document): void {
  // Remove elements by class/id patterns
  ELEMENTS_TO_REMOVE_PRE.forEach(selector => {
    try {
      doc.querySelectorAll(selector).forEach(el => safeRemove(el));
    } catch {
      // Ignore invalid selectors
    }
  });

  // Remove structural elements that shouldn't contain article content
  STRUCTURAL_PRE_SELECTORS.forEach(selector => {
    try {
      doc.querySelectorAll(selector).forEach(el => safeRemove(el));
    } catch {
      // Ignore invalid selectors
    }
  });

  // Remove hidden elements
  doc.querySelectorAll('[hidden], [aria-hidden="true"], [style*="display: none"], [style*="display:none"]').forEach(el => {
    safeRemove(el);
  });

  // Remove tiny font elements (likely UI chrome)
  doc.querySelectorAll('[style*="font-size"]').forEach(el => {
    const style = (el as HTMLElement).style;
    const fontSize = parseFloat(style.fontSize);
    if (fontSize && fontSize < 10) {
      safeRemove(el);
    }
  });
}

/**
 * Check if a block's text content matches non-article patterns
 */
function isNonArticleContent(text: string): boolean {
  const trimmed = text.trim();
  return NON_ARTICLE_TEXT_PATTERNS.some(pattern => pattern.test(trimmed));
}

function isUIText(text: string, strict: boolean = true): boolean {
  const trimmed = text.trim();

  if (strict && trimmed.length < MIN_PARAGRAPH_LENGTH) {
    return true;
  }

  if (UI_TEXT_PATTERNS.some(pattern => pattern.test(trimmed))) {
    return true;
  }

  if (strict) {
    const letters = trimmed.match(/[a-zA-ZæøåÆØÅ]/g)?.length || 0;
    const total = trimmed.length;
    if (total > 0 && letters / total < (1 - MAX_NUMERIC_RATIO)) {
      return true;
    }
  }

  if (/^[a-z↑↓←→]+$/i.test(trimmed) || /^[+\-=\/\\?!]+$/.test(trimmed)) {
    return true;
  }

  return false;
}

function filterUIBlocks(blocks: Block[], strict: boolean = true): Block[] {
  return blocks.filter(block => {
    const text = getBlockText(block);
    
    // Filter out non-article content (AI summaries, etc.)
    if (isNonArticleContent(text)) {
      return false;
    }
    
    // Never filter headings based on length - they're often short
    if (block.type === 'heading') {
      // Only filter headings that match UI patterns
      return !UI_TEXT_PATTERNS.some(pattern => pattern.test(text.trim()));
    }
    
    return !isUIText(text, strict);
  });
}

function textToParagraphBlocks(text: string): Block[] {
  return text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map((content, index) => ({
      type: 'paragraph' as const,
      content,
      id: `block-${index}`,
    }));
}

/**
 * Extract article content from a web page document.
 * 
 * Pipeline:
 * 1. Clone document
 * 2. Pre-Readability cleanup (remove obvious non-content)
 * 3. Readability extraction
 * 4. Post-extraction cleanup (remove summary boxes, sidebars, captions)
 * 5. Markup normalization (strip formatting, unwrap containers/spans)
 * 6. Parse to blocks
 * 7. Filter UI text patterns
 */
export function extractContent(doc: Document, url: string): FlowDocument | null {
  // Enable debug logging if configured
  if (DEBUG_EXTRACTION) {
    setCleanupDebug(true);
    setNormalizeDebug(true);
  }

  // Create a proper document clone using DOMParser
  const parser = new DOMParser();
  
  // Get HTML string from the document
  const html = doc.documentElement?.outerHTML || doc.body?.outerHTML || '';
  
  if (DEBUG_EXTRACTION) {
    console.log('FlowReader: HTML length:', html.length);
  }
  
  if (!html) {
    console.log('FlowReader: No HTML content found');
    return null;
  }
  
  const documentClone = parser.parseFromString(html, 'text/html');
  
  // Verify we have a valid document for Readability
  if (!documentClone || !documentClone.documentElement) {
    console.log('FlowReader: Invalid document clone');
    return null;
  }
  
  // Step 1: Pre-Readability cleanup
  cleanupDomPre(documentClone);
  
  if (DEBUG_EXTRACTION) {
    console.log('FlowReader: Pre-cleanup complete');
  }

  // Step 2: Readability extraction
  // Note: keepClasses: true allows our post-extraction cleanup to match
  // class-based patterns (summary boxes, info boxes, etc.). Classes are
  // stripped later during normalization.
  const reader = new Readability(documentClone, {
    charThreshold: 500,
    keepClasses: true,
    nbTopCandidates: 5,
  });

  const article = reader.parse();
  if (!article?.content) {
    return null;
  }

  // Step 3: Parse extracted HTML for cleanup and normalization
  const articleDoc = parser.parseFromString(article.content, 'text/html');
  
  // Step 4: Post-extraction cleanup (removes summary boxes, sidebars, etc.)
  cleanArticleDocument(articleDoc.body, {
    title: article.title || undefined,
    byline: article.byline || undefined,
  });
  
  // Step 5: Markup normalization (strips formatting, unwraps containers)
  normalizeArticleMarkup(articleDoc.body);
  
  // Get the cleaned and normalized HTML
  const cleanedHtml = articleDoc.body.innerHTML;
  
  if (DEBUG_EXTRACTION) {
    console.log('FlowReader: Cleaned HTML length:', cleanedHtml.length);
  }
  
  // Step 6: Parse to blocks
  const blocks = parseHtmlToBlocks(cleanedHtml);
  
  // Step 7: Filter UI text patterns
  const filteredBlocks = filterUIBlocks(blocks, true);

  return createDocument(filteredBlocks, {
    title: article.title || 'Untitled',
    author: article.byline || undefined,
    publishedAt: article.publishedTime || undefined,
    source: 'web',
    url,
  });
}

export function extractFromSelection(selection: string, url: string): FlowDocument {
  const blocks = filterUIBlocks(textToParagraphBlocks(selection), false);

  return createDocument(blocks, {
    title: 'Selected Text',
    source: 'selection',
    url,
  });
}

export function extractFromPaste(text: string): FlowDocument {
  const blocks = filterUIBlocks(textToParagraphBlocks(text), false);

  return createDocument(blocks, {
    title: 'Pasted Text',
    source: 'paste',
  });
}

/**
 * Enable or disable debug logging for the extraction pipeline.
 * When enabled, logs which nodes are removed and why.
 */
export function setExtractionDebug(enabled: boolean): void {
  setCleanupDebug(enabled);
  setNormalizeDebug(enabled);
}
