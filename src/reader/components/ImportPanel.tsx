import { useState, useRef, useEffect } from 'react';
import { extractFromPdf } from '@/lib/pdf-handler';
import { extractFromDocx } from '@/lib/docx-handler';
import { extractFromEpub, EpubExtractionError } from '@/lib/epub-handler';
import { extractFromMobi, MobiExtractionError } from '@/lib/mobi-handler';
import { extractFromPaste } from '@/lib/extraction';
import { isSupportedFile, getFileType } from '@/lib/file-utils';
import { getRecentDocuments } from '@/lib/storage';
import { addRecent, mapSourceToType, getSourceLabel } from '@/lib/recents-service';
import { useReaderStore } from '../store';
import type { RecentDocument, FlowDocument } from '@/types';

interface ImportProgress {
  current: number;
  total: number;
  currentFileName: string;
}

interface ImportResult {
  successCount: number;
  failed: { name: string; error: string }[];
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
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [recentDocs, setRecentDocs] = useState<RecentDocument[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load recent documents when panel opens
  useEffect(() => {
    if (isOpen) {
      getRecentDocuments().then(setRecentDocs);
      // Reset import result when opening
      setImportResult(null);
    }
  }, [isOpen]);

  // Helper to extract a single file based on type
  const extractFile = async (file: File): Promise<FlowDocument> => {
    const fileType = getFileType(file.name);
    
    switch (fileType) {
      case 'pdf':
        return await extractFromPdf(file);
      case 'docx':
        return await extractFromDocx(file);
      case 'epub':
        return await extractFromEpub(file);
      case 'mobi':
        return await extractFromMobi(file);
      default:
        throw new Error(`Unsupported file type "${file.name}"`);
    }
  };

  // Helper to get user-friendly error message
  const getErrorMessage = (err: unknown): string => {
    if (err instanceof EpubExtractionError || err instanceof MobiExtractionError) {
      if (err.errorType === 'drm-protected') {
        return 'DRM-protected';
      }
      return err.message;
    }
    return err instanceof Error ? err.message : 'Failed to import';
  };

  // Process multiple files
  const processFiles = async (files: File[]) => {
    const supportedFiles = files.filter(f => isSupportedFile(f.name));
    const unsupportedFiles = files.filter(f => !isSupportedFile(f.name));
    
    if (supportedFiles.length === 0 && unsupportedFiles.length > 0) {
      setImportError(`Unsupported file type(s). Please use PDF, DOCX, EPUB, or MOBI files.`);
      return;
    }
    
    if (supportedFiles.length === 0) return;
    
    setIsImporting(true);
    setImportError(null);
    setImportResult(null);
    
    let firstDoc: FlowDocument | null = null;
    const failed: { name: string; error: string }[] = [];
    
    // Add unsupported files to failed list
    unsupportedFiles.forEach(f => {
      failed.push({ name: f.name, error: 'Unsupported file type' });
    });
    
    for (let i = 0; i < supportedFiles.length; i++) {
      const file = supportedFiles[i];
      setImportProgress({
        current: i + 1,
        total: supportedFiles.length,
        currentFileName: file.name,
      });
      
      try {
        const doc = await extractFile(file);
        
        // Add to archive
        await addRecent({
          type: mapSourceToType(doc.metadata.source),
          title: doc.metadata.title,
          author: doc.metadata.author,
          sourceLabel: getSourceLabel(doc.metadata),
          url: doc.metadata.url,
          fileHash: doc.metadata.fileHash,
          cachedDocument: doc,
        });
        
        // Keep first successfully imported document
        if (!firstDoc) {
          firstDoc = doc;
        }
      } catch (err) {
        failed.push({ name: file.name, error: getErrorMessage(err) });
      }
    }
    
    setImportProgress(null);
    setIsImporting(false);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Handle results
    const successCount = supportedFiles.length - (failed.length - unsupportedFiles.length);
    
    if (firstDoc) {
      // Open the first successfully imported document
      setDocument(firstDoc);
      
      if (failed.length > 0) {
        // Show result summary before closing (will be visible briefly)
        setImportResult({ successCount, failed });
        // Still close and open reader, but with a slight delay to show the result
        setTimeout(() => onClose(), 1500);
      } else {
        onClose();
      }
    } else if (failed.length > 0) {
      // All failed - show errors
      if (failed.length === 1) {
        setImportError(`Failed to import "${failed[0].name}": ${failed[0].error}`);
      } else {
        setImportResult({ successCount: 0, failed });
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    await processFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    await processFiles(files);
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

          {/* Import results (for multiple files with some failures) */}
          {importResult && (
            <div className="mb-4 p-3 rounded-lg text-sm"
              style={{
                backgroundColor: importResult.successCount > 0 
                  ? 'rgba(34, 197, 94, 0.1)' 
                  : 'rgba(220, 38, 38, 0.1)',
                color: 'var(--reader-text)',
                border: `1px solid ${importResult.successCount > 0 
                  ? 'rgba(34, 197, 94, 0.3)' 
                  : 'rgba(220, 38, 38, 0.3)'}`,
              }}
              role="status"
            >
              {importResult.successCount > 0 && (
                <p className="mb-1">Imported {importResult.successCount} file{importResult.successCount !== 1 ? 's' : ''} successfully.</p>
              )}
              {importResult.failed.length > 0 && (
                <div>
                  <p className="font-medium">Failed to import {importResult.failed.length} file{importResult.failed.length !== 1 ? 's' : ''}:</p>
                  <ul className="mt-1 ml-4 list-disc">
                    {importResult.failed.slice(0, 5).map((f, i) => (
                      <li key={i} className="opacity-80">{f.name}: {f.error}</li>
                    ))}
                    {importResult.failed.length > 5 && (
                      <li className="opacity-60">...and {importResult.failed.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* File upload */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-2 opacity-80" id="upload-label">Upload Files</h3>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer"
              style={{
                borderColor: 'rgba(128, 128, 128, 0.4)',
              }}
              onMouseEnter={(e) => !isImporting && (e.currentTarget.style.borderColor = 'var(--reader-link)')}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(128, 128, 128, 0.4)'}
              onClick={() => !isImporting && fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              aria-labelledby="upload-label"
              onKeyDown={(e) => e.key === 'Enter' && !isImporting && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.epub,.mobi,.azw,.azw3"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                aria-label="Select files to upload"
              />
              {isImporting ? (
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: 'var(--reader-link)' }} />
                  {importProgress ? (
                    <>
                      <span>Importing {importProgress.current} of {importProgress.total}...</span>
                      <span className="text-sm opacity-60 truncate max-w-full">{importProgress.currentFileName}</span>
                    </>
                  ) : (
                    <span>Importing...</span>
                  )}
                </div>
              ) : (
                <>
                  <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="font-medium">Click to upload or drag and drop</p>
                  <p className="text-sm opacity-60 mt-1">PDF, DOCX, EPUB, or MOBI files (multiple allowed)</p>
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
