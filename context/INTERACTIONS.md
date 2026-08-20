# Interaction spec

Behavioral contract for the canvas, precise enough to reimplement on another
platform. All of it lives in `src/editor/controller.ts` (`EditorController`), a
plain class that reads and writes the Zustand stores directly; React only forwards
pointer/keyboard events to it.

## Constants

| Name | Value | Meaning |
| --- | --- | --- |
| `SNAP_TOLERANCE_PX` | 9 | Base snap capture radius |
| `VERTEX_HIT_PX` | 10 | Vertex hit test / endpoint reuse radius |
| `CREASE_HIT_PX` | 7 | Crease hit test radius |
| `DRAG_THRESHOLD_PX` | 4 | Movement before a press becomes a drag |
| `KAWASAKI_SNAP_PX` | 14 | Max pull of the flat-foldability snap |
| `GRID_SIZE` | 10 | Grid spacing, **paper units** (not px) |

All px constants are converted to paper units with `screenLengthToPaper(vp, px)`
= `px / zoom`, so snapping feels identical at any zoom level. Zoom is clamped to
`[0.1, 40]`.

## Tools

### Select (`V`)

- **Pointer down** hit-tests at the pointer: vertices win over creases (`hitTest`).
  - Vertex hit → select it (shift = toggle in set), arm `maybe-drag-vertex`.
  - Crease hit → select it (shift = toggle), haptic tick.
  - Miss → arm a marquee (shift = additive). A click with no drag clears
    selection unless shift is held.
- **Drag** — once the pointer moves ≥ 4px from the press point, the gesture
  promotes to `drag-vertex`: `beginPreview()` snapshots the document, then every
  move calls `preview(moveVertex(...))` with the snapped position. No history is
  written mid-drag.
- **Pointer up** → merge if the dropped vertex coincides with another (within
  `INCIDENCE_EPSILON`), then planarize, then `commitPreview()`: one undo step
  covering the whole drag. Undo reverses the drag, the merge, and any
  subdivision together.
- **Hover** (no button) sets `hovered` for vertex/crease highlight.
- **Marquee** — empty-canvas drag draws a rubber-band in screen space; on
  release, vertices inside the paper AABB are selected, and creases whose both
  endpoints are selected come along. Shift unions with the current selection.

### Vertex (`P`)

- **Click** places a vertex at the snapped position and selects it.
- Clicking an existing vertex (vertex snap) only selects it — no duplicate.
- Clicking on a crease (on-crease snap) **splits** that crease: the crease is
  replaced by two halves that inherit its assignment, with the new vertex between.
- Positions are clamped to the paper rect. Each placement is one undo step.

### Crease (`C`)

Both gesture styles are supported and interchangeable:

- **Click-click** — first click starts a draft at the resolved endpoint, second
  click completes the crease.
- **Press-drag** — pressing and moving ≥ 4px materializes the start endpoint
  immediately; releasing over the target completes it.
- **Chaining** — after completion the draft immediately restarts from the new
  endpoint, so a polyline is a sequence of clicks.
- **Escape** cancels the draft and rolls back any vertex/split created for it
  (the draft runs inside a preview transaction).
- Each endpoint is resolved by `resolveEndpoint()`: existing vertex under the snap
  or within 10px → reuse; snapped onto a crease → split it; otherwise → new vertex
  clamped to the paper.
- A completed crease is one undo step. Duplicate creases between the same pair are
  silently ignored; a zero-length crease (same start and end vertex) is ignored and
  keeps the draft alive.
- **Auto-subdivision** — completion runs `planarizeDocument`: the new crease and
  every crease it crosses split at their intersection points (shared junction
  vertices), and any loose vertex lying on its path is joined into it. All within
  the same undo step. See the planarization entry in `DECISIONS.md`.
- While a draft is active, angle snapping is enabled with the draft's start vertex
  as origin (15° steps, labelled e.g. "45°").

### Pan (`H`)

- Drag pans. Available in every tool via middle mouse button or holding `Space`.

### Viewport (any tool)

- **Wheel** zooms about the cursor: `zoom *= exp(-deltaY * 0.0015)`, anchored so
  the paper point under the pointer stays put (`zoomAt`). The listener is attached
  non-passively so the page never scrolls.
- **Two pointers** (touch) → pinch: a second pointer down cancels any in-flight
  edit gesture, then zoom tracks the ratio of current to initial finger distance,
  anchored at the finger midpoint (which also produces pan).
- Zoom controls in the corner: ±25% steps about the viewport center, percentage
  readout, fit-to-paper. The paper is auto-fitted once on first layout and again
  whenever a document is loaded (example / import / new).

## Snapping

`computeSnap()` (`src/geometry/snap.ts`) gathers every candidate within tolerance
and picks by **priority first, distance second**:

| Priority | Kind | Notes |
| --- | --- | --- |
| 0 | `vertex` | Capture radius ×1.4 — landing on a vertex is almost always intended |
| 1 | `kawasaki` | Injected by the controller during vertex drags, max pull 14px |
| 2 | `angle` | 15° steps from the draft origin; preserves radius; labelled in degrees |
| 3 | `align` | X and/or Y alignment with an existing vertex; draws dashed guides |
| 4 | `on-crease` | Closest point on a segment; enables crease splitting |
| 5 | `grid` | 10 paper units, tolerance ×0.75 so it never beats a real feature |

