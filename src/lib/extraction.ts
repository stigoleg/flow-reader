import { Readability } from '@mozilla/readability';
import type { FlowDocument, Block } from '@/types';
import { parseHtmlToBlocks } from './html-parser';
import { getBlockText, createDocument } from './block-utils';

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
];

/**
 * Elements to remove AFTER Readability parsing.
 * These may be embedded within article content but are not part of the actual article.
 */
const ELEMENTS_TO_REMOVE_POST = [
  // AI-generated summaries (common patterns)
  '[class*="summary"]',
  '[class*="Summary"]',
  '[data-track-element-type*="Summary"]',
  '[data-track-id*="summary"]',
  '[class*="ai-summary"]',
  '[class*="tldr"]',
  '[class*="key-points"]',
  '[class*="highlights"]',
  '[class*="quick-read"]',
  '[class*="brief"]',
  // Specific Norwegian news site patterns
  '[class*="kortversjon"]',
  '[class*="oppsummering"]',
  // Buttons and interactive elements that Readability may keep
  'button',
  '[role="button"]',
  // Track elements (analytics wrappers)
  'track-element',
  // SVG icons (often decorative)
  'svg',
  // Disclaimers about AI
  '[class*="disclaimer"]',
  // Figure captions (often not part of main reading flow)
  'figcaption',
  // Info boxes that interrupt reading
  '[class*="infobox"]',
  '[class*="factbox"]',
  '[class*="info-box"]',
  '[class*="fact-box"]',
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
  ELEMENTS_TO_REMOVE_PRE.forEach(selector => {
    try {
      doc.querySelectorAll(selector).forEach(el => safeRemove(el));
    } catch {
      // Ignore invalid selectors
    }
  });

  doc.querySelectorAll('[hidden], [aria-hidden="true"], [style*="display: none"], [style*="display:none"]').forEach(el => {
    safeRemove(el);
  });

  doc.querySelectorAll('[style*="font-size"]').forEach(el => {
    const style = (el as HTMLElement).style;
    const fontSize = parseFloat(style.fontSize);
    if (fontSize && fontSize < 10) {
      safeRemove(el);
    }
  });
}

/**
 * Clean HTML after Readability extraction.
 * Removes elements that Readability kept but shouldn't be part of reading content.
 */
function cleanupHtmlPost(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  ELEMENTS_TO_REMOVE_POST.forEach(selector => {
    try {
      doc.querySelectorAll(selector).forEach(el => el.remove());
    } catch {
      // Ignore invalid selectors
    }
  });
  
  return doc.body.innerHTML;
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

export function extractContent(doc: Document, url: string): FlowDocument | null {
  // Create a proper document clone using DOMParser
  // doc.cloneNode(true) can produce invalid documents in some browser contexts
  // XMLSerializer can also produce problematic output for HTML documents
  const parser = new DOMParser();
  
  // Get HTML string from the document - prefer documentElement.outerHTML 
  // as it preserves the full document structure
  const html = doc.documentElement?.outerHTML || doc.body?.outerHTML || '';
  
  console.log('FlowReader: HTML length:', html.length);
  console.log('FlowReader: HTML starts with:', html.substring(0, 100));
  
  if (!html) {
    console.log('FlowReader: No HTML content found');
    return null;
  }
  
  const documentClone = parser.parseFromString(html, 'text/html');
  
  console.log('FlowReader: documentClone:', documentClone);
  console.log('FlowReader: documentClone.documentElement:', documentClone?.documentElement);
  console.log('FlowReader: documentClone.body:', documentClone?.body);
  console.log('FlowReader: documentClone constructor:', documentClone?.constructor?.name);
  
  // Verify we have a valid document for Readability
  if (!documentClone || !documentClone.documentElement) {
    console.log('FlowReader: Invalid document clone');
    return null;
  }
  
  cleanupDomPre(documentClone);
  
  console.log('FlowReader: After cleanup, documentElement:', documentClone.documentElement);
  console.log('FlowReader: After cleanup, body:', documentClone.body);
  console.log('FlowReader: About to create Readability with:', typeof documentClone, documentClone?.nodeType);

  const reader = new Readability(documentClone, {
    charThreshold: 500,
    keepClasses: false,
    nbTopCandidates: 5,
  });

  const article = reader.parse();
  if (!article?.content) {
    return null;
  }

  // Clean the extracted HTML to remove embedded non-article content
  const cleanedHtml = cleanupHtmlPost(article.content);
  const blocks = filterUIBlocks(parseHtmlToBlocks(cleanedHtml), true);

  return createDocument(blocks, {
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
