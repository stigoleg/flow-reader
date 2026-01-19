/**
 * Article Normalization Layer
 * 
 * Produces minimal, predictable markup from cleaned article HTML.
 * Strips presentational formatting, unwraps unnecessary containers,
 * and normalizes inline elements while preserving semantic meaning.
 */

// Debug mode
let debugEnabled = false;

interface NormalizationLog {
  selector: string;
  action: string;
  reason: string;
}

const normalizationLogs: NormalizationLog[] = [];

export function setNormalizeDebug(enabled: boolean): void {
  debugEnabled = enabled;
  if (!enabled) {
    normalizationLogs.length = 0;
  }
}

export function getNormalizeLogs(): NormalizationLog[] {
  return [...normalizationLogs];
}

function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const className = el.className && typeof el.className === 'string'
    ? `.${el.className.split(' ').join('.')}`
    : '';
  return `${tag}${id}${className}`;
}

function logNormalization(element: Element, action: string, reason: string): void {
  if (!debugEnabled) return;
  const log: NormalizationLog = {
    selector: describeElement(element),
    action,
    reason,
  };
  normalizationLogs.push(log);
  console.log(`[FlowReader Normalize] ${action}: ${reason}`, describeElement(element));
}

// Allowed block-level tags (only these remain in output)
export const ALLOWED_BLOCK_TAGS = new Set([
  'h2', 'h3', 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code'
]);

// Allowed inline tags (semantic formatting)
export const ALLOWED_INLINE_TAGS = new Set([
  'a', 'strong', 'em', 'code', 'b', 'i', 'sub', 'sup',
  'mark', 'del', 'ins', 's', 'u', 'abbr'
]);

// Wrapper tags that should be unwrapped
const WRAPPER_TAGS = new Set([
  'div', 'section', 'article', 'main', 'span', 'font', 'center'
]);

// Non-content span patterns (class/id contains - should be removed, not unwrapped)
const NON_CONTENT_SPAN_PATTERNS = [
  'caption', 'credit', 'byline', 'share', 'subscribe', 'promo',
  'related', 'recommended', 'tldr', 'summary', 'ai', 'takeaway', 
  'highlights', 'icon', 'badge', 'label', 'tag', 'meta',
];

// Patterns indicating italic/emphasis styling
const ITALIC_PATTERNS = ['italic', 'emphasis', 'em', 'emphasized', 'oblique'];

// Patterns indicating bold/strong styling
const BOLD_PATTERNS = ['bold', 'strong', 'fw-bold', 'font-bold', 'semibold', 'font-semibold'];

/**
 * Unwrap an element, replacing it with its children
 */
function unwrapElement(element: Element): void {
  const parent = element.parentNode;
  if (!parent) return;

  // Move all children before this element
  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  // Remove the now-empty element
  element.remove();
}

/**
 * Check if element is inside a code/pre block (preserve exact content)
 */
function isInsideCode(element: Element): boolean {
  return element.closest('pre, code') !== null;
}

/**
 * Remove h1 elements from body (title comes from metadata)
 */
function removeH1Elements(root: HTMLElement): void {
  root.querySelectorAll('h1').forEach(el => {
    logNormalization(el, 'remove', 'h1 removed (title from metadata)');
    el.remove();
  });
}

/**
 * Convert h4-h6 to h3
 */
function normalizeHeadingLevels(root: HTMLElement): void {
  ['h4', 'h5', 'h6'].forEach(tag => {
    root.querySelectorAll(tag).forEach(el => {
      const h3 = document.createElement('h3');
      h3.innerHTML = el.innerHTML;
      logNormalization(el, 'convert', `${tag} -> h3`);
      el.replaceWith(h3);
    });
  });
}

/**
 * Convert b to strong and i to em
 */