Which options are enabled depends on the gesture:

- **Placement / crease drawing** — vertices, creases, alignments, grid, plus angle
  when a draft is active.
- **Vertex drag** — vertices (merge), alignments, grid, Kawasaki. The dragged
  vertex is excluded from candidates. Landing on another vertex is labelled
  "Merge" and wins over Kawasaki; drop absorbs the dragged vertex into the
  target (rewire, drop the joining self-loop, collapse duplicate edges).

The Kawasaki snap runs on top of whatever geometric snap was found: the geometric
result is fed in as the proposed position, and if a flat-foldable position exists
within 14px it replaces the snap with a green `kawasaki` hit labelled "Kawasaki ✓".
See `ORIGAMI_MATH.md` for the solver.

`SnapLayer` renders the guides, a ring at the snap position (larger and green for
Kawasaki), and the label. `StatusBar` echoes the label or the snap kind.

## Keyboard

| Key | Action |
| --- | --- |
| `V` `P` `C` `H` | Select / Vertex / Crease / Pan (cancels any in-flight gesture) |
| `1` `2` `3` | Assign selected creases mountain / valley / unassigned |
| `Ctrl`/`Cmd` `Z` | Undo (with `Shift` → redo) |
| `Ctrl`/`Cmd` `Y` | Redo |
| `Arrow` keys | Nudge selected vertices 1 paper unit (Shift = 10); paper space is y-up |
| `Ctrl`/`Cmd` `A` | Select every vertex and crease |
| `Delete` / `Backspace` | Delete selection (deleting a vertex deletes its creases) |
| `Escape` | Cancel gesture + clear selection |
| `Space` (hold) | Temporary pan |

Handlers are attached to `window` but ignore events whose target is an input,
textarea, select, or contenteditable. `keyDown` returns `true` when it consumed the
event, and only then does the DOM layer call `preventDefault()`.

## Undo semantics

### Fold preview (`F`, or the "Fold" button)

A modal overlay (`src/components/fold/FoldPreview.tsx`) that animates the
pattern folding and shows the flat-folded result:

- Opens with autoplay 0→100% (~3.2s) unless `prefers-reduced-motion` — then it
  opens flat with the slider only.
- Wide layout: crease pattern on the left, simulated fold on the right.
- Controls: **Flat** (t=0), **Fold/Pause**, **Folded** (t=1), a scrub slider,
  and **Top view** (straight-down look at the folded silhouette).
- Faces respond to the slider immediately; front faces render paper-white,
  back faces cyan (duo paper), so flips are visible.
- Warning chips surface non-flat-foldable vertices and unassigned creases
  (which stay flat and hold their subtree open). A persistent note states that
  face stacking is a painter-order heuristic, not a global foldability proof.
- `F` toggles; while open, the overlay owns the keyboard (Escape closes).

One gesture is one undo step. Two mechanisms in `documentStore`:

- `commit(next)` — immediate single-step edits (place vertex, assign, delete,
  rename, repeat/tile).
- `beginPreview()` / `preview(next)` / `commitPreview()` / `cancelPreview()` —
  continuous gestures. `preview` mutates the document without touching history, so
  analysis and rendering stay live at 60fps; `commitPreview` records exactly one
  entry (from the pre-gesture baseline) and is a no-op if nothing changed.

Vertex drags and crease drafts both run as preview transactions. `Escape` or a
pointer cancel calls `cancelPreview()`, restoring the baseline document.

History depth is 200 snapshots; loading a document clears history.

## Feedback rules

- **Feedback appears next to the geometry it describes.** `AnalysisBadgeLayer`
  draws a small pill offset (+12, +20) from the vertex: "Kawasaki · 2.1° off",
  "Kawasaki · 3 creases" (odd degree), "Maekawa · M−V = 0", "BLB · same assignment".
- **Valid vertices stay quiet.** No badge for a satisfied vertex — except the one
  currently being dragged, which gets a green "Kawasaki ✓" so the user sees the
  moment it snaps into validity.
- **Vertex rings** carry the coarse signal: coral ring = invalid, amber = near,
  none = fine. Yellow fill = selected or dragging.
- **No modal alerts for geometry.** Ever. The document-level chip ("3/4
  flat-foldable", "1 almost valid", "2 to fix") lives in the always-visible
  analysis card; per-vertex prose ("Alternating sums differ from 180° by 2.1° —
  move a crease so alternating sectors balance") lives in the inspector, which
  appears only when something is selected.
- **Haptics** (`navigator.vibrate(8)`, Android Chrome only, silently absent
  elsewhere) fire on transitions, never continuously: entering a vertex or
  Kawasaki snap, selecting a crease, placing a vertex, completing a crease. The
  snap kind + affected ids are compared frame-to-frame so a held snap does not
  repeat. See `IOS.md` for the richer native haptic vocabulary.
