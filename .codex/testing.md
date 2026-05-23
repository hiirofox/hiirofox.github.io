# Testing

Date: 2026-05-23
Executor: Codex

## Planned Verification

- Confirm `header.html` contains the new Dirtynth navigation link.
- Confirm the target `products/dirtynth-online/index.html` exists.
- Inspect `git diff` for a scoped navigation-only change.

## Results

- `rg -n "dirtynth-online|Dirtynth|enola-online" header.html`
  - Found Enola at line 22 and Dirtynth at line 23.
- `Test-Path products\dirtynth-online\index.html`
  - Returned `True`.
- `git diff -- header.html .codex/context-scan.json .codex/operations-log.md .codex/testing.md verification.md`
  - Confirmed the functional code change is one new Products dropdown link.

## SharedArrayBuffer Follow-Up

- `Invoke-WebRequest -Uri http://localhost:8080/ -UseBasicParsing -TimeoutSec 3`
  - Returned `200 OK`.
  - Confirmed response headers include `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, and `Cross-Origin-Resource-Policy: same-origin`.
- Browser opened to `http://localhost:8080/`.
- Updated `header.html` so Dirtynth opens through the local `server.js` endpoint instead of the static HTML path.

## Static GitHub Pages Conversion

- `node --check products\dirtynth-online\app.js`
  - Passed.
- `node --check products\dirtynth-online\coi-bootstrap.js`
  - Passed.
- `node --check products\dirtynth-online\coi-serviceworker.js`
  - Passed.
- Static preset manifest validation
  - `products/dirtynth-online/presets.json` lists 6 files.
  - All 6 files exist under `products/dirtynth-online/presets`.
  - `app.js` no longer contains fallback preset code.
- Plain static server smoke test on `http://localhost:8091/products/dirtynth-online/index.html`
  - `index.html` returned `200 OK` without server COOP/COEP headers.
  - `presets.json` returned `200 OK`.
  - Browser page loaded 6 preset options and showed `Ready. Press Start Audio.`
  - Codex in-app browser did not expose Service Worker control, so full `crossOriginIsolated` verification should be completed in a normal browser after GitHub Pages deployment.
