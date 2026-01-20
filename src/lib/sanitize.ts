/**
 * HTML Sanitization Module
 * 
 * Provides centralized HTML sanitization using DOMPurify to prevent XSS attacks.
 * All user-provided or externally-fetched HTML should go through these functions
 * before being inserted into the DOM.
 */

import DOMPurify, { type Config } from 'dompurify';

/**
 * Default DOMPurify configuration for article content.
 * Allows safe HTML elements for reading while stripping dangerous content.
 */
const ARTICLE_CONFIG: Config = {
  // Allow common semantic and formatting elements
  ALLOWED_TAGS: [
    // Text structure
    'p', 'br', 'hr',
    // Headings
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    // Lists
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    // Formatting
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark',
    'sub', 'sup', 'small',
    // Semantic
    'blockquote', 'q', 'cite', 'abbr', 'dfn', 'code', 'pre', 'kbd', 'samp', 'var',
    // Links and media (src stripped for images to prevent tracking)
    'a',
    // Tables
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    // Other
    'figure', 'figcaption', 'details', 'summary', 'time',
    // Container (needed for structure during processing)
    'div', 'span', 'section', 'article', 'aside', 'header', 'footer', 'main', 'nav',
  ],
  // Allow safe attributes
  ALLOWED_ATTR: [
    'href', 'title', 'alt', 'cite', 'datetime', 'lang', 'dir',
    'colspan', 'rowspan', 'scope', 'headers',
    // Class is needed for code language detection (language-*)
    'class',
    // Data attributes used by FlowReader for rendering
    'data-word-index', 'data-sentence-index', 'data-block-index',
  ],
  // Force all URLs to be safe
  ALLOW_DATA_ATTR: false,
  // Don't allow any custom element data URIs
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

/**
 * Strict configuration for minimal HTML (e.g., pasted content).
 */
const STRICT_CONFIG: Config = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'title'],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

/**
 * Sanitize HTML content for article display.
 * Use this for content extracted from web pages or imported documents.
 * 
 * @param html - Raw HTML string to sanitize
 * @returns Sanitized HTML string safe for innerHTML assignment
 */
export function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, ARTICLE_CONFIG);
}

/**
 * Sanitize HTML with strict rules (minimal tags allowed).
 * Use this for user-pasted content or other untrusted sources.
 * 
 * @param html - Raw HTML string to sanitize
 * @returns Sanitized HTML string with only basic formatting
 */
export function sanitizeStrictHtml(html: string): string {
  return DOMPurify.sanitize(html, STRICT_CONFIG);
}

/**
 * Sanitize HTML and return a DocumentFragment for efficient DOM manipulation.
 * Use this when you need to process the DOM further.
 * 
 * @param html - Raw HTML string to sanitize
 * @returns Sanitized DocumentFragment
 */
export function sanitizeToFragment(html: string): DocumentFragment {
  return DOMPurify.sanitize(html, {
    ...ARTICLE_CONFIG,
    RETURN_DOM_FRAGMENT: true,
    RETURN_DOM: false,
  }) as unknown as DocumentFragment;
}

/**
 * Sanitize HTML and return a DOM element for processing.
 * The returned element is a <body> containing the sanitized content.
 * 
 * @param html - Raw HTML string to sanitize
 * @returns HTMLBodyElement containing sanitized content
 */
export function sanitizeToElement(html: string): HTMLElement {
  return DOMPurify.sanitize(html, {
    ...ARTICLE_CONFIG,
    RETURN_DOM: true,
    RETURN_DOM_FRAGMENT: false,
  }) as unknown as HTMLElement;
}

/**
 * Check if a string contains potentially dangerous HTML.
 * Useful for quick validation without full sanitization.
 * 
 * @param html - HTML string to check
 * @returns true if the HTML was modified by sanitization (contained unsafe content)
 */
export function containsUnsafeHtml(html: string): boolean {
  const sanitized = DOMPurify.sanitize(html, ARTICLE_CONFIG);
  return sanitized !== html;
}

// Add hook to remove javascript: URLs that might slip through
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node instanceof HTMLAnchorElement) {
    const href = node.getAttribute('href');
    if (href && /^javascript:/i.test(href.trim())) {
      node.removeAttribute('href');
    }
    // Open external links in new tab for security
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }
});
