import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the zip-adapter module
const mockLoadText = vi.fn();
const mockLoadBlob = vi.fn();
const mockListFiles = vi.fn();

vi.mock('@/lib/zip-adapter', () => ({
  createZipLoader: vi.fn().mockImplementation(async () => ({
    entries: [],
    loadText: mockLoadText,
    loadBlob: mockLoadBlob,
    listFiles: mockListFiles,
    getSize: vi.fn().mockReturnValue(100),
  })),
}));

// Mock file-utils for hash computation
vi.mock('@/lib/file-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/file-utils')>();
  return {
    ...actual,
    computeFileHash: vi.fn().mockResolvedValue('mock-hash-12345'),
  };
});

import { extractFromEpub, EpubExtractionError } from '@/lib/epub-handler';

// Helper to create mock File
function createMockFile(name: string, content: string = 'mock epub content'): File {
  const blob = new Blob([content], { type: 'application/epub+zip' });
  return new File([blob], name, { type: 'application/epub+zip' });
}

// Standard EPUB structure mocks
const CONTAINER_XML = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const CONTENT_OPF = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book Title</dc:title>
    <dc:creator>Test Author</dc:creator>
    <dc:language>en</dc:language>
    <dc:publisher>Test Publisher</dc:publisher>
    <dc:date>2024-01-15</dc:date>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="toc">
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
  </spine>
</package>`;

const TOC_NCX = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap>
    <navPoint id="ch1" playOrder="1">
      <navLabel><text>Chapter One</text></navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
    <navPoint id="ch2" playOrder="2">
      <navLabel><text>Chapter Two</text></navLabel>
      <content src="chapter2.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`;

const CHAPTER1_XHTML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body>
  <h1>Chapter One</h1>
  <p>This is the first paragraph of the first chapter with enough content to pass the word count threshold.</p>
  <p>Here is another paragraph with some more interesting text to read.</p>
</body>
</html>`;

const CHAPTER2_XHTML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 2</title></head>
<body>
  <h1>Chapter Two</h1>
  <p>This is the second chapter, which continues the story with additional content.</p>
  <p>More text here in the second chapter to ensure proper extraction.</p>
</body>
</html>`;

