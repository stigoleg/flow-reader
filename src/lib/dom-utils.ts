/**
 * DOM Utilities
 * 
 * Shared utilities for DOM manipulation and debugging.
 */

/**
 * Returns a CSS-like selector string for an element (for debugging purposes).
 * 
 * @example
 * describeElement(document.querySelector('div.foo#bar'))
 * // Returns: "div#bar.foo"
 */
export function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const className = el.className && typeof el.className === 'string'
    ? `.${el.className.split(' ').join('.')}`
    : '';
  return `${tag}${id}${className}`;
}
