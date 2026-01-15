You are an expert product designer and senior browser extension engineer. Create a complete, implementation oriented specification for a Chrome Extension that helps users read faster while maintaining comprehension. The extension must work primarily as a “reader mode” overlay for web articles, and also support pasted text and imported documents.

Context and user problem
Many users read slowly, often decoding word by word. The product should help users train reading fluency during normal work reading, by presenting content in a clean reading environment and offering optional reading aids. The default aid is pacing. Bionic Reading and RSVP are optional modes.

High level product goals
1. Provide a distraction free reader mode for web pages, extracting the main article text and removing ads, navigation, cookie banners, sidebars, and other clutter.
2. Offer a reading experience that supports training: pacing by default, optional Bionic Reading, optional RSVP.
3. Allow deep typography and theme customization, plus curated eye comfort presets.
4. Provide speed controls, including gradual ramp up to a user defined cap, with fast adjustments and keyboard shortcuts.
5. Support multiple input sources: current web page, pasted text, uploaded Word or PDF, and PDF already opened in a browser tab.

Non goals
Do not build any backend service. Everything must run locally in the browser.
Do not require user accounts.

Target platforms
Chrome desktop. Specify what will and will not work on other Chromium browsers, but optimize for Chrome.

Deliverable format
Write the spec in English. Use clear sections and short paragraphs. Include enough technical detail that an engineer can start implementing immediately.

Required features and behavior

A. Reader mode for web pages
1. User flow
   - The user clicks the extension icon or uses a keyboard shortcut to enter Reader Mode on the current tab.
   - The extension extracts the main article content and displays it in an overlay or a dedicated reader tab, removing all non article elements.
   - The user can exit Reader Mode and return to the original page state.

2. Extraction requirements
   - Extract title, author if available, publication date if available, and main body text.
   - Preserve headings, paragraphs, lists, quotes, code blocks, and links.
   - Handle multi page articles if feasible, otherwise clearly state limitations.
   - Handle dynamic pages where content loads after initial render.
   - Fail gracefully: if extraction confidence is low, provide a fallback mode that uses a simplified DOM selection, or let the user highlight and “Read selection”.

3. Recommended approach
   - Use a well known readability algorithm for extracting article content (for example Mozilla Readability).
   - Explain the architecture: content script obtains DOM, passes sanitized HTML or extracted text to the extension UI.

B. Reading aids and modes
1. Pacing mode (default)
   - Implement a visual pacing guide suitable for normal reading, not RSVP.
   - Examples: a subtle moving highlight across the current line, a focus window that moves line by line, or a reading ruler that advances at a configured rate.
   - Must support pausing, resuming, stepping forward and backward, and manual repositioning to the current paragraph.
   - The pacing guide must not obscure text.

2. Bionic Reading mode (optional)
   - Implement as a text rendering transformation in the reader view.
   - Highlight the first part of each word (configurable intensity and proportion).
   - Allow the user to switch on or off instantly without losing reading position.

3. RSVP mode (optional)
   - Present words one at a time in a fixed position.
   - Provide settings for words per minute, chunking (single words vs short phrases), and pause on punctuation.
   - Provide an explicit warning or note that RSVP may reduce comprehension for long form reading, and position it as an optional training mode.

4. Mode switching
   - Switching modes must preserve the current reading position.
   - Switching modes must be instant and must not require re extraction.

C. Typography, layout, and themes
1. User adjustable settings
   - Font family, font size, line height, paragraph spacing, column width, margins.
   - Background color, text color, link color, selection color.
   - Optional toggle for justified vs ragged right text.
   - Optional toggle for hyphenation and ligatures if supported.

2. Preset modes
   - Provide at least these presets:
     - E paper simulation
     - Low contrast night mode
     - High contrast accessibility mode
     - Warm sepia
   - Presets should be editable and savable as custom presets.

3. Persistence
   - Settings must persist per device.
   - Provide an option to reset to defaults.

D. Speed controls and keyboard shortcuts
1. Speed controls
   - A single prominent speed control in reader UI.
   - Fine and coarse adjustments.
   - Show the current effective speed and the target speed.
   - Support a “ramp up” mode: speed increases gradually over time up to a user defined cap.
   - Allow ramp step size and ramp interval configuration.

2. Shortcuts
   - Provide default keyboard shortcuts and allow users to customize via Chrome extension shortcuts.
   - Must include: open reader mode, close reader mode, increase speed, decrease speed, pause resume, next paragraph or next chunk, previous paragraph or previous chunk, switch mode.

