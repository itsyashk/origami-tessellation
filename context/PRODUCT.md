# Product

An interactive origami mathematics and tessellation design tool. You draw a crease
pattern; the app continuously tells you whether it can fold flat, and offers to fix it.

Think GeoGebra for origami: the geometry is the document, the mathematics is live,
and the feedback appears next to the thing you are touching.

## The loop

```
DRAW ──► ANALYZE ──► FEEDBACK ──► SNAP / SUGGEST ──► DRAW ...
```

Every pointer move through this loop runs synchronously, outside React
(`src/editor/controller.ts` → engines → Zustand → SVG layers).

- **Draw** — place a vertex, draw a crease, drag a vertex, marquee-select, assign mountain/valley.
- **Analyze** — `analyzeDocument()` recomputes Kawasaki, Maekawa, and big-little-big for every vertex
  on every document change, including each mid-drag frame (`src/origami/analysis.ts`).
- **Feedback** — vertex rings recolor, badges appear beside the offending vertex
  ("Kawasaki · 2.1° off"), the analysis chip updates ("3/4 flat-foldable").
- **Snap / suggest** — while dragging, `findKawasakiSnap()` searches for a nearby
  position that satisfies Kawasaki exactly and pulls the vertex onto it, labelled
  "Kawasaki ✓" (`src/origami/kawasakiSnap.ts`).

There is **no "check" button, and there never will be.** Validity is a property of
the canvas at all times, not the result of a command. Correspondingly there are no
modal error dialogs about geometry: the only `window.alert` in the app is for a
malformed imported file.

## V1 — what exists today

| Area | Shipped |
| --- | --- |
| Tools | Select (V), Vertex (P), Crease (C), Pan (H); marquee on empty drag; Ctrl+A select all |
| Drawing | Click-place vertices; click-click **and** press-drag creases with chaining; clicking a crease with the vertex tool splits it |
| Editing | Drag vertices with live analysis; drop onto another vertex to merge; numeric X/Y in the inspector; arrow-key nudge; delete selection |
| Analysis | Per-vertex Kawasaki (signed residual in degrees), Maekawa (M−V, incl. partial-assignment satisfiability), big-little-big, degree-4 local layer order; document roll-up counts |
| Snapping | Existing vertex (merge on drop) → Kawasaki locus → 15° angle ray → axis alignment → point-on-crease → 10-unit grid |
| Assignment | Mountain / valley / unassigned via inspector or keys `1` `2` `3`; `boundary` exists in the model for FOLD compatibility; inspector can apply Maekawa/BLB suggestions |
| Tessellation | "Repeat" tiles the selection (or whole pattern) in a rows × columns grid, merging coincident vertices and growing the paper. Construction symmetry (2-fold / 4-fold / axial mirrors about the paper centre) bakes copies into the pattern while you draw |
| History | Snapshot undo/redo, 200 steps; one gesture = one step |
| Files | Built-in pattern library, JSON and FOLD import (planarized on open), `.origami.json`, `.fold`, and `.svg` export |
| Viewport | Wheel zoom at cursor, pinch, middle/space drag pan, fit-to-paper, zoom readout |
| Platform | Responsive desktop + touch layout; onboarding hint; keyboard shortcut sheet |
| Fold preview | `F` opens a side-by-side crease pattern ↔ simulated fold; stacking is labeled as a heuristic |

Opening the app loads the Square Twist rather than a blank sheet — there is
something to drag, and analysis is visibly alive, in the first second.

## Long-term direction

Roughly in the order they become interesting (see `ROADMAP.md` for milestones):

- **Tessellations proper** — unit cells, edge-matching constraints,
  rather than today's bounding-box repeat.
- **Richer symmetry** — wallpaper groups beyond 2-fold / 4-fold / axial
  mirrors; live constraints instead of baked copies.
- **Global flat-foldability** — beyond local Kawasaki / Maekawa / big-little-big:
  self-intersection in the folded state; suggest edits that make a pattern foldable.
- **Inverse design** — describe a target shape, get a crease pattern.
- **Generated folding tutorials** — step sequences derived from the pattern.
- **More formats** — PDF print export.
- **Native iPhone app** — see `IOS.md`; the model and engines are written to port.

## Feel

Playful paper-craft on the outside, rigorous tool on the inside.

- Warm off-white stock, graph-paper backdrop, hand-written accent type, a paper
  sheet with a real drop shadow.
- Precise numbers everywhere they matter: tabular figures, residuals to 0.1°,
  sector angles listed, expected-vs-actual spelled out in prose.
- The canvas stays clean; personality lives in the chrome. See `DESIGN_SYSTEM.md`.
- Feedback is never scolding. An invalid vertex says how far off it is and what
  would fix it, and the snap does the fixing for you when you get close.
