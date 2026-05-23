# Operations Log

- 2026-05-23 17:39 +08:00 | Codex | sequential-thinking | Analyzed request to mirror the Enola product link pattern for dirtynth-online.
- 2026-05-23 17:39 +08:00 | Codex | rg / file reads | Located Enola in `header.html` and confirmed `products/dirtynth-online/index.html` exists.
- 2026-05-23 17:39 +08:00 | Codex | apply_patch | Added Dirtynth to the shared Products dropdown, linking to `/products/dirtynth-online/index.html`.
- 2026-05-23 17:39 +08:00 | Codex | fallback note | code-index, exa, and shrimp-task-manager MCP tools were not exposed in this session; local repository search was sufficient.
- 2026-05-23 17:40 +08:00 | Codex | verification | Confirmed the Dirtynth link in `header.html`, confirmed target index exists, and reviewed diff scope.
- 2026-05-23 17:40 +08:00 | Codex | review | Generated `.codex/review-report.md` with pass recommendation.
- 2026-05-23 17:45 +08:00 | Codex | server verification | Confirmed `products/dirtynth-online/server.js` serves `http://localhost:8080/` with COOP/COEP/CORP headers for SharedArrayBuffer.
- 2026-05-23 17:45 +08:00 | Codex | apply_patch | Changed the Dirtynth Products menu link to `http://localhost:8080/` so it opens through `server.js`.
- 2026-05-23 18:05 +08:00 | Codex | sequential-thinking | Replanned Dirtynth for GitHub Pages static hosting: scoped Service Worker isolation, static preset manifest, and no fallback presets.
- 2026-05-23 18:06 +08:00 | Codex | apply_patch | Added `coi-bootstrap.js`, `coi-serviceworker.js`, and `presets.json`; changed Dirtynth navigation back to `/products/dirtynth-online/index.html`.
- 2026-05-23 18:07 +08:00 | Codex | mechanical rewrite | Removed the large built-in fallback preset block from `products/dirtynth-online/app.js`.
- 2026-05-23 18:08 +08:00 | Codex | verification | Ran JavaScript syntax checks, verified all six static preset files exist, and loaded the static page through a headerless local server.