function normalizeSemanticTags(root: HTMLElement): void {
  root.querySelectorAll('b').forEach(el => {
    if (isInsideCode(el)) return;
    const strong = document.createElement('strong');
    strong.innerHTML = el.innerHTML;
    el.replaceWith(strong);
  });

  root.querySelectorAll('i').forEach(el => {
    if (isInsideCode(el)) return;
    const em = document.createElement('em');
    em.innerHTML = el.innerHTML;
    el.replaceWith(em);
  });
}

/**
 * Remove anchors without href (they provide no value)
 */
function cleanAnchors(root: HTMLElement): void {
  root.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href');
    if (!href || href === '#' || href.startsWith('javascript:')) {
      logNormalization(a, 'unwrap', 'anchor without valid href');
      unwrapElement(a);
    }
  });
}

/**
 * Handle br elements - collapse multiple br into paragraph indicators
 */
function normalizeBrElements(root: HTMLElement): void {
  // Remove single br elements (CSS handles spacing)
  // Multiple consecutive br might indicate intentional breaks
  const brElements = Array.from(root.querySelectorAll('br'));
  
  for (const br of brElements) {
    if (isInsideCode(br)) continue;
    
    // Check if part of a br sequence (2+ consecutive br)
    const next = br.nextSibling;
    const prev = br.previousSibling;
    
    // If not part of a sequence, remove it
    const hasNextBr = next?.nodeName === 'BR';
    const hasPrevBr = prev?.nodeName === 'BR';
    
    if (!hasNextBr && !hasPrevBr) {
      br.remove();
    }
  }
  
  // Now handle remaining br sequences - replace with paragraph break marker
  // This is handled during block parsing
}

/**
 * Handle tables - remove by default, or convert to paragraphs if text-heavy
 */
function handleTables(root: HTMLElement): void {
  root.querySelectorAll('table').forEach(table => {
    const text = (table.textContent || '').trim();
    const rows = table.querySelectorAll('tr');
    
    // Simple heuristic: if table has substantial text, convert to paragraphs
    if (text.length > 200 && rows.length > 0) {
      const fragment = document.createDocumentFragment();
      rows.forEach(row => {
        const cells = row.querySelectorAll('th, td');
        if (cells.length > 0) {
          const rowText = Array.from(cells)
            .map(cell => (cell.textContent || '').trim())
            .filter(Boolean)
            .join(' | ');
          if (rowText) {
            const p = document.createElement('p');
            p.textContent = rowText;
            fragment.appendChild(p);
          }
        }
      });
      logNormalization(table, 'convert', 'table -> paragraphs');
      table.replaceWith(fragment);
    } else {
      logNormalization(table, 'remove', 'table with low text density');
      table.remove();
    }
  });
}

/**
 * Strip all presentational attributes from elements
 */
function stripPresentationalAttributes(root: HTMLElement): void {
  root.querySelectorAll('*').forEach(el => {
    const attrsToRemove: string[] = [];
    const tagName = el.tagName.toLowerCase();
    
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name;
      
      // Keep href on anchors
      if (name === 'href' && tagName === 'a') continue;
      
      // Keep class on code elements (for language detection)
      if (name === 'class' && tagName === 'code') {
        // Only keep language-* classes
        const classes = el.className.split(' ').filter(c => c.startsWith('language-'));
        if (classes.length > 0) {
          el.className = classes.join(' ');
          continue;
        }
      }
      
      attrsToRemove.push(name);
    }
    
    attrsToRemove.forEach(name => el.removeAttribute(name));
  });
}

/**
 * Classify a span element to determine what action to take
 */
interface SpanClassification {
  action: 'keep' | 'unwrap' | 'remove' | 'convert';
  reason: string;
  targetTag?: 'em' | 'strong';
}

/**
 * Check if a span has italic styling indicators
 */
