# Testing

The point of the test suite is that the closed loop stays closed: geometry in,
correct mathematics out, correct feedback on screen, undoable.

## Commands

| Command | What it runs |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (`eslint-config-next`) |
| `npm test` | Vitest once (`src/**/*.test.{ts,tsx}`, jsdom) |
| `npm run test:watch` | Vitest watch |
| `npm run e2e` | Playwright (`e2e/`), starts `npm run dev` itself |
| `npm run verify` | All four, in that order — the gate before calling work done |

`npm run verify` is the single command to run before handing work back. Playwright
reuses an already-running dev server (`reuseExistingServer: true`).

## Unit suites (Vitest)

| File | Covers |
| --- | --- |
| `src/geometry/angles.test.ts` | Angle normalization (both ranges), smallest separation, `sectorAnglesFromRays` for symmetric and asymmetric fans (sums to 2π), unsorted input, <2 rays → empty, angle-step snapping in/out of tolerance |
| `src/geometry/segment.test.ts` | Closest point (interior, clamped endpoints, degenerate segment), perpendicular distance, segment intersection (crossing, parallel, non-overlapping, endpoint touch), point-on-segment epsilon |
| `src/geometry/snap.test.ts` | `computeSnap` priority (vertex beats everything, alignment, grid fallback, nothing-in-range → null, excluded dragged vertex); `snapToAngle` radius preservation; `snapToGrid` tolerance; **`findKawasakiSnap`**: repairing an interior neighbor from a dragged leaf endpoint, snapping a dragged interior vertex onto its own locus, null with no creases, null when already valid |
| `src/origami/analysis.test.ts` | **Kawasaki**: symmetric degree-4 valid, asymmetric 90/45/90/135 valid, clearly invalid with reported residual, near-miss inside the 4° band, odd-degree interior → invalid, boundary → not-applicable, sector/crease-id alignment. **Maekawa**: M−V = +2 and −2 valid, balanced 2/2 invalid, unassigned-but-satisfiable stays open, unsatisfiable partial assignment flagged. **Document**: square twist fully valid, single-vertex study valid, updates when a vertex moves |
| `src/origami/model.test.ts` | Document ops (immutable add, self-loop refused, duplicate crease deduped, move, cascading delete, bulk assignment, boundary detection); **serialization** (deterministic round-trip of the square twist, malformed JSON rejected, dangling crease references rejected, future version rejected); **tiling** (grid tile merges shared vertices, 1×1 is a no-op, assignments preserved on copies) |
| `src/editor/viewport.test.ts` | Paper ↔ screen round-trip, y-up orientation (increasing paper y decreases screen y), `zoomAt` keeps its anchor fixed and clamps to `[0.1, 40]`, `panBy` direction, `fitToPaper` centering with margins |
| `src/state/documentStore.test.ts` | `commit` pushes history and clears redo; a preview gesture is exactly one undo step; `cancelPreview` restores the baseline; an unchanged preview adds no history; undo with empty history is a no-op; `loadDocument` clears history |
| `src/components/panels/AnalysisPanel.test.tsx` | Empty document explains itself, valid pattern summarized, broken vertices counted after an invalid move (React Testing Library over the real stores) |

Note the file layout: serialization and tiling tests live in `model.test.ts`, and
the Kawasaki-snap tests live in `snap.test.ts` next to the rest of snapping.

## End-to-end (Playwright)

`e2e/editor.spec.ts`, two projects: `desktop-chromium` (Desktop Chrome) and
`mobile-iphone` (iPhone 13 metrics on the Chromium engine, so CI installs one
browser). Desktop flows skip on mobile and vice versa.

1. **Opens into the square twist with live analysis** — 12 vertices · 12 creases,
   "4/4 flat-foldable", 12 rendered crease elements.
2. **Full loop** — new document → place two vertices → connect with click-click →
   select the crease → assign mountain → drag a vertex (geometry counts unchanged,
   so the drag edited rather than created) → 5× undo back to empty → 5× redo →
   export JSON (`*.origami.json`) and SVG. This single test is the contract for
   "one gesture = one undo step".
3. **Live Kawasaki feedback while dragging** — loads the single-vertex study,
   drags an endpoint mid-gesture and asserts the badge layer contains "Kawasaki"
   *before* the pointer is released, then that the summary drops to 0 valid, that
   the inspector chip shows a residual, and that one undo restores validity.
4. **Repeat tiles the pattern** — 2×2 of the square twist yields 48 creases with
   shared boundary vertices merged.
5. **Mobile smoke** — canvas visible, mobile toolbar present, example rendered.

Tests address elements through `data-testid` and `data-vertex-id` / `data-crease-id`
attributes; keep those stable when refactoring components.

## Screenshot helper

```
npm run dev                                  # in one terminal
node scripts/screenshot.mjs out.png 1440 900 # width/height optional
```

Loads `localhost:3000`, waits for network idle plus 800ms, writes the PNG, and
prints any console errors it collected (or "no console errors"). Use it to look at
visual work and to catch hydration/runtime errors that tests would not surface.

## Policy

- **Every math feature ships with known-good and known-bad cases.** A new theorem
  or solver needs at least: a construction that satisfies it exactly, one that
  clearly violates it with an asserted numeric residual, and one near-miss inside
  the `near` band. Prefer constructions with hand-computable angles (45°/90°/135°)
  so the expected values are readable in the test.
- **Every UI feature ships with an e2e flow or a component test.** Anything the
  user can reach through a gesture belongs in `e2e/editor.spec.ts`; anything that
  is pure rendering of derived state can be a Testing Library test.
- **Live feedback is asserted mid-gesture**, not only after mouse-up — that is the
  product claim, so it is what the test must check.
- Tolerances in assertions come from `src/geometry/tolerance.ts`, never
  hand-written epsilons.
