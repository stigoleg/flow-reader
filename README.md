# FlowReader

![FlowReader Demo](docs/flowreader.png)

A Chrome extension for distraction-free reading. Extracts content from web pages and documents into a clean reader with pacing aids.

## Features

**Read anything**
- Web pages (one click or right-click menu)
- PDF, DOCX, EPUB, MOBI/AZW files
- Paste text directly or drag-and-drop files

**Reading modes**
- Pacing Mode — highlights words, sentences, or blocks at your target WPM
- Bionic Mode — bolds word beginnings to guide eye movement
- RSVP Mode — one word at a time, fixed position
- Adaptive speed adjusts for punctuation and word complexity

**Customization**
- 11 built-in themes + create your own
- 7 fonts including OpenDyslexic
- Typography controls (size, line height, column width)
- Save settings as presets

**Book features**
- Chapter navigation with table of contents
- Progress tracking per chapter
- Remembers your position

**Archive**
- Reading history with search and filtering
- Progress indicators
- Rename and delete items

**Sync**
- Cross-device sync via local folder or Dropbox
- End-to-end encryption
- Syncs settings, positions, history, and custom themes

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play/pause |
| ←/→ or J/K | Previous/next word/sentence/block |
| ↑/↓ | Adjust WPM |
| M | Cycle reading mode |
| B | Toggle bionic mode |
| G | Cycle granularity |
| [ / ] | Previous/next chapter |
| T | Toggle table of contents |
| ? | Show all shortcuts |

## Supported Formats

| Format | Notes |
|--------|-------|
| Web pages | Via Mozilla Readability |
| PDF | Text extraction via pdf.js |
| DOCX | Via mammoth.js |
| EPUB | EPUB2 and EPUB3, with TOC |
| MOBI/AZW/AZW3 | Basic support, no DRM |

DRM-protected ebooks are detected and rejected.

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
```

## License

MIT