function hasItalicStyling(span: Element): boolean {
  const className = (span.className || '').toLowerCase();
  
  // Check class patterns
  if (ITALIC_PATTERNS.some(p => className.includes(p))) {
    return true;
  }
  
  // Check data attributes for italic indicators
  for (const attr of Array.from(span.attributes)) {
    const name = attr.name.toLowerCase();
    const value = attr.value.toLowerCase();
    if (name.includes('italic') || value === 'italic' || value === 'emphasis') {
      return true;
    }
  }
  
  // Check inline style for font-style: italic
  const style = span.getAttribute('style') || '';
  if (style.includes('font-style') && style.includes('italic')) {
    return true;
  }
  
  return false;
}

/**
 * Check if a span has bold styling indicators
 */
function hasBoldStyling(span: Element): boolean {
  const className = (span.className || '').toLowerCase();
  
  // Check class patterns
  if (BOLD_PATTERNS.some(p => className.includes(p))) {
    return true;
  }
  
  // Check data attributes for bold indicators
  for (const attr of Array.from(span.attributes)) {
    const name = attr.name.toLowerCase();
    const value = attr.value.toLowerCase();
    if (name.includes('bold') || name.includes('strong') || 
        value === 'bold' || value === 'strong') {
      return true;
    }
  }
  
  // Check inline style for font-weight: bold or 700+
  const style = span.getAttribute('style') || '';
  if (style.includes('font-weight')) {
    if (style.includes('bold') || style.includes('700') || 
        style.includes('800') || style.includes('900')) {
      return true;
    }
  }
  
  return false;
}

function classifySpan(span: Element): SpanClassification {
  const className = (span.className || '').toLowerCase();
  const id = (span.id || '').toLowerCase();
  
  // Check for non-content patterns - these should be removed entirely
  for (const pattern of NON_CONTENT_SPAN_PATTERNS) {
    if (className.includes(pattern) || id.includes(pattern)) {
      return { action: 'remove', reason: `matches non-content pattern: ${pattern}` };
    }
  }
  
  // Check for italic styling - convert to <em>
  if (hasItalicStyling(span)) {
    return { action: 'convert', targetTag: 'em', reason: 'italic span detected' };
  }
  
  // Check for bold styling - convert to <strong>
  if (hasBoldStyling(span)) {
    return { action: 'convert', targetTag: 'strong', reason: 'bold span detected' };
  }
  
  // Check if inside a semantic inline element (keep structure)
  const isInsideSemantic = span.closest('a, strong, em, code') !== null;
  if (isInsideSemantic) {
    return { action: 'unwrap', reason: 'inside semantic element' };
  }
  
  // Default: unwrap (preserve children, remove span wrapper)
  return { action: 'unwrap', reason: 'no semantic value' };
}

/**
 * Process all spans according to classification rules
 */
function processSpans(root: HTMLElement): void {
  // Process iteratively since unwrapping can change DOM structure
  let iterations = 0;
  const maxIterations = 50; // Safety limit
  
  while (iterations < maxIterations) {
    const spans = root.querySelectorAll('span');
    if (spans.length === 0) break;
    
    let changed = false;
    
    // Process from deepest to shallowest (reverse order works for most cases)
    Array.from(spans).reverse().forEach(span => {
      if (!span.parentElement) return; // Already removed
      if (isInsideCode(span)) return; // Preserve code content
      
      const classification = classifySpan(span);
      
      if (debugEnabled) {
        logNormalization(span, classification.action, classification.reason);
      }
      
      if (classification.action === 'remove') {
        span.remove();
        changed = true;
      } else if (classification.action === 'convert' && classification.targetTag) {
        // Convert span to semantic element (em or strong)
        const newElement = document.createElement(classification.targetTag);
        newElement.innerHTML = span.innerHTML;
        span.replaceWith(newElement);
        changed = true;
      } else if (classification.action === 'unwrap') {
        unwrapElement(span);
        changed = true;
      }
    });
    
    if (!changed) break;
    iterations++;
  }
}

/**
 * Unwrap container elements (div, section, article, main, font, center)
 */
