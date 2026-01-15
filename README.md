# FlowReader

![FlowReader Demo](docs/demo.gif)
<!-- TODO: Replace with actual screenshot or gif of the extension in action -->

A Chrome extension for faster reading with better comprehension. Strips away web clutter and presents content in a clean reader mode with optional pacing aids.

## What It Does

- **Reader Mode**: Extracts article content from any webpage, PDF, or DOCX file
- **Bionic Reading**: Bold word beginnings to guide eye movement
- **Adaptive Speed**: Automatically adjusts pacing based on text difficulty and content type
- **Multi-language**: Full support for English and Norwegian text analysis

## Install

```bash
npm install
npm run build
```

Load the `dist` folder as an unpacked extension in Chrome (`chrome://extensions` > Developer mode > Load unpacked).

## Development

```bash
npm run dev      # Start dev server with hot reload
npm run build    # Production build
npm test         # Run tests in watch mode
npm run test:run # Run tests once
npm run typecheck
```

## How It Works

### Text Analysis Pipeline

1. **Content Extraction** - Uses Mozilla Readability to pull article content from cluttered pages
2. **Language Detection** - Identifies English or Norwegian from character patterns and vocabulary
3. **Readability Scoring** - Calculates Flesch-Kincaid, Gunning Fog, and SMOG indices
4. **Speed Adjustment** - Combines all factors to suggest optimal reading pace

### Adaptive Speed

The reader adjusts word timing based on:

| Factor | Effect |
|--------|--------|
| Word frequency | Common words display faster |
| Word length | Longer words get more time |
| Syllable count | Complex pronunciation = slower |
| Punctuation | Pauses at commas, periods, etc. |

### Supported Content Types

- **Web pages** - Any article or blog post
- **PDF files** - Extracted via pdf.js
- **DOCX files** - Extracted via mammoth.js
- **Clipboard paste** - Direct text input

## Project Structure

```
src/
  background/     # Service worker for extension
  content/        # Content script injected into pages
  reader/         # Main reader UI (React + Zustand)
  lib/            # Core logic
    bionic.ts           # Bionic reading text formatting
    tokenizer.ts        # Text tokenization and timing
    readability.ts      # Readability analysis
    syllables.ts        # Multi-language syllable counting
    word-frequency.ts   # Word frequency corpus (EN/NO)
    extraction.ts       # Content extraction from pages
    pdf-handler.ts      # PDF parsing
    docx-handler.ts     # DOCX parsing
```

## Configuration

Reading settings are stored in Chrome sync storage:

| Setting | Default | Description |
|---------|---------|-------------|
| WPM | 300 | Words per minute |
| Font size | 20px | Reader text size |
| Theme | system | light, dark, sepia, system |
| Bionic mode | off | Bold word beginnings |
| Pause on punctuation | on | Extra time at sentence ends |
| Adaptive speed | off | Adjust per-word timing |

## Browser Support

Chrome 88+ (Manifest V3)

## License

MIT

## Contributing

Issues and PRs welcome. Run `npm test` before submitting.
