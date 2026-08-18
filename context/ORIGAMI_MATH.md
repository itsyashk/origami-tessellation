# Origami mathematics

What the app actually computes, where, and what it deliberately does not compute.

Implementation: `src/origami/analysis.ts`, `src/origami/kawasakiSnap.ts`,
`src/geometry/angles.ts`, `src/geometry/tolerance.ts`.

## Sector angles

For a vertex `v` with incident creases, each crease contributes an outgoing ray
angle `atan2(other.y − v.y, other.x − v.x)`, normalized into `[0, 2π)`. Rays are
sorted ascending and `sectorAnglesFromRays` returns the consecutive
counter-clockwise gaps, summing to exactly 2π for two or more rays. `sectors[i]`
lies after `sortedCreaseIds[i]`, and the analysis result keeps both arrays aligned
so the UI can name the creases bounding any sector.

## Interior vs boundary vertices

A vertex is **boundary** if it lies within 1e-4 of the paper rect edge
(`isOnPaperBoundary`), otherwise **interior**. Kawasaki and Maekawa apply only to
interior vertices; boundary vertices report `not-applicable`. This matters in
practice: dragging a pleat endpoint off the paper edge turns it into an interior
vertex and it starts being checked (the e2e test relies on exactly this).

## Kawasaki's theorem

A flat-foldable interior vertex has an even number of creases and its alternating
sector sums are equal — each therefore π.

`analyzeKawasaki` returns:

- `errorRadians` = `oddSectorSum − π` (signed, so the UI can say which way), and
  `errorDegrees` alongside it.
- `oddSectorSum`, `evenSectorSum`, `expectedSum = π`, `sectorAngles[]`,
  `sortedCreaseIds[]`.
- `status`, from `|errorRadians|` against the tolerance tiers below.
- `explanation`: a sentence naming the residual and, when invalid, what to do.

Special cases: zero creases → `not-applicable`; odd degree → `invalid` with the
message "an interior vertex needs an even number of creases to fold flat".

## Maekawa's theorem

For a flat-foldable interior vertex, mountains − valleys = ±2.

`analyzeMaekawa` counts mountains, valleys, and unassigned creases and reports
`difference = M − V`. With **no unassigned creases** the status is `valid` iff
`difference` is +2 or −2.

With unassigned creases present it does a **satisfiability check** rather than
failing: target `t ∈ {+2, −2}` is reachable iff

```
|t − difference| ≤ unassigned   and   (t − difference + unassigned) is even
```

(range and parity — each unassigned crease shifts the difference by ±1). If either
target is reachable the vertex stays `not-applicable` with "N creases still
unassigned — Maekawa can still be satisfied"; if neither is, it is `invalid`
("no assignment of the remaining creases can make M − V = ±2"). A half-drawn
pattern is therefore never scolded, but a genuinely doomed one is flagged early.

## Tolerance tiers

`src/geometry/tolerance.ts`:

| Constant | Value | Meaning |
| --- | --- | --- |
| `FOLDABILITY_ANGLE_TOLERANCE` | 0.1° in radians | At or below → `valid` |
| `FOLDABILITY_NEAR_TOLERANCE` | 4° in radians | Between the two → `near`; above → `invalid` |
| `POSITION_EPSILON` | 1e-6 paper units | Coincident positions |
| `ANGLE_EPSILON` | 1e-5 rad | Angle equality |

`near` exists so the UI can say "almost — 2.1° off" and offer a snap rather than
flipping between pass and fail. The residual is always reported numerically even
when valid, so the app never claims more precision than it has.

`locallyFlatFoldable` is a roll-up: true for boundary vertices, for vertices with
no creases, or when Kawasaki is `valid` and Maekawa is not `invalid`.

`analyzeDocument` walks every vertex and counts interior/valid/near/invalid,
ignoring interior vertices of degree 0.

## The Kawasaki snap solver

`findKawasakiSnap(doc, draggedId, proposed, maxSnapDistance)` looks for a position
near the dragged vertex that makes Kawasaki hold exactly.

**Target selection.** A position has two degrees of freedom, so it can generally
zero only one residual. So:

- if the dragged vertex is itself analyzable (interior, even degree ≥ 2), the
  target set is just that vertex;
- otherwise the target set is its interior, even-degree neighbors — this is the
  "drag a leaf endpoint to repair the vertex it points at" case.

If the set is empty, return null. If it is over-constrained, the descent simply
fails to converge and we still return null — no snap beats a wrong snap.

**Objective.** Sum of squared Kawasaki residuals over the target set, evaluated by
moving the vertex and re-running `analyzeKawasaki`.

**Method.** Damped gradient descent with central finite differences (`h = 1e-3`),
step starting at `maxSnapDistance / 2` and halving on rejection, at most 40
iterations. Early exits: already valid at the proposed position → null (nothing to
snap); residual below a quarter tolerance → done.

**Acceptance.** The result is returned only if the final residual is within
`FOLDABILITY_ANGLE_TOLERANCE` *and* the solution is within `maxSnapDistance`
(14px ÷ zoom) of the proposed position. Snapping must feel like a nudge, never a
jump.

Cost is roughly 5 residual evaluations per iteration over a handful of vertices —
fine inside a pointer-move frame.

## Not implemented yet

Local conditions are necessary, not sufficient. The app is honest about this: it
reports "flat-foldable" per vertex, never "this pattern folds".

- **Big-little-big lemma** — the unique strictly-smallest sector at a vertex must
  be bounded by creases of opposite assignment (and the generalized version for
  equal-angle runs). Not checked, so some patterns pass Kawasaki + Maekawa and
  still cannot fold.
- **Global flat-foldability / layer ordering** — deciding whether a whole crease
  pattern folds flat, and finding a valid layer ordering, is NP-hard (Bern &
  Hayes). Any future support will be heuristic or restricted to structured
  families (twists, tessellations with known unit cells), not a general solver.
- **Self-intersection / non-crossing creases** — creases may cross without
  creating a vertex; nothing detects or subdivides at intersections yet.
- **Faces** — the document stores vertices and creases only. No planar-graph face
  extraction, so no per-face reasoning, folded state, or layer stacking.

## Reference construction: the square twist

`squareTwist()` in `src/origami/examples.ts`, the default document on load. A 200×200
sheet with a central 40×40 square (corners at 80/120) and two pleat creases from
each corner running to the paper boundary, built with 4-fold rotational symmetry.

Each corner is a degree-4 interior vertex with sector angles **45° / 90° / 135° / 90°**
— alternating sums 45+135 = 180 and 90+90 = 180, so Kawasaki holds exactly. The
assignment is **3 mountain / 1 valley** (the four square edges and the diagonal
pleat are mountains, the side pleat is a valley), giving M − V = +2 for Maekawa,
with the unique smallest sector bounded by one mountain and one valley as
big-little-big requires. Result: 12 vertices, 12 creases, "4/4 flat-foldable".

`singleVertexPlayground()` is the minimal counterpart: one degree-4 vertex at the
center with rays at 0°, 90°, 225°, 315° (sectors 90/135/90/45), 3 mountain /
1 valley — the simplest thing to drag while watching Kawasaki respond.
