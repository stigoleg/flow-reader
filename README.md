# FlowReader

![FlowReader Demo](docs/flowreader.png)

A Chrome extension for distraction-free reading. Extracts content from web pages, PDFs, DOCX, EPUB, and MOBI files into a clean reader view with optional pacing aids.

## Features

- **Reader Mode** - Strips clutter from any webpage, PDF, DOCX, or ebook
- **Ebook Support** - Read EPUB and MOBI/AZW files with chapter navigation
- **Pacing Mode** - Highlights words/sentences/blocks at your target WPM
- **Bionic Reading** - Bolds word beginnings to guide eye movement
- **RSVP Mode** - Rapid serial visual presentation (one word at a time)
- **Adaptive Speed** - Adjusts timing based on word complexity and punctuation
- **11 Themes** - Light, dark, sepia, e-ink, high contrast, and more

## Install

```bash
npm install
npm run build
```

Load `dist/` as an unpacked extension in Chrome:
`chrome://extensions` → Developer mode → Load unpacked

## Development

```bash
npm run dev       # Dev server with hot reload
npm run build     # Production build
npm test          # Run tests
npm run typecheck # Type check
```

## Supported Formats

| Format | Notes |
|--------|-------|
| Web pages | Uses Mozilla Readability |
| PDF | Text extraction via pdf.js |
| DOCX | Via mammoth.js |
| EPUB | EPUB2 and EPUB3, with TOC |
| MOBI/AZW/AZW3 | Basic support, no DRM |

DRM-protected ebooks are detected and rejected with a clear error message.

## Reading Modes

### Pacing

Highlights text at your reading pace. Three granularities:

| Granularity | Behavior |
|-------------|----------|
| Word | Highlights one word at a time |
| Sentence | Highlights one sentence at a time |
| Block | Highlights one paragraph at a time |

Options: background/underline/box highlighting, context dimming, reading guide, bold focus letter.

### Bionic

Bolds the first portion of each word. The eye naturally fixates on word beginnings—this reduces saccade effort and can increase reading speed.

### RSVP

Displays words one at a time in a fixed position. Eliminates eye movement entirely. Best for speed reading practice.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play/pause |
| ←/→ or J/K | Previous/next word/sentence/block |
| ↑/↓ | Adjust WPM |
| M | Cycle reading mode |
| B | Toggle bionic mode |
| G | Cycle granularity |
| [ / ] | Previous/next chapter (books) |
| T | Toggle table of contents (books) |
| ? | Show help |
| Esc | Close overlay/reader |

## Architecture

```
src/
  background/     # Service worker
  content/        # Content script (page extraction trigger)
  reader/         # Reader UI (React + Zustand)
    modes/        # Pacing, Bionic, RSVP components
    components/   # UI components
  lib/
    extraction.ts       # Content extraction orchestration
    article-cleanup.ts  # Removes nav, promos, related articles
    article-normalize.ts # Normalizes HTML to clean block structure
    bionic.ts           # Bionic text processing
    tokenizer.ts        # Word/sentence tokenization
    readability.ts      # Flesch-Kincaid, Gunning Fog, SMOG
    pdf-handler.ts      # PDF extraction (pdf.js)
    docx-handler.ts     # DOCX extraction (mammoth.js)
    epub-handler.ts     # EPUB extraction (fflate)
    mobi-handler.ts     # MOBI/AZW extraction
```

## Content Pipeline

1. **Extract** - Mozilla Readability pulls article content (or file-specific parser)
2. **Clean** - Removes leftover nav, promos, share buttons, summary boxes
3. **Normalize** - Converts to minimal HTML (p, h2, h3, ul, ol, blockquote, pre, code)
4. **Parse** - Converts HTML to block model for rendering

## Settings

Settings sync across devices via Chrome storage.

| Setting | Default |
|---------|---------|
| WPM | 300 |
| Font size | 20px |
| Line height | 1.8 |
| Column width | 680px |
| Theme | Light |

## Browser Support

Chrome 88+ (Manifest V3)

## License

MIT
