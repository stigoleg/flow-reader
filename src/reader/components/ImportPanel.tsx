import { useState, useRef, useEffect } from 'react';
import { extractFromPdf } from '@/lib/pdf-handler';
import { extractFromDocx } from '@/lib/docx-handler';
import { extractFromEpub, EpubExtractionError } from '@/lib/epub-handler';
import { extractFromMobi, MobiExtractionError } from '@/lib/mobi-handler';
import { extractFromPaste } from '@/lib/extraction';
import { getRecentDocuments } from '@/lib/storage';
import { useReaderStore } from '../store';
import type { RecentDocument } from '@/types';

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.epub', '.mobi', '.azw', '.azw3'];

function isSupportedFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function getFileType(filename: string): 'pdf' | 'docx' | 'epub' | 'mobi' | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.epub')) return 'epub';
  if (lower.endsWith('.mobi') || lower.endsWith('.azw') || lower.endsWith('.azw3')) return 'mobi';
  return null;
}

interface ImportPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportPanel({ isOpen, onClose }: ImportPanelProps) {
  const { setDocument } = useReaderStore();
  const [pasteText, setPasteText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [recentDocs, setRecentDocs] = useState<RecentDocument[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load recent documents when panel opens
  useEffect(() => {
    if (isOpen) {
      getRecentDocuments().then(setRecentDocs);
    }
  }, [isOpen]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError(null);

    try {
      const fileType = getFileType(file.name);
      let doc;

      switch (fileType) {
        case 'pdf':
          doc = await extractFromPdf(file);
          break;
        case 'docx':
          doc = await extractFromDocx(file);
          break;
        case 'epub':
          doc = await extractFromEpub(file);
          break;
        case 'mobi':
          doc = await extractFromMobi(file);
          break;
        default:
          throw new Error('Unsupported file type. Please use PDF, DOCX, EPUB, or MOBI files.');
      }

      setDocument(doc);
      onClose();
    } catch (err) {
      // Handle specific error types with better messages
      if (err instanceof EpubExtractionError || err instanceof MobiExtractionError) {
        if (err.errorType === 'drm-protected') {
          setImportError('This file is DRM-protected. FlowReader only supports DRM-free e-books. Please use a DRM-free version of this book.');
        } else {
          setImportError(err.message);
        }
      } else {
        setImportError(err instanceof Error ? err.message : 'Failed to import file');
      }
    } finally {
      setIsImporting(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Check if it's a supported file type
    if (!isSupportedFile(file.name)) {
      setImportError('Unsupported file type. Please use PDF, DOCX, EPUB, or MOBI files.');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const fileType = getFileType(file.name);
      let doc;

      switch (fileType) {
        case 'pdf':
          doc = await extractFromPdf(file);
          break;
        case 'docx':
          doc = await extractFromDocx(file);
          break;
        case 'epub':
          doc = await extractFromEpub(file);
          break;
        case 'mobi':
          doc = await extractFromMobi(file);
          break;
        default:
          throw new Error('Unsupported file type');
      }

      setDocument(doc);
      onClose();
    } catch (err) {
      // Handle specific error types with better messages
      if (err instanceof EpubExtractionError || err instanceof MobiExtractionError) {
        if (err.errorType === 'drm-protected') {
          setImportError('This file is DRM-protected. FlowReader only supports DRM-free e-books.');
        } else {
          setImportError(err.message);
        }
      } else {
        setImportError(err instanceof Error ? err.message : 'Failed to import file');
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleRecentDocClick = async (doc: RecentDocument) => {
    setImportError(null);
    
    // If we have a cached document, use it directly
    if (doc.cachedDocument) {
      setDocument(doc.cachedDocument);
      onClose();
      return;
    }
    
    // For web documents, try to re-extract from URL
    if (doc.url && doc.source === 'web') {
      setIsImporting(true);
      try {
        const response = await chrome.runtime.sendMessage({ 
          type: 'EXTRACT_FROM_URL', 
          url: doc.url 
        });
        
        if (response?.error) {
          setImportError(`Failed to reload: ${response.error}. Try visiting the original page.`);
        } else if (response) {
          setDocument(response);
          onClose();
        } else {
          setImportError('Failed to reload content. Try visiting the original page.');
        }
      } catch {
        setImportError('Failed to reload content. Try visiting the original page.');
      } finally {
        setIsImporting(false);
      }
      return;
    }
    
    // For selection or other sources without cached content
    setImportError('This document cannot be reopened. Please import it again.');
  };

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;

    const doc = extractFromPaste(pasteText);
    setDocument(doc);
    setPasteText('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div 
        className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg rounded-xl shadow-2xl z-50 overflow-hidden"
        style={{
          backgroundColor: 'var(--reader-bg)',
          color: 'var(--reader-text)',
          border: '1px solid rgba(128, 128, 128, 0.3)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 id="import-dialog-title" className="text-xl font-semibold">Import Content</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Close import dialog"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Error message */}
          {importError && (
            <div className="mb-4 p-3 rounded-lg text-sm"
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                color: 'var(--reader-text)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
              }}
              role="alert"
            >
              {importError}
            </div>
          )}

          {/* File upload */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-2 opacity-80" id="upload-label">Upload File</h3>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer"
              style={{
                borderColor: 'rgba(128, 128, 128, 0.4)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--reader-link)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(128, 128, 128, 0.4)'}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              aria-labelledby="upload-label"
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.epub,.mobi,.azw,.azw3"
                onChange={handleFileSelect}
                className="hidden"
                aria-label="Select file to upload"
              />
              {isImporting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: 'var(--reader-link)' }} />
                  <span>Importing...</span>
                </div>
              ) : (
                <>
                  <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="font-medium">Click to upload or drag and drop</p>
                  <p className="text-sm opacity-60 mt-1">PDF, DOCX, EPUB, or MOBI files</p>
                </>
              )}
            </div>
            <p className="text-xs opacity-50 mt-2">
              Scanned PDFs without a text layer and DRM-protected e-books are not supported.
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(128, 128, 128, 0.3)' }} />
            <span className="text-sm opacity-50">or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(128, 128, 128, 0.3)' }} />
          </div>

          {/* Paste text */}
          <div>
            <h3 className="text-sm font-medium mb-2 opacity-80" id="paste-label">Paste Text</h3>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your text here..."
              className="w-full h-32 p-3 rounded-lg resize-none focus:outline-none focus:ring-2 transition-colors"
              style={{
                backgroundColor: 'var(--reader-bg)',
                color: 'var(--reader-text)',
                border: '1px solid rgba(128, 128, 128, 0.3)',
              }}
              onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 2px var(--reader-link)'}
              onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
              aria-labelledby="paste-label"
            />
            <button
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim()}
              className="mt-2 w-full py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--reader-link)',
                color: '#ffffff',
              }}
            >
              Start Reading
            </button>
          </div>

          {/* Recent Documents */}
          {recentDocs.length > 0 && (
            <>
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(128, 128, 128, 0.3)' }} />
                <span className="text-sm opacity-50">Recent</span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(128, 128, 128, 0.3)' }} />
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {recentDocs.slice(0, 5).map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => handleRecentDocClick(doc)}
                    className="w-full text-left p-3 rounded-lg transition-colors"
                    style={{
                      backgroundColor: 'rgba(128, 128, 128, 0.1)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(128, 128, 128, 0.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(128, 128, 128, 0.1)'}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center opacity-60" 
                        style={{ backgroundColor: 'rgba(128, 128, 128, 0.2)' }}>
                        {doc.source === 'web' ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                          </svg>
                        ) : doc.source === 'pdf' ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        ) : doc.source === 'epub' || doc.source === 'mobi' ? (
                          // Book icon for e-books
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.title}</p>
                        <p className="text-xs opacity-50 truncate">{doc.preview}</p>
                        <p className="text-xs opacity-40 mt-1">
                          {new Date(doc.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
