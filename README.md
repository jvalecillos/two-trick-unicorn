# Two-Trick Unicorn

A desktop-first Canvas 2D game for js13kGames 2026. The readable source lives in `src/`; generated submission files are ignored by Git.

## Requirements

- Node.js 22+
- npm
- `zip` and `unzip`

## Commands

- `npm install` installs development tools.
- `npm run dev` serves the readable source with Vite.
- `npm run build` creates a minified, self-contained `dist/index.html`.
- `npm run pack` builds and creates `release/two-trick-unicorn.zip`.
- `npm run size` reports the current ZIP size and remaining 13,312-byte headroom.
- `npm run check` builds, packages, validates the archive, scans for external resources, and enforces the size limit.

Roadroller and ECT/Advzip comparisons are intentionally deferred until the final compression phase.
