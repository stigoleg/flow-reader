/**
 * Article Cleanup Layer
 * 
 * Post-extraction cleanup that removes non-article modules from Readability output.
 * This includes summary boxes, sidebars, captions, promotional content, and
 * content that fails heuristic checks (low text density, high link density, boilerplate).
 */

// Configurable thresholds (exported for testing)
export const MIN_TEXT_CHARS = 80;
export const MAX_LINK_DENSITY = 0.5;

// Debug mode
let debugEnabled = false;

interface RemovalLog {
  selector: string;
  reason: string;
  textPreview: string;
}

const removalLogs: RemovalLog[] = [];

export function setCleanupDebug(enabled: boolean): void {
  debugEnabled = enabled;
  if (!enabled) {
    removalLogs.length = 0;
  }
}

export function getCleanupLogs(): RemovalLog[] {
  return [...removalLogs];
}

function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const className = el.className && typeof el.className === 'string' 
    ? `.${el.className.split(' ').join('.')}` 
    : '';
  return `${tag}${id}${className}`;
}

function logRemoval(element: Element, reason: string): void {
  if (!debugEnabled) return;
  const text = (element.textContent || '').substring(0, 50).replace(/\s+/g, ' ').trim();
  const log: RemovalLog = {
    selector: describeElement(element),
    reason,
    textPreview: text,
  };
  removalLogs.push(log);
  console.log(`[FlowReader Cleanup] Removed: ${reason}`, describeElement(element), `"${text}..."`);
}

// Structural elements that are never article content
const STRUCTURAL_SELECTORS = [
  'nav', 'header', 'footer', 'aside', 'form', 'input', 'button',
  'dialog', 'details', 'summary', 'menu', 'menuitem', 'noscript',
  '[role="navigation"]', '[role="complementary"]',
  '[role="contentinfo"]', '[role="banner"]', '[role="form"]',
  '[role="search"]', '[role="menu"]', '[role="menubar"]',
];

// Media and caption elements
const MEDIA_SELECTORS = [
  'figure', 'figcaption', 'picture', 'video', 'audio', 'canvas', 
  'embed', 'object', 'iframe', 'svg',
  '[class*="caption"]', '[class*="credit"]', '[class*="gallery"]',
  '[class*="slideshow"]', '[class*="media-"]', '[class*="image-"]',
  '[class*="photo-"]', '[class*="figure-"]', '[class*="thumbnail"]',
  '[id*="caption"]', '[id*="credit"]', '[id*="gallery"]',
];

// Promotional and engagement patterns (applied as class/id contains)
const PROMO_PATTERNS = [
  'share', 'subscribe', 'newsletter', 'donate', 'paywall', 'register', 'login',
  'related', 'recommended', 'trending', 'outbrain', 'taboola', 'sponsored',
  'promo', 'cta', 'signup', 'follow-us', 'social', 'comment', 'disqus',
  'ad-container', 'advertisement', 'banner-ad', 'sidebar',
];

// Summary/takeaway box patterns (applied as class/id contains)
const SUMMARY_BOX_PATTERNS = [
  'summary', 'ai-summary', 'tldr', 'tl-dr', 'key-points', 'highlights',
  'quick-read', 'brief', 'takeaway', 'key-takeaway',
  // Norwegian
  'kortversjon', 'oppsummering', 'sammendrag', 'hovedpoeng', 'nokkelpunkt',
];

// Info box patterns
const INFO_BOX_PATTERNS = [
  'infobox', 'info-box', 'factbox', 'fact-box', 'callout', 'pullquote',
  'sidebar-box', 'aside-box', 'tip-box', 'note-box', 'warning-box',
  // Norwegian
  'faktaboks', 'infoboks',
];

