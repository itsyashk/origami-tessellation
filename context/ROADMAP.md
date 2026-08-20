# Roadmap

Ordered by dependency, not by ambition. Items marked *(speculative)* are not yet
grounded in a design or a known algorithm; treat them as directions, not commitments.

## M1 — Core editor (done)

Shipped and covered by tests: vertex/crease/select/pan tools, drag with live
Kawasaki + Maekawa, the snapping stack including the Kawasaki-locus snap,
mountain/valley assignment, motif repeat, snapshot undo/redo, examples, JSON
import, SVG/JSON export, responsive desktop + touch layout.

## M2 — Editor completeness (done)

Small, well-understood pieces that remove friction before any new mathematics.

| Item | Notes |
| --- | --- |
| ~~Crease subdivision at intersections~~ | **Done.** `planarizeDocument` (`src/origami/planarize.ts`) runs at every commit point — crease completion, drag drop, nudge, coordinate edit — splitting crossings and vertex-on-crease incidences. Also applied on JSON/FOLD import (see DECISIONS.md). |
| ~~Vertex merge on drop~~ | **Done.** Dragging a vertex snaps onto others; drop absorbs the dragged vertex into the target, rewires creases, drops the joining self-loop, and collapses duplicate edges. |
| ~~Marquee selection~~ | **Done.** Rubber-band in the select tool; vertices inside the paper AABB, creases whose both endpoints are inside. Shift adds. Ctrl+A selects all. |
| ~~FOLD import/export~~ | **Done.** `src/origami/foldFormat.ts` maps `vertices_coords` / `edges_vertices` / `edges_assignment` (M/V/U/B). File menu Open accepts `.fold`; Export FOLD writes one. |
| ~~Big-little-big check~~ | **Done.** Third local condition; same badge/inspector plumbing. Classic local-min sectors only (equal-angle runs not generalized). |
| ~~Local layer-order check~~ | **Done** for degree-4 vertices with a unique smallest sector. Global layer ordering remains NP-hard and is not claimed. |
| ~~Auto-assignment suggestions~~ | **Done.** Kawasaki-valid vertices with unassigned creases get Maekawa+BLB completions in the inspector ("Assign 3M / 1V"). |

## M3 — Symmetry and true tessellations

- Symmetry tools: mirror axes and rotational orders, with edits propagating to all
  symmetric copies live.
- Unit cells with **edge-matching constraints** — a real tessellation primitive
  replacing today's bounding-box repeat, which only translates and merges
  coincident points.
- Lattice choice (square, triangular, hexagonal) and cell-boundary editing.
- Twist-family generators (square twist, hex twist, Miura variants) parameterized
  rather than hand-drawn.

Prerequisite: vertex merge on drop is done, so tiled patterns can fuse
coincident vertices instead of leaving unconnected stacks. Remaining for a
true tessellation primitive: unit-cell edge-matching (pick this) **or**
symmetry tools — one deep slice, not both half-done. Parameterized twist
generators already live in `src/origami/patterns/`.

## M4 — Folded state *(largely done)*

Done, in `src/origami/faces.ts` + `fold.ts` + the Fold preview overlay (`F`):

- ~~Planar face extraction from the crease graph~~ — half-edge traversal over
  creases + paper boundary; slits and synthetic corners handled.
- ~~Fold the pattern flat~~ — BFS spanning tree over faces; each hinge rotates
  by t·π (valley +, mountain −), so t=1 is exactly the classical reflection
  fold map. Animated 0→1 in a 3D tilted view with front/back face colors.
- ~~Folded-result view~~ — the overlay's "Folded" + "Top view" states.

Remaining for M4:

- ~~Layer ordering where it is decidable locally~~ — **Done** for degree-4
  vertices (`analyzeLayerOrder`). Display stacking in the fold preview is
  still a BFS-depth heuristic and is labeled as such.
- ~~Side-by-side crease pattern ↔ folded preview~~ — **Done** in the Fold overlay.
- Self-intersection detection in the folded state.

## M5 — True rigid-origami 3D *(speculative)*

The current animation rotates faces along tree hinges only, so patterns that
are not rigidly foldable with flat panels (the square twist!) visibly separate
at loop-closure creases mid-animation — endpoints are always consistent. A
rigid-origami or compliant solver (Origami Simulator style) would animate the
true folding motion with panel bending.

## M6 — Native iOS

Port per `IOS.md`: Swift model structs, engines as pure functions, Core Graphics
canvas, Core Haptics vocabulary, `FileDocument` with the `.origami.json` UTType.
Deliberately last so the interaction spec and math have stopped moving.

## Ongoing, not milestone-gated

- Incremental per-vertex re-analysis and a spatial index, when pattern sizes justify
  them (`ARCHITECTURE.md`).
- More built-in examples — each new one is also an analysis regression test.
- PDF export with fold-line legend (SVG export already carries a mountain/valley legend).
- Accessibility: further keyboard-only construction; richer screen-reader
  descriptions of per-vertex residuals.

## Explicitly not planned

- Accounts, cloud sync, collaboration.
- A general flat-foldability decision procedure.
- Generic vector drawing features (bezier curves, text, images) — this is a crease
  pattern tool, not a design tool.
