/**
 * Drop Overlay
 * 
 * Full-screen overlay shown when dragging files over the page.
 */

export default function DropOverlay() {
  return (
    <div className="drop-overlay" aria-hidden="true">
      <svg className="drop-overlay-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <p className="drop-overlay-text">Drop to import</p>
      <p className="drop-overlay-hint">PDF, DOCX, EPUB, or MOBI</p>
    </div>
  );
}
