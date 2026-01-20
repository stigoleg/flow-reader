/**
 * ExportDropdown Component
 * 
 * Reusable dropdown for exporting and importing annotations in various formats.
 * Copies the exported content to clipboard.
 */

import { useState, useRef, useEffect } from 'react';
import type { Annotation } from '@/types';
import { 
  exportAnnotations, 
  copyToClipboard, 
  downloadAsFile,
  getFileInfoForFormat,
  promptImportFile,
  type ExportFormat 
} from '@/lib/annotations-export';

interface ExportDropdownProps {
  annotations: Annotation[];
  documentTitle: string;
  buttonClassName?: string;
  /** Callback when annotations are imported. Receives the imported data. */
  onImport?: (data: { text: string; note: string | null; color: string; isFavorite?: boolean; tags?: string[]; createdAt: string }[]) => Promise<{ imported: number; skipped: number }>;
}

const EXPORT_OPTIONS: { format: ExportFormat; label: string; description: string }[] = [
  { format: 'markdown', label: 'Markdown', description: 'Formatted with headers and quotes' },
  { format: 'text', label: 'Plain Text', description: 'Simple text format' },
  { format: 'json', label: 'JSON', description: 'Structured data format' },
  { format: 'html', label: 'HTML', description: 'Styled page with colors' },
];

type ExportAction = 'copy' | 'download';

export default function ExportDropdown({
  annotations,
  documentTitle,
  buttonClassName = '',
  onImport,
}: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ExportAction>('copy');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasAnnotations = annotations.length > 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close dropdown on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleExport = async (format: ExportFormat, action: ExportAction) => {
    const exported = exportAnnotations(annotations, documentTitle, format);
    
    if (action === 'copy') {
      const success = await copyToClipboard(exported);
      
      if (success) {
        setCopied(true);
        setIsOpen(false);
        setTimeout(() => setCopied(false), 1500);
      }
    } else {
      // Download as file
      const { extension, mimeType } = getFileInfoForFormat(format);
      const safeTitle = documentTitle.replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 50);
      const filename = `${safeTitle || 'highlights'}-highlights.${extension}`;
      
      downloadAsFile(exported, filename, mimeType);
      setDownloaded(true);
      setIsOpen(false);
      setTimeout(() => setDownloaded(false), 1500);
    }
  };

  const handleImport = async () => {
    if (!onImport) return;
    
    const result = await promptImportFile();
    if (!result) {
      setImportStatus('Invalid file');
      setIsOpen(false);
      setTimeout(() => setImportStatus(null), 2000);
      return;
    }
    
    const { data } = result;
    const importResult = await onImport(data.annotations);
    
    setImportStatus(`Imported ${importResult.imported}${importResult.skipped > 0 ? `, ${importResult.skipped} skipped` : ''}`);
    setIsOpen(false);
    setTimeout(() => setImportStatus(null), 2500);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors hover:bg-reader-text/10 ${buttonClassName}`}
        title="Export/Import annotations"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {copied ? (
          <>
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-500">Copied!</span>
          </>
        ) : downloaded ? (
          <>
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-500">Downloaded!</span>
          </>
        ) : importStatus ? (
          <>
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-500">{importStatus}</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Export
            <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-56 rounded-lg shadow-lg border border-reader-text/10 overflow-hidden z-50"
          style={{ backgroundColor: 'var(--reader-bg)' }}
          role="menu"
        >
          {/* Action toggle */}
          <div className="flex border-b border-reader-text/10">
            <button
              onClick={() => setActiveAction('copy')}
              className={`flex-1 px-3 py-2 text-sm transition-colors ${
                activeAction === 'copy' ? 'bg-reader-text/10 font-medium' : 'opacity-60 hover:opacity-100'
              }`}
            >
              Copy
            </button>
            <button
              onClick={() => setActiveAction('download')}
              className={`flex-1 px-3 py-2 text-sm transition-colors ${
                activeAction === 'download' ? 'bg-reader-text/10 font-medium' : 'opacity-60 hover:opacity-100'
              }`}
            >
              Download
            </button>
          </div>
          
          {/* Format options */}
          {hasAnnotations && EXPORT_OPTIONS.map(option => (
            <button
              key={option.format}
              onClick={() => handleExport(option.format, activeAction)}
              className="w-full text-left px-3 py-2 hover:bg-reader-text/10 transition-colors"
              role="menuitem"
            >
              <div className="text-sm font-medium">{option.label}</div>
              <div className="text-xs opacity-60">{option.description}</div>
            </button>
          ))}
          
          {!hasAnnotations && (
            <div className="px-3 py-2 text-sm opacity-60">
              No annotations to export
            </div>
          )}
          
          {/* Import option */}
          {onImport && (
            <>
              <div className="border-t border-reader-text/10 my-1" />
              <button
                onClick={handleImport}
                className="w-full text-left px-3 py-2 hover:bg-reader-text/10 transition-colors"
                role="menuitem"
              >
                <div className="text-sm font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Import from JSON
                </div>
                <div className="text-xs opacity-60">Restore from backup file</div>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