function unwrapContainers(root: HTMLElement): void {
  // Process iteratively since unwrapping can expose more containers
  let iterations = 0;
  const maxIterations = 50; // Safety limit
  
  const containerSelector = Array.from(WRAPPER_TAGS)
    .filter(tag => tag !== 'span') // spans handled separately
    .join(', ');
  
  while (iterations < maxIterations) {
    const containers = root.querySelectorAll(containerSelector);
    if (containers.length === 0) break;
    
    let changed = false;
    
    // Process from deepest to shallowest
    Array.from(containers).reverse().forEach(container => {
      if (!container.parentElement) return; // Already removed
      if (isInsideCode(container)) return; // Preserve code content
      
      logNormalization(container, 'unwrap', 'container element');
      unwrapElement(container);
      changed = true;
    });
    
    if (!changed) break;
    iterations++;
  }
}

/**
 * Normalize whitespace in text nodes
 */
function normalizeWhitespace(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  
  let node = walker.nextNode();
  while (node) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }
  
  for (const textNode of textNodes) {
    // Skip nodes inside pre/code
    if (textNode.parentElement?.closest('pre, code')) continue;
    
    if (textNode.textContent) {
      // Collapse repeated whitespace to single space
      textNode.textContent = textNode.textContent.replace(/\s+/g, ' ');
    }
  }
  
  // Trim leading/trailing whitespace from block elements (except pre/code)
  const blockSelector = Array.from(ALLOWED_BLOCK_TAGS)
    .filter(tag => tag !== 'pre' && tag !== 'code')
    .join(', ');
  root.querySelectorAll(blockSelector).forEach(el => {
    // Skip if inside pre or code
    if (el.closest('pre, code')) return;
    
    const first = el.firstChild;
    const last = el.lastChild;
    
    if (first?.nodeType === Node.TEXT_NODE && first.textContent) {
      first.textContent = first.textContent.replace(/^\s+/, '');
    }
    if (last?.nodeType === Node.TEXT_NODE && last.textContent) {
      last.textContent = last.textContent.replace(/\s+$/, '');
    }
  });
}

/**
 * Remove elements that shouldn't be in article content
 */
function removeNonContentElements(root: HTMLElement): void {
  // Remove script, style, template, etc.
  const selectors = [
    'script', 'style', 'template', 'noscript', 'link', 'meta',
    'input', 'textarea', 'button', 'select', 'option',
  ];
  
  selectors.forEach(selector => {
    root.querySelectorAll(selector).forEach(el => el.remove());
  });
}

/**
 * Main normalization function - produces minimal, predictable markup.
 * 
 * @param root - The root element containing article HTML (usually document.body)
 */
export function normalizeArticleMarkup(root: HTMLElement): void {
  if (debugEnabled) {
    console.log('[FlowReader Normalize] Starting normalization');
    normalizationLogs.length = 0;
  }

  // 1. Remove non-content elements (script, style, etc.)
  removeNonContentElements(root);

  // 2. Remove h1 (title comes from metadata)
  removeH1Elements(root);

  // 3. Normalize heading levels (h4-h6 -> h3)
  normalizeHeadingLevels(root);

  // 4. Normalize semantic tags (b -> strong, i -> em)
  normalizeSemanticTags(root);

  // 5. Clean anchors without valid href
  cleanAnchors(root);

  // 6. Handle tables (remove or convert to paragraphs)
  handleTables(root);

  // 7. Normalize br elements
  normalizeBrElements(root);

  // 8. Process spans (remove non-content, unwrap presentational)
  processSpans(root);

  // 9. Unwrap container elements (div, section, article, main)
  unwrapContainers(root);

  // 10. Strip presentational attributes (style, class, id, etc.)
  stripPresentationalAttributes(root);

  // 11. Normalize whitespace
  normalizeWhitespace(root);

  if (debugEnabled) {
    console.log(`[FlowReader Normalize] Completed. ${normalizationLogs.length} normalizations.`);
  }
}