E. Input sources beyond web articles
1. Paste text
   - Provide a quick “Paste and Read” entry in the extension popup.
   - Support plain text and sanitize rich text into plain text.
   - Keep paragraphs and basic structure.

2. Upload Word and PDF
   - Provide an “Import” screen in the reader UI.
   - Word: support docx. Convert to HTML or structured text while preserving headings, lists, and paragraphs.
   - PDF: extract text if the PDF has a text layer.
   - If the PDF is scanned, explain the limitation and provide a placeholder for future OCR support without implementing it.

3. PDF already open in a tab
   - Provide a “Read this PDF” action when the current tab is a PDF.
   - If direct DOM injection is not possible, implement a workflow where the extension fetches the PDF URL and opens it in the extension reader view, using a PDF renderer (for example PDF.js) and text extraction.
   - Clearly document permissions and cross origin constraints. Implement best effort for file URLs only if feasible, and state limitations.

F. User experience details
1. Reader UI
   - Clean minimal UI.
   - A top bar with: mode selector, speed control, typography and theme button, import button, exit button.
   - A side panel or modal for advanced settings.
   - A progress indicator showing approximate progress through the text.

2. Reading position
   - Remember last position per document source.
   - For web pages, store position keyed by URL.
   - Provide “resume where I left off” for recent items.

3. Privacy
   - Do not send content anywhere.
   - Provide a clear privacy statement in the extension options page.

Technical requirements and implementation details

1. Chrome Extension architecture
   - Manifest V3.
   - Service worker background script for orchestration.
   - Content scripts for extraction and page interaction.
   - Extension UI: popup, options page, and the reader view page (either an extension page opened in a new tab, or an overlay injected into the page).

2. Recommended design choice
   - Prefer opening the reader view as an extension page in a new tab to avoid complex DOM injection conflicts, but still support an overlay option if feasible. Explain pros and cons and pick one as the default approach.

3. Permissions
   - Specify required permissions: activeTab, scripting, storage.
   - If needed for PDF fetch or broader access, propose optional host permissions and explain the tradeoff.
   - Ensure minimal permissions by default.

4. Content extraction pipeline
   - Steps: capture DOM, run Readability, sanitize output, transform into internal document model (blocks for headings, paragraphs, lists, etc), render in reader.
   - Include a fallback pipeline when Readability fails: selection based extraction, or user selection.

5. Document model
   - Define a simple internal schema:
     - metadata: title, source, url, createdAt
     - blocks: array of block objects (paragraph, heading, list, quote, code)
     - plainText: optional concatenated text for RSVP
     - position anchors: block index plus character offset

6. Rendering and transformations
   - Pacing implemented as a rendering layer, not by modifying original content blocks.
   - Bionic Reading implemented as a tokenization and styled span transformation in the reader renderer.
   - RSVP uses plainText tokens and punctuation detection.

7. Performance
   - Must handle long articles without freezing the UI.
   - Use incremental rendering or virtualization for large content.
   - Avoid expensive DOM operations on every animation frame. Use requestAnimationFrame for pacing only, and keep work minimal.

8. Storage
   - Use chrome.storage.local for settings, presets, recent documents, and reading positions.
   - Provide a storage schema and migration strategy for future versions.

9. Accessibility
   - Keyboard navigable UI.
   - Screen reader friendly for menus and settings.
   - Respect prefers reduced motion where relevant, and allow disabling pacing animation.

10. Testing
   - Unit tests for readability extraction and document transformations.
   - Integration tests for reader view and keyboard shortcuts.
   - A test corpus of diverse pages: news articles, blogs, pages with heavy scripts, and paywalled pages where extraction is limited.

Acceptance criteria
List clear acceptance criteria for each major feature area, including extraction accuracy, mode switching without position loss, settings persistence, shortcut behavior, and PDF import flows.

Provide an implementation plan
Give a staged MVP plan with milestones:
- MVP 1: web reader mode plus pacing, settings, and persistence
- MVP 2: Bionic Reading and RSVP
- MVP 3: paste and import docx and pdf with basic text extraction
- MVP 4: PDF tab integration using PDF.js reader view and better positioning

Also provide a brief risk list
Include risks like: extraction failures on certain sites, PDF viewer constraints, permissions and enterprise policies, and performance on very long documents.