// Heading patterns that indicate summary sections (case insensitive)
export const SUMMARY_HEADING_PATTERNS: RegExp[] = [
  // English
  /^(ai\s+)?summary$/i,
  /^key\s+(takeaways?|points?|highlights?)$/i,
  /^(in\s+brief|tl;?dr|highlights?)$/i,
  /^what\s+you('ll)?\s+(learn|need\s+to\s+know)$/i,
  /^(quick\s+)?overview$/i,
  /^at\s+a\s+glance$/i,
  /^the\s+bottom\s+line$/i,
  // Norwegian
  /^(ai\s+)?oppsummering$/i,
  /^kort\s+fortalt$/i,
  /^hovedpoeng(er)?$/i,
  /^n[øo]kkelpunkt(er)?$/i,
  /^sammendrag$/i,
  /^det\s+viktigste$/i,
  /^kort\s+og\s+godt$/i,
];

// Boilerplate text patterns (starts with)
export const BOILERPLATE_PATTERNS: RegExp[] = [
  /^read\s+more/i,
  /^les\s+mer/i,
  /^related\s*(articles?|posts?|stories?)?/i,
  /^relaterte?\s*(artikler|saker)?/i,
  /^advertisement/i,
  /^annonse/i,
  /^sponsored/i,
  /^sponset/i,
  /^recommended/i,
  /^anbefalt/i,
  /^trending/i,
  /^popul[æa]r/i,
  /^see\s+also/i,
  /^se\s+ogs[åa]/i,
  /^more\s+from/i,
  /^mer\s+fra/i,
  /^share\s+this/i,
  /^del\s+denne/i,
  /^subscribe/i,
  /^abonner/i,
  /^sign\s+up/i,
  /^meld\s+deg/i,
  /^follow\s+us/i,
  /^f[øo]lg\s+oss/i,
];

/**
 * Get heading level from element (1-6) or null if not a heading
 */
function getHeadingLevel(element: Element): number | null {
  const match = element.tagName.match(/^H([1-6])$/i);
  return match ? parseInt(match[1]) : null;
}

/**
 * Remove a summary section starting from a heading.
 * Removes the heading and all following siblings until the next heading
 * of the same or higher level.
 */
function removeSummarySection(heading: Element): void {
  const headingLevel = getHeadingLevel(heading);
  if (!headingLevel) return;

  const elementsToRemove: Element[] = [heading];
  let sibling = heading.nextElementSibling;

  while (sibling) {
    const siblingLevel = getHeadingLevel(sibling);
    // Stop at next heading of same or higher level (lower number)
    if (siblingLevel !== null && siblingLevel <= headingLevel) {
      break;
    }
    elementsToRemove.push(sibling);
    sibling = sibling.nextElementSibling;
  }

  elementsToRemove.forEach(el => {
    logRemoval(el, 'summary-section');
    el.remove();
  });
}

/**
 * Check if an element should be removed based on heuristics.
 * Returns the reason for removal or null if element should be kept.
 * 
 * Different rules apply to different element types:
 * - Container elements (div, section, aside, span): All heuristics apply
 * - Paragraphs: Only applies if very short (< 20 chars) - likely UI labels
 * - List items: No text density check (they're often short by nature)
 * - Headings: No heuristics (handled by summary heading patterns)
 */
function shouldRemoveByHeuristics(element: Element): string | null {
  const text = (element.textContent || '').trim();
  const tagName = element.tagName.toLowerCase();

  // Never apply heuristics to headings - they're handled by summary heading patterns
  const isHeading = /^h[1-6]$/i.test(tagName);
  if (isHeading) {
    return null;
  }

  // Skip pre/code blocks entirely - always preserve
  if (tagName === 'pre' || tagName === 'code' || tagName === 'blockquote') {
    return null;
  }

  // Skip list items - they're often short by nature
  if (tagName === 'li') {
    return null;
  }

  // Define element categories
  const isContainerTag = ['div', 'section', 'article', 'aside', 'span'].includes(tagName);
  const isParagraph = tagName === 'p';

  // 1. Low text density - different thresholds for different elements
  // For containers: use full threshold (80 chars)
  // For paragraphs: use smaller threshold (20 chars) - very short is likely UI
  if (text.length > 0) {
    if (isContainerTag && text.length < MIN_TEXT_CHARS) {
      return 'low-text-density';
    }
    // Paragraphs: only remove if extremely short (likely UI labels)
    if (isParagraph && text.length < 20) {
      return 'low-text-density';
    }
  }

  // 2. High link density (likely navigation) - applies to containers AND paragraphs
  // Navigation-like paragraphs (mostly links) should be removed
  if ((isContainerTag || isParagraph) && text.length > 0) {
    const links = element.querySelectorAll('a');
    const linkTextLength = Array.from(links).reduce(
      (sum, a) => sum + (a.textContent?.length || 0),
      0
    );
    if (linkTextLength / text.length > MAX_LINK_DENSITY) {
      return 'high-link-density';
    }
  }

  // 3. Boilerplate patterns (text starts with) - applies to ALL elements
  if (isContainerTag || isParagraph) {
    const lowerText = text.toLowerCase();
    for (const pattern of BOILERPLATE_PATTERNS) {
      if (pattern.test(lowerText)) {
        return 'boilerplate-pattern';
      }
    }
  }

  // 4. Summary/recommendation indicators in aria or data attributes - containers only
  if (isContainerTag) {
    const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
    const dataAttrs = Array.from(element.attributes)
      .filter(a => a.name.startsWith('data-'))
      .map(a => a.value.toLowerCase());

    const summaryIndicators = ['summary', 'recommendation', 'sidebar', 'related', 'promo'];
    for (const indicator of summaryIndicators) {
      if (ariaLabel.includes(indicator)) {
        return 'aria-indicator';
      }
      if (dataAttrs.some(d => d.includes(indicator))) {
        return 'data-attr-indicator';
      }
    }
  }

  return null;
}

/**
 * Build selectors for pattern-based removal
 */
function buildPatternSelectors(patterns: string[]): string[] {
  const selectors: string[] = [];
  for (const pattern of patterns) {
    selectors.push(`[class*="${pattern}"]`);
    selectors.push(`[id*="${pattern}"]`);
  }
  return selectors;
}

/**
 * Safely remove elements matching a selector
 */
function removeBySelector(root: HTMLElement, selector: string, reason: string): void {
  try {
    root.querySelectorAll(selector).forEach(el => {
      logRemoval(el, reason);
      el.remove();
    });
  } catch {
    // Ignore invalid selectors
  }
}

/**
 * Main cleanup function - removes non-article modules from extracted content.
 * 
 * @param root - The root element containing article HTML (usually document.body)
 * @param metadata - Optional article metadata (title, byline) for context
 */
export function cleanArticleDocument(
  root: HTMLElement,
  metadata?: { title?: string; byline?: string }
): void {
  if (debugEnabled) {
    console.log('[FlowReader Cleanup] Starting cleanup', metadata);
    removalLogs.length = 0;
  }

  // 1. Remove structural non-content elements
  STRUCTURAL_SELECTORS.forEach(selector => {
    removeBySelector(root, selector, 'structural');
  });

  // 2. Remove media and caption elements
  MEDIA_SELECTORS.forEach(selector => {
    removeBySelector(root, selector, 'media-caption');
  });

  // 3. Remove promotional content by class/id patterns
  const promoSelectors = buildPatternSelectors(PROMO_PATTERNS);
  promoSelectors.forEach(selector => {
    removeBySelector(root, selector, 'promotional');
  });

  // 4. Remove summary box elements by class/id patterns
  const summarySelectors = buildPatternSelectors(SUMMARY_BOX_PATTERNS);
  summarySelectors.forEach(selector => {
    removeBySelector(root, selector, 'summary-box');
  });

  // 5. Remove info box elements by class/id patterns
  const infoSelectors = buildPatternSelectors(INFO_BOX_PATTERNS);
  infoSelectors.forEach(selector => {
    removeBySelector(root, selector, 'info-box');
  });

  // 6. Remove summary sections by heading text
  const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headings.forEach(heading => {
    const text = (heading.textContent || '').trim();
    for (const pattern of SUMMARY_HEADING_PATTERNS) {
      if (pattern.test(text)) {
        removeSummarySection(heading);
        break;
      }
    }
  });

  // 7. Apply heuristic-based removal to remaining block elements
  // Process from bottom-up to avoid issues with nested element removal
  const blockElements = root.querySelectorAll('p, div, section, article, aside, span');
  const elementsToCheck = Array.from(blockElements).reverse();

  for (const element of elementsToCheck) {
    // Skip if already removed
    if (!element.parentElement) continue;

    const reason = shouldRemoveByHeuristics(element);
    if (reason) {
      logRemoval(element, reason);
      element.remove();
    }
  }

  if (debugEnabled) {
    console.log(`[FlowReader Cleanup] Completed. Removed ${removalLogs.length} elements.`);
  }
}
