# Architecture

Next.js 16 App Router app, but only nominally: there is one route (`src/app/page.tsx`
→ `EditorShell`), no server data, no API routes. Everything interesting is a plain
TypeScript layer under `src/`.

## Layers and the dependency rule

```
geometry/        pure math over {x, y}          — no origami concepts
   ▲
origami/         document model + theorems      — no editor/UI concepts
   ▲
editor/  state/  gestures, viewport, stores     — no JSX
   ▲
components/      React + SVG rendering          — no math
export/          serialization to SVG/JSON
```

**Dependencies point up only, and math never lives in React.** A component may
call an engine; an engine may never import a component, a store, or `react`.
`src/editor/controller.ts` is the one module that touches stores without being a
component — that is intentional (see below).

The `@/` alias maps to `src/` (tsconfig + vitest config).

## Modules

### `src/geometry`

`vec2.ts` (free functions over readonly `{x, y}` — no class, so values stay
serializable and portable), `angles.ts` (normalization, `sectorAnglesFromRays`,
angle-step snapping), `segment.ts` (closest point, intersection, point-on-segment),
`tolerance.ts` (every epsilon in one place), `snap.ts` (the snapping engine and its
priority order).

### `src/origami`

- `model.ts` — `OrigamiDocument { version, name, paper, vertices[], creases[] }`.
  Plain objects with stable string ids (`v_xxxxxxxxxx`, `c_xxxxxxxxxx` from
  `src/lib/id.ts`). Every operation is pure `doc → doc`: `addVertex`, `addCrease`
  (deduplicates), `moveVertex`, `setCreaseAssignment`, `deleteGeometry` (cascades
  to incident creases), `splitCreaseAt`, `renameDocument`, plus `validateDocument`.
  Ids are stable across edits, which is what makes snapshot history, selection, and
  React keys all work without extra bookkeeping.
- `analysis.ts` — structured Kawasaki/Maekawa results per vertex (see
  `ORIGAMI_MATH.md`). Results carry status, numeric residual, expected vs actual,
  affected crease ids, and a human sentence, so the same object drives badges, the
  inspector, snapping, and future tutorials.
- `kawasakiSnap.ts` — the "snap to flat-foldable" solver.
- `tiling.ts` — motif repetition.
- `serialization.ts` — the wire format *is* the model; `parseDocument` is the single
  entry point for untrusted input (migrate → typecheck → `validateDocument`).
- `examples.ts` — built-in documents, constructed as ordinary documents with no
  special support anywhere else.

### `src/editor`

- `viewport.ts` — the paper↔screen transform. **Paper space is y-up** (matches
  mathematical convention and the FOLD format); screen space is y-down, so the
  transform flips y: `screen.y = height − (paper.y − pan.y) · zoom`. Also `zoomAt`,
  `panBy`, `fitToPaper`, `screenLengthToPaper`.
- `hitTest.ts` — vertices before creases, tolerances passed in paper units.
- `controller.ts` — all pointer/keyboard logic as a framework-free class.

### `src/state` (Zustand)

- `documentStore.ts` — the document + snapshot undo/redo + preview transactions.
- `editorStore.ts` — session state that is never serialized: tool, selection,
  hover, viewport, crease draft, active snap, dragged vertex, pointer position.
- `useAnalysis.ts` — derivation with a `WeakMap<OrigamiDocument, DocumentAnalysis>`
  cache. Because every edit produces a new document object, the cache key is free
  and correct: any number of components can call `useAnalysis()` and the analysis
  runs at most once per document version, including per-frame during a drag. Old
  entries are collected with their documents.

### `src/components`

`EditorShell` lays out top bar / tool rail / canvas / floating inspector, with the
rail collapsing to a bottom toolbar under `md`. `CanvasStage` owns the single `<svg>`
pointer surface, the `ResizeObserver`, the non-passive wheel listener, and the
window key handlers; it forwards everything to the controller and renders layers in
order: paper → creases → snap → draft → vertices → badges. Each layer subscribes to
a narrow store slice so a pointer move only re-renders what changed.

## Controller outside React

`EditorController` is instantiated once per `CanvasStage` via `useMemo` and holds
gesture state in plain fields (`role`, `pointers`, `pinchStart`, `spaceHeld`,
`lastSnapKind`). It reads stores with `getState()` and writes with actions.

Why: gesture state changes many times per frame and must not cause re-renders;
the DRAW→ANALYZE→FEEDBACK→SNAP loop then runs synchronously inside one pointer
event, and the resulting spec is a state machine that ports directly to a native
gesture recognizer instead of being tangled in hooks.

## Rendering

SVG, with **per-element paper→screen transforms** rather than an SVG `transform`
on a group. Every layer maps its own points through `paperToScreen(viewport, p)`.
This costs a little arithmetic but keeps stroke widths, vertex radii, badge text,
and snap rings at constant screen size under zoom, with no `vector-effect`
gymnastics or scaled-shadow artifacts.

## Scaling plans

Current scales (tens to hundreds of creases) are comfortable. In rough order of
when they would bite:

1. **Incremental analysis.** `analyzeDocument` is O(V + E log E) over the whole
   document per change. `analyzeVertex` is already exported per-vertex, so the
   migration is to re-analyze only vertices whose incident creases moved and merge
   into the previous result.
2. **Spatial index.** Hit testing and snapping are linear scans of all vertices
   and creases per pointer move. A uniform grid or quadtree over paper space fixes
   both; the interfaces (`hitTest`, `computeSnap`) take the document and would take
   an index instead.
3. **History patches.** Snapshots are whole documents (arrays are copied on write,
   so unchanged entries are shared, but the arrays themselves are not). Swap for
   structural-sharing patches behind the existing `commit`/`undo`/`redo` signatures.
4. **Canvas / WebGL.** SVG creates one DOM node per crease and vertex. If profiling
   shows layout/paint dominating at thousands of elements, move the geometry layers
   to a `<canvas>` (keeping badges and chrome in DOM) — the layers already receive
   pure data and a transform, so nothing above them changes.