describe('EPUB Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListFiles.mockReturnValue([
      'META-INF/container.xml',
      'OEBPS/content.opf',
      'OEBPS/toc.ncx',
      'OEBPS/chapter1.xhtml',
      'OEBPS/chapter2.xhtml',
    ]);
  });

  describe('extractFromEpub', () => {
    it('extracts content from a valid EPUB file', async () => {
      mockLoadText.mockImplementation(async (path: string) => {
        if (path.includes('container.xml')) return CONTAINER_XML;
        if (path.includes('content.opf')) return CONTENT_OPF;
        if (path.includes('toc.ncx')) return TOC_NCX;
        if (path.includes('chapter1.xhtml')) return CHAPTER1_XHTML;
        if (path.includes('chapter2.xhtml')) return CHAPTER2_XHTML;
        throw new Error(`File not found: ${path}`);
      });

      const file = createMockFile('test-book.epub');
      const doc = await extractFromEpub(file);

      expect(doc.metadata.source).toBe('epub');
      expect(doc.metadata.title).toBe('Test Book Title');
      expect(doc.metadata.author).toBe('Test Author');
      expect(doc.metadata.language).toBe('en');
      expect(doc.metadata.publisher).toBe('Test Publisher');
      expect(doc.blocks.length).toBeGreaterThan(0);
      expect(doc.book).toBeDefined();
      expect(doc.book?.chapters.length).toBe(2);
    });

    it('extracts title from metadata', async () => {
      mockLoadText.mockImplementation(async (path: string) => {
        if (path.includes('container.xml')) return CONTAINER_XML;
        if (path.includes('content.opf')) return CONTENT_OPF;
        if (path.includes('toc.ncx')) return TOC_NCX;
        if (path.includes('chapter1.xhtml')) return CHAPTER1_XHTML;
        if (path.includes('chapter2.xhtml')) return CHAPTER2_XHTML;
        throw new Error(`File not found: ${path}`);
      });

      const file = createMockFile('my-ebook.epub');
      const doc = await extractFromEpub(file);

      expect(doc.metadata.title).toBe('Test Book Title');
    });

    it('falls back to filename when no metadata title', async () => {
      const opfNoTitle = CONTENT_OPF.replace('<dc:title>Test Book Title</dc:title>', '');
      
      mockLoadText.mockImplementation(async (path: string) => {
        if (path.includes('container.xml')) return CONTAINER_XML;
        if (path.includes('content.opf')) return opfNoTitle;
        if (path.includes('toc.ncx')) return TOC_NCX;
        if (path.includes('chapter1.xhtml')) return CHAPTER1_XHTML;
        if (path.includes('chapter2.xhtml')) return CHAPTER2_XHTML;
        throw new Error(`File not found: ${path}`);
      });

      const file = createMockFile('fallback-title.epub');
      const doc = await extractFromEpub(file);

      expect(doc.metadata.title).toBe('fallback-title');
    });

    it('parses TOC from NCX file', async () => {
      mockLoadText.mockImplementation(async (path: string) => {
        if (path.includes('container.xml')) return CONTAINER_XML;
        if (path.includes('content.opf')) return CONTENT_OPF;
        if (path.includes('toc.ncx')) return TOC_NCX;
        if (path.includes('chapter1.xhtml')) return CHAPTER1_XHTML;
        if (path.includes('chapter2.xhtml')) return CHAPTER2_XHTML;
        throw new Error(`File not found: ${path}`);
      });

      const file = createMockFile('toc-test.epub');
      const doc = await extractFromEpub(file);

      expect(doc.book?.toc).toBeDefined();
      expect(doc.book?.toc.length).toBeGreaterThan(0);
    });

    it('creates book structure with chapters', async () => {
      mockLoadText.mockImplementation(async (path: string) => {
        if (path.includes('container.xml')) return CONTAINER_XML;
        if (path.includes('content.opf')) return CONTENT_OPF;
        if (path.includes('toc.ncx')) return TOC_NCX;
        if (path.includes('chapter1.xhtml')) return CHAPTER1_XHTML;
        if (path.includes('chapter2.xhtml')) return CHAPTER2_XHTML;
        throw new Error(`File not found: ${path}`);
      });

      const file = createMockFile('chapters-test.epub');
      const doc = await extractFromEpub(file);

      expect(doc.book).toBeDefined();
      expect(doc.book?.chapters).toHaveLength(2);
      expect(doc.book?.chapters[0].title).toBe('Chapter One');
      expect(doc.book?.chapters[1].title).toBe('Chapter Two');
    });

    it('sets createdAt timestamp', async () => {
      mockLoadText.mockImplementation(async (path: string) => {
        if (path.includes('container.xml')) return CONTAINER_XML;
        if (path.includes('content.opf')) return CONTENT_OPF;
        if (path.includes('toc.ncx')) return TOC_NCX;
        if (path.includes('chapter1.xhtml')) return CHAPTER1_XHTML;
        if (path.includes('chapter2.xhtml')) return CHAPTER2_XHTML;
        throw new Error(`File not found: ${path}`);
      });

      const before = Date.now();
      const file = createMockFile('timestamp-test.epub');
      const doc = await extractFromEpub(file);
      const after = Date.now();

      expect(doc.metadata.createdAt).toBeGreaterThanOrEqual(before);
      expect(doc.metadata.createdAt).toBeLessThanOrEqual(after);
    });

    it('includes fileHash in metadata', async () => {
      mockLoadText.mockImplementation(async (path: string) => {
        if (path.includes('container.xml')) return CONTAINER_XML;
        if (path.includes('content.opf')) return CONTENT_OPF;
        if (path.includes('toc.ncx')) return TOC_NCX;
        if (path.includes('chapter1.xhtml')) return CHAPTER1_XHTML;
        if (path.includes('chapter2.xhtml')) return CHAPTER2_XHTML;
        throw new Error(`File not found: ${path}`);
      });

      const file = createMockFile('hash-test.epub');
      const doc = await extractFromEpub(file);

      expect(doc.metadata.fileHash).toBe('mock-hash-12345');
    });

    it('generates plainText for each chapter', async () => {
      mockLoadText.mockImplementation(async (path: string) => {
        if (path.includes('container.xml')) return CONTAINER_XML;
        if (path.includes('content.opf')) return CONTENT_OPF;
        if (path.includes('toc.ncx')) return TOC_NCX;
        if (path.includes('chapter1.xhtml')) return CHAPTER1_XHTML;
        if (path.includes('chapter2.xhtml')) return CHAPTER2_XHTML;
        throw new Error(`File not found: ${path}`);
      });

      const file = createMockFile('plaintext-test.epub');
      const doc = await extractFromEpub(file);

      expect(doc.plainText).toBeDefined();
      expect(typeof doc.plainText).toBe('string');
      expect(doc.plainText.length).toBeGreaterThan(0);
      
      expect(doc.book?.chapters[0].plainText).toBeDefined();
      expect(doc.book?.chapters[1].plainText).toBeDefined();
    });

    it('assigns word counts to chapters', async () => {
      mockLoadText.mockImplementation(async (path: string) => {
        if (path.includes('container.xml')) return CONTAINER_XML;
        if (path.includes('content.opf')) return CONTENT_OPF;
        if (path.includes('toc.ncx')) return TOC_NCX;
        if (path.includes('chapter1.xhtml')) return CHAPTER1_XHTML;
        if (path.includes('chapter2.xhtml')) return CHAPTER2_XHTML;
        throw new Error(`File not found: ${path}`);
      });

      const file = createMockFile('wordcount-test.epub');
      const doc = await extractFromEpub(file);

      expect(doc.book?.chapters[0].wordCount).toBeGreaterThan(0);
      expect(doc.book?.chapters[1].wordCount).toBeGreaterThan(0);
    });
  });

  describe('DRM detection', () => {
    it('detects DRM-protected EPUB files', async () => {
      const encryptionXml = `<?xml version="1.0"?>
<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <EncryptedData xmlns="http://www.w3.org/2001/04/xmlenc">
    <EncryptionMethod Algorithm="http://ns.adobe.com/adept"/>
    <CipherData>
      <CipherReference URI="OEBPS/chapter1.xhtml"/>
    </CipherData>
  </EncryptedData>
</encryption>`;

      mockLoadText.mockImplementation(async (path: string) => {
        if (path.includes('encryption.xml')) return encryptionXml;
        if (path.includes('container.xml')) return CONTAINER_XML;
        if (path.includes('content.opf')) return CONTENT_OPF;
        throw new Error(`File not found: ${path}`);
      });

      const file = createMockFile('drm-protected.epub');
      
      await expect(extractFromEpub(file)).rejects.toThrow(EpubExtractionError);
      await expect(extractFromEpub(file)).rejects.toThrow('DRM-protected');
    });

    it('allows EPUBs with font obfuscation (not DRM)', async () => {
      // Font obfuscation is allowed - it only encrypts font files, not content
      const encryptionXml = `<?xml version="1.0"?>
<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <EncryptedData>
    <EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/>
    <CipherReference URI="OEBPS/fonts/font.otf"/>
  </EncryptedData>
</encryption>`;

      mockLoadText.mockImplementation(async (path: string) => {
        if (path.includes('encryption.xml')) return encryptionXml;
        if (path.includes('container.xml')) return CONTAINER_XML;
        if (path.includes('content.opf')) return CONTENT_OPF;
        if (path.includes('toc.ncx')) return TOC_NCX;
        if (path.includes('chapter1.xhtml')) return CHAPTER1_XHTML;
        if (path.includes('chapter2.xhtml')) return CHAPTER2_XHTML;
        throw new Error(`File not found: ${path}`);
      });

      const file = createMockFile('font-obfuscated.epub');
      const doc = await extractFromEpub(file);

      // Should succeed - font obfuscation is not DRM
      expect(doc.metadata.title).toBe('Test Book Title');
    });
  });

  describe('error handling', () => {
    it('throws error for invalid EPUB (missing container.xml and no .opf)', async () => {
      mockListFiles.mockReturnValue(['some-random-file.txt']);
      mockLoadText.mockRejectedValue(new Error('File not found'));

      const file = createMockFile('invalid.epub');
      
      await expect(extractFromEpub(file)).rejects.toThrow(EpubExtractionError);
      await expect(extractFromEpub(file)).rejects.toThrow('Invalid EPUB');
    });

    it('throws error when no content is found', async () => {
      const emptyChapterXhtml = `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Empty</title></head>
<body></body>
</html>`;

      mockLoadText.mockImplementation(async (path: string) => {
        if (path.includes('container.xml')) return CONTAINER_XML;
        if (path.includes('content.opf')) return CONTENT_OPF;
        if (path.includes('toc.ncx')) return TOC_NCX;
        if (path.includes('chapter1.xhtml')) return emptyChapterXhtml;
        if (path.includes('chapter2.xhtml')) return emptyChapterXhtml;
        throw new Error(`File not found: ${path}`);
      });

      const file = createMockFile('empty-content.epub');
      
      await expect(extractFromEpub(file)).rejects.toThrow(EpubExtractionError);
      await expect(extractFromEpub(file)).rejects.toThrow('No readable content');
    });

    it('falls back to .opf file search when container.xml is missing', async () => {
      mockListFiles.mockReturnValue([
        'content.opf',
        'chapter1.xhtml',
        'chapter2.xhtml',
      ]);

      const opfAtRoot = CONTENT_OPF.replace('chapter1.xhtml', 'chapter1.xhtml')
        .replace('chapter2.xhtml', 'chapter2.xhtml');

      mockLoadText.mockImplementation(async (path: string) => {
        if (path.includes('container.xml')) throw new Error('File not found');
        if (path === 'content.opf') return opfAtRoot;
        if (path === 'chapter1.xhtml') return CHAPTER1_XHTML;
        if (path === 'chapter2.xhtml') return CHAPTER2_XHTML;
        throw new Error(`File not found: ${path}`);
      });

      const file = createMockFile('no-container.epub');
      const doc = await extractFromEpub(file);

      expect(doc.metadata.title).toBe('Test Book Title');
    });
  });

  describe('EPUB3 navigation', () => {
    it('parses EPUB3 nav document', async () => {
      const epub3Opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>EPUB3 Book</dc:title>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>`;

      const navXhtml = `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body>
  <nav epub:type="toc">
    <ol>
      <li><a href="chapter1.xhtml">First Chapter</a></li>
    </ol>
  </nav>
</body>
</html>`;

      mockListFiles.mockReturnValue([
        'META-INF/container.xml',
        'OEBPS/content.opf',
        'OEBPS/nav.xhtml',
        'OEBPS/chapter1.xhtml',
      ]);

      mockLoadText.mockImplementation(async (path: string) => {
        if (path.includes('container.xml')) return CONTAINER_XML;
        if (path.includes('content.opf')) return epub3Opf;
        if (path.includes('nav.xhtml')) return navXhtml;
        if (path.includes('chapter1.xhtml')) return CHAPTER1_XHTML;
        throw new Error(`File not found: ${path}`);
      });

      const file = createMockFile('epub3-nav.epub');
      const doc = await extractFromEpub(file);

      expect(doc.metadata.title).toBe('EPUB3 Book');
      expect(doc.book?.chapters.length).toBeGreaterThan(0);
    });
  });

  describe('spine handling', () => {
    it('skips non-linear spine items', async () => {
      const opfWithNonLinear = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Non-Linear Test</dc:title>
  </metadata>
  <manifest>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="cover" linear="no"/>
    <itemref idref="chapter1"/>
  </spine>
</package>`;

      mockListFiles.mockReturnValue([
        'META-INF/container.xml',
        'OEBPS/content.opf',
        'OEBPS/cover.xhtml',
        'OEBPS/chapter1.xhtml',
      ]);

      mockLoadText.mockImplementation(async (path: string) => {
        if (path.includes('container.xml')) return CONTAINER_XML;
        if (path.includes('content.opf')) return opfWithNonLinear;
        if (path.includes('cover.xhtml')) return '<html><body><p>Cover page</p></body></html>';
        if (path.includes('chapter1.xhtml')) return CHAPTER1_XHTML;
        throw new Error(`File not found: ${path}`);
      });

      const file = createMockFile('non-linear.epub');
      const doc = await extractFromEpub(file);

      // Only the linear chapter should be included
      expect(doc.book?.chapters.length).toBe(1);
      expect(doc.book?.chapters[0].title).toBe('Chapter One');
    });
  });

  describe('metadata extraction', () => {
    it('extracts all metadata fields', async () => {
      mockLoadText.mockImplementation(async (path: string) => {
        if (path.includes('container.xml')) return CONTAINER_XML;
        if (path.includes('content.opf')) return CONTENT_OPF;
        if (path.includes('toc.ncx')) return TOC_NCX;
        if (path.includes('chapter1.xhtml')) return CHAPTER1_XHTML;
        if (path.includes('chapter2.xhtml')) return CHAPTER2_XHTML;
        throw new Error(`File not found: ${path}`);
      });

      const file = createMockFile('metadata-test.epub');
      const doc = await extractFromEpub(file);

      expect(doc.metadata.title).toBe('Test Book Title');
      expect(doc.metadata.author).toBe('Test Author');
      expect(doc.metadata.language).toBe('en');
      expect(doc.metadata.publisher).toBe('Test Publisher');
      expect(doc.metadata.publishedAt).toBe('2024-01-15');
      expect(doc.metadata.fileName).toBe('metadata-test.epub');
    });
  });
});
