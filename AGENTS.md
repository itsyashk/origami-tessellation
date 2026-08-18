<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Origami crease-pattern studio

Computational origami design tool — "GeoGebra/Figma for crease patterns".
Read `context/` before making product or architecture changes:

- `context/PRODUCT.md` — what this is and where it is going
- `context/ARCHITECTURE.md` — layer rules (geometry ← origami ← editor/state ← components)
- `context/INTERACTIONS.md` — exact gesture/keyboard spec
- `context/ORIGAMI_MATH.md` — the math and its tolerances
- `context/DECISIONS.md` — append an entry whenever you make a significant decision

## Hard rules

- Mathematical/geometry logic never lives in React components — it goes in
  `src/geometry/` or `src/origami/` as pure functions with unit tests.
- The document model (`src/origami/model.ts`) stays serializable and free of
  web-only concepts; it must stay portable to Swift.
- Geometry manipulation is never animated with easing; feedback lives next to
  the geometry (badges/guides), never in modal alerts.
- Analysis results are structured (status + numeric error + explanation),
  never a bare boolean.

## Commands

- `npm run dev` — dev server (localhost:3000)
- `npm run verify` — typecheck + lint + unit tests + Playwright e2e
- `node scripts/screenshot.mjs out.png [w] [h]` — screenshot the running app
- `node scripts/inspect-states.mjs <outdir>` — screenshot key interaction states
