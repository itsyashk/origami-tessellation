# Roadmap

Ordered by dependency, not by ambition. Items marked *(speculative)* are not yet
grounded in a design or a known algorithm; treat them as directions, not commitments.

## M1 — Core editor (done)

Shipped and covered by tests: vertex/crease/select/pan tools, drag with live
Kawasaki + Maekawa, the snapping stack including the Kawasaki-locus snap,
mountain/valley assignment, motif repeat, snapshot undo/redo, examples, JSON
import, SVG/JSON export, responsive desktop + touch layout.

## M2 — Editor completeness

Small, well-understood pieces that remove friction before any new mathematics.

| Item | Notes |
| --- | --- |
| ~~Crease subdivision at intersections~~ | **Done.** `planarizeDocument` (`src/origami/planarize.ts`) runs at every commit point — crease completion, drag drop, nudge, coordinate edit — splitting crossings and vertex-on-crease incidences. Not yet applied to JSON import (imports are kept byte-faithful). |
| Vertex merge on drop | Vertex snapping is disabled during drags precisely because dropping onto another vertex has no defined behavior. Define it: merge, rewire incident creases, dedupe. |
| Marquee selection | Rubber-band rectangle in the select tool; the selection model already holds sets of both kinds. |
| FOLD import/export | The model maps closely (`vertices_coords`, `edges_vertices`, `edges_assignment` with M/V/U/B — the `boundary` assignment exists for this). Unlocks interop with Oripa, Rabbit Ear, ORIPA-family tools. |
| Big-little-big check | A third local condition alongside Kawasaki and Maekawa; same result shape, same badge/inspector plumbing. |
| Local layer-order check | Per-vertex layer consistency for degree-4 vertices; a real step toward foldability beyond angle counting. |
| Auto-assignment suggestions | Given a Kawasaki-valid vertex, propose assignments satisfying Maekawa + big-little-big. |

## M3 — Symmetry and true tessellations

- Symmetry tools: mirror axes and rotational orders, with edits propagating to all
  symmetric copies live.
- Unit cells with **edge-matching constraints** — a real tessellation primitive
  replacing today's bounding-box repeat, which only translates and merges
  coincident points.
- Lattice choice (square, triangular, hexagonal) and cell-boundary editing.
- Twist-family generators (square twist, hex twist, Miura variants) parameterized
  rather than hand-drawn.

Prerequisite: vertex merge on drop (subdivision is done), or tiled patterns
will keep producing near-coincident unconnected vertices.

## M4 — Folded state (2D)

- Planar face extraction from the crease graph (currently the document has no
  faces at all).
- Fold the pattern flat: face transforms by reflecting across creases.
- Layer ordering where it is decidable locally; report honestly where it is not
  (global flat-foldability is NP-hard — see `ORIGAMI_MATH.md`).
- Side-by-side crease pattern ↔ folded preview.

## M5 — 3D preview *(speculative)*

Partial-fold animation and a 3D folded model. Requires a rigid-origami or
simulation approach (angle-based folding, or a solver in the style of Origami
Simulator); scope and feasibility to be assessed after M4 gives us faces.

## M6 — Native iOS

Port per `IOS.md`: Swift model structs, engines as pure functions, Core Graphics
canvas, Core Haptics vocabulary, `FileDocument` with the `.origami.json` UTType.
Deliberately last so the interaction spec and math have stopped moving.

## Ongoing, not milestone-gated

- Incremental per-vertex re-analysis and a spatial index, when pattern sizes justify
  them (`ARCHITECTURE.md`).
- More built-in examples — each new one is also an analysis regression test.
- PDF export with fold-line legend.
- Accessibility: keyboard-only construction path, screen-reader description of the
  analysis state.

## Explicitly not planned

- Accounts, cloud sync, collaboration.
- A general flat-foldability decision procedure.
- Generic vector drawing features (bezier curves, text, images) — this is a crease
  pattern tool, not a design tool.
