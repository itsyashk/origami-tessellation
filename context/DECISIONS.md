# Decision log

Each entry: what was decided, why, and what would make us revisit it. Append new
entries at the bottom; do not rewrite history.

---

### SVG over Canvas for V1 rendering

**Decision.** Render the crease pattern as SVG elements (`CanvasStage` + layers),
one node per crease and vertex, with per-element paper→screen transforms.

**Reason.** Free hit-testing hooks, `data-vertex-id` / `data-crease-id` attributes
that Playwright can address, crisp strokes at any zoom, no manual redraw loop, and
trivially inspectable output. At current sizes (tens to hundreds of elements) the
DOM cost is invisible.

**Reconsider when.** Profiling shows layout/paint dominating — likely somewhere
in the low thousands of creases, i.e. real tessellations. Migration path: move the
geometry layers to `<canvas>` while keeping badges and chrome in DOM; layers
already take pure data plus a viewport, so nothing above them changes.

---

### Snapshot undo/redo over the command pattern

**Decision.** History is an array of whole `OrigamiDocument` snapshots (limit 200),
with `preview`/`commitPreview` transactions for continuous gestures.

**Reason.** Correct by construction — no inverse operations to write, test, or get
subtly wrong. Documents are small immutable objects and array copies share
unchanged entries. Undo can never desynchronize from the document.

**Reconsider when.** Memory or copy cost becomes measurable on large patterns. The
`commit` / `undo` / `redo` signatures are designed to keep working over
structural-sharing patches, so callers would not change.

---

### y-up paper coordinates with a viewport flip

**Decision.** The document uses y-up paper space; `viewport.ts` flips to y-down
screen space (`screen.y = height − (paper.y − pan.y) · zoom`), and the SVG exporter
does the same flip independently.

**Reason.** Matches mathematical convention, the FOLD format, and any future
solver or Swift port. Angle math (`atan2`, CCW sectors, `perp`) is written once and
means what it says. The alternative — y-down everywhere — would put a sign error in
every geometry function forever.

**Reconsider when.** Never, realistically. The cost is one flip in two places.

---

### Zustand over Redux or React Context

**Decision.** Two Zustand stores: `documentStore` (persisted state + history) and
`editorStore` (session state).

**Reason.** The controller needs to read and write state **outside React**
(`getState()` in a pointer handler, many times per frame). Context cannot do that
without re-renders; Redux brings action/reducer ceremony we do not need for pure
`doc → doc` functions that already exist in the model layer. Narrow selectors keep
pointer-move updates from re-rendering panels.

**Reconsider when.** The state graph grows enough that middleware (devtools, time
travel, persistence) is worth the ceremony.

---

### Controller class outside React

**Decision.** All pointer and keyboard logic lives in `EditorController`, a plain
class instantiated once per canvas; React components only forward events.

**Reason.** Gesture state (`role`, active pointers, pinch baseline, last snap kind)
changes many times per frame and must not trigger renders. Keeping it out of hooks
makes the DRAW→ANALYZE→FEEDBACK→SNAP loop synchronous inside a single event, and
turns the interaction spec into a state machine that ports to native gesture
recognizers (see `IOS.md`).

**Reconsider when.** Nothing foreseeable. If the class grows unwieldy, split it by
tool rather than moving it into React.

---

### Kawasaki snap targets one residual

**Decision.** `findKawasakiSnap` solves for the dragged vertex's own residual when
that vertex is analyzable, otherwise for its interior neighbors' residuals; and it
returns null rather than a compromise when the descent does not converge.

**Reason.** A position has two degrees of freedom, so it generally cannot zero
several independent Kawasaki residuals at once. Attempting a least-squares
compromise across many vertices would move the vertex somewhere that satisfies
nothing while feeling like a snap. No snap beats a wrong snap.

**Reconsider when.** A real constraint solver arrives (M3+) that can move several
vertices at once — then "make this vertex foldable" becomes a multi-variable solve
rather than a 2-DOF search.

---

### `boundary` is a crease assignment

**Decision.** `CreaseAssignment` is `mountain | valley | unassigned | boundary`,
even though the UI's assignment picker only offers the first three.

**Reason.** FOLD's `edges_assignment` uses M/V/U/B, and paper-edge segments are
genuinely a different kind of edge (they are not folds, and Maekawa must not count
them). Having the case in the model now means FOLD import/export does not require a
schema migration later.

**Reconsider when.** If boundary edges become implicit (derived from the paper
rect) rather than stored, the case could be dropped — but FOLD interop argues
against it.

---

### Tolerances are paper units derived from screen pixels

**Decision.** Interaction tolerances are declared in pixels (`SNAP_TOLERANCE_PX 9`,
`VERTEX_HIT_PX 10`, `CREASE_HIT_PX 7`, `DRAG_THRESHOLD_PX 4`, `KAWASAKI_SNAP_PX 14`)
and converted at use time with `screenLengthToPaper(vp, px) = px / zoom`. Geometric
and mathematical tolerances (`POSITION_EPSILON`, `FOLDABILITY_*`) stay in paper
units and radians in `src/geometry/tolerance.ts`.

**Reason.** Snapping is a perceptual affordance — it must feel the same at 0.5× and
20× zoom, which means constant *on screen*. Mathematics is not perceptual — 0.1°
is 0.1° at any zoom. Keeping the two vocabularies separate stops one from
contaminating the other, and keeps the engines free of viewport knowledge.

**Reconsider when.** High-DPI or Apple Pencil input suggests calibrating in points
or millimeters instead of CSS pixels.

---

### Open into the square twist, not an empty document

**Decision.** `documentStore` initializes with `squareTwist()`; "New pattern" in the
File menu produces the empty document.

**Reason.** The product claim is a live loop. An empty canvas demonstrates nothing:
no creases, no analysis, nothing to drag. The square twist shows mountain/valley
conventions, a "4/4 flat-foldable" summary, and is immediately editable, so the
first interaction is already the real interaction.

**Reconsider when.** A gallery/home screen exists, or the app gains document
persistence and should reopen the user's last file.

---

### Playwright mobile project uses iPhone metrics on Chromium

**Decision.** The `mobile-iphone` project uses `devices["iPhone 13"]` with
`browserName: "chromium"` rather than WebKit.

**Reason.** Keeps CI to a single browser download and a single engine's flake
profile, while still exercising the touch layout, viewport size, and mobile
toolbar — which is what those tests are actually about.

**Reconsider when.** Safari-specific bugs appear (pointer events, `touch-action`,
`overscroll-behavior`, font rendering), or before shipping a public web build where
Safari is a primary target.

---

### Dangling (degree-1) interior vertices are "in progress", not "invalid"

**Decision.** `analyzeVertex` reports Kawasaki/Maekawa as `not-applicable` for a
degree-1 interior vertex, and `analyzeDocument` excludes degree-<2 vertices from
the flat-foldable tally entirely.

**Reason.** A dangling crease end exists in every half-drawn pattern; flagging it
coral mid-construction punishes the normal drawing flow and pollutes the summary
("0/2 flat-foldable" after drawing one innocent crease). Degree ≥ 2 vertices with
odd parity are still marked invalid — that is a real math violation.

**Reconsider when.** A "strict mode" or pre-export validation pass exists; there,
dangling ends should be reported as blockers.

---

### `commit()` is transaction-aware

**Decision.** If a preview transaction is open when `commit(next)` runs, the
history entry recorded is the transaction *baseline*, and the transaction closes.

**Reason.** Any UI code (keyboard shortcuts, inspector, top bar) may commit while
a drag or crease draft is in flight. Recording the transient mid-gesture document
would let undo resurrect states that never logically existed, and leaving the
baseline armed let a later cancel roll the whole session back. Defense in depth:
tool switches and undo/redo also explicitly abandon gestures via `resetGesture`.

**Reconsider when.** Gestures and commits ever need to interleave intentionally
(e.g. multi-touch editing two vertices at once) — then history needs real
transaction scopes instead of a single baseline slot.

---

### Planarization runs at commit points, never per pointer frame

**Decision.** `planarizeDocument` (two rules to fixpoint: a vertex on a crease's
interior splits it; a proper crossing gets a new vertex, splitting both creases)
runs when a gesture commits — crease completion, drag drop, arrow-key nudge,
inspector coordinate edit — inside the same undo step as the edit. It does NOT
run during drag previews, and JSON import stays byte-faithful.

**Reason.** A crease pattern where creases cross without a shared vertex is
physically meaningless and silently breaks vertex analysis, so the editor never
leaves geometry in that state. But planarizing per frame would spray transient
junction vertices while a vertex sweeps across creases; committing once on drop
keeps dragging fluid and makes undo reverse the drag and the subdivision
together. The incidence tolerance is 1e-4 paper units (INCIDENCE_EPSILON) —
far below any snap radius, so only genuinely coincident geometry fuses.

**Reconsider when.** Import should offer an explicit "planarize on open" step;
and if dragging back and forth across creases litters degree-2 collinear
pass-through vertices in practice, add a merge/simplify pass that removes them.

---

### Fold preview: spanning-tree kinematics, not a rigid-origami solver

**Decision.** The Fold preview animates by rotating each face about its BFS-tree
hinge crease by t·π (valley toward +z, mountain away), composed down the tree in
crease-pattern coordinates (`src/origami/fold.ts` over faces from `faces.ts`).
At t=1 this is exactly the classical flat-fold map (reflection composition), so
the folded endpoint is mathematically correct for locally flat-foldable input.
Display stacking uses a BFS-depth + cumulative-fold-sign heuristic. Rendering is
plain SVG polygons with painter sorting, Newell-normal shading, and duo-paper
coloring (front paper-white, back cyan).

**Reason.** A real rigid-origami or compliant solver is a project in itself, and
many patterns (the square twist, famously) are not rigidly foldable with flat
panels at all — mid-animation "tearing" at loop-closure creases is inherent to
any panel-rigid preview of them, while the flat and fully-folded endpoints are
always consistent. The tree-kinematic approach is a few hundred lines, fully
testable, and reads clearly as folding.

**Reconsider when.** M5: a solver in the style of Origami Simulator for true
folding motion; and proper layer ordering when we tackle the folded-state
milestone remainder.

---

### Fold animation is a physical simulation, not kinematics

**Decision.** `src/origami/foldSim.ts` replaces the per-face kinematic
transforms in the fold preview. The sheet is triangulated (every face fanned
around its centroid so panels can bend); PBD projection keeps bars
inextensible (paper cannot stretch or tear — the mesh is connected by
construction); crease hinges drive dihedral angles toward t·π·cap with
angle-unwrapping across the ±π seam and an "endgame press"; soft facet hinges
provide paper-like bending; drift is removed by rigidly re-anchoring the root
face (hard pins blocked legitimate fold paths); and a weak "guide" force pulls
toward the analytic fold map — full-strength for tree face-graphs (where the
map is exact at every t), endgame-only otherwise, weighted per node by how
much the map's face images agree (trust fades where the analytic map tears).

**Reason.** The kinematic preview visibly tore at loop-closure creases —
mid-fold separation on every multi-vertex pattern. A connected mesh makes
tearing structurally impossible, and bending appears exactly where real paper
bends (twists!). Validated per pattern in `foldSim.test.ts`: strain ≤ 10%,
no explosion, family-specific fold-progress and flatness targets; plus
screenshot review of the animation.

**Hard-won details.** The analytic guide's parameter is a fraction of a FULL
fold, so capped drives must request `t·cap` from the map — passing raw `t`
drags shallow folds toward the flat stack and crumples them (this one bug
masqueraded as several "physics" failures). Waterbomb tessellations do not
press flat; they curl into their tube form — capping their drive at deep
corrugation is the realistic presentation, not a workaround. Patterns can
carry `simOptions` overrides in the library for exactly such physics.

**Reconsider when.** A GPU solver (Origami Simulator style) or collision
handling is wanted; or hidden-line rendering replaces the faint overlay
crease lines.

---

### Vertex merge on drop: absorb the dragged vertex into the target

**Decision.** During a vertex drag, vertex snapping is on. Dropping onto
another vertex (positions within `INCIDENCE_EPSILON` after the snap) absorbs
the dragged id into the snap target: incident creases rewire, the crease that
joined the pair is dropped as a self-loop, and duplicate edges collapse.
Assignment preference on duplicates: `boundary` > mountain/valley > unassigned;
ties keep the crease that already belonged to the survivor. Merge wins over
the Kawasaki snap when both are in range.

**Reason.** Two vertices at the same point with no shared identity silently
break tiling, analysis, and repeat. The previous "vertex snap off during drag"
was only because merge was undefined. Absorbing the dragged id (not the
target) keeps the vertex the user aimed at, and one undo step covers drag +
merge + planarize.

**Reconsider when.** A dedicated "weld" tool or multi-vertex collapse is
needed; or duplicate-edge M vs V conflicts should prompt instead of ranking.

---

### Planarize on import, keep parse byte-faithful

**Decision.** `parseDocument` / `parseImportedDocument` still return the file
as written (native JSON or FOLD). The editor load path (`ingestImportedDocument`)
runs `planarizeDocument` so crossings gain vertices the same way a drawn crease
would. Already-planar files come back as the same object (planarize is
idempotent).

**Reason.** The editor invariant is "no crossing without a shared vertex."
Byte-faithful import left physically meaningless graphs in the canvas after
Open, which analysis then misread. Tests that care about the wire format still
call `parseDocument` directly.

**Reconsider when.** A "keep raw / show crossings" inspector is wanted for
debugging foreign files.

---

### FOLD is a second serialization, not a model change

**Decision.** Native `.origami.json` stays the document model. FOLD import/
export lives in `src/origami/foldFormat.ts` as a pure mapping (`M/V/U/B`,
`vertices_coords`, `edges_vertices`). Cuts (`C`) are skipped; flat folds (`F`)
become unassigned. Paper size is the vertex bounding box, translated into the
first quadrant.

**Reason.** Interop with Oripa / Rabbit Ear without making the in-memory model
a FOLD frame (ids, paper spec, and undo snapshots stay ours).

**Reconsider when.** We need `faces_vertices` round-trip or fold angles as
first-class data.

---

### Marquee is window-select, not crossing-select

**Decision.** A select-tool drag on empty canvas rubber-bands in screen space.
On release, vertices whose paper position lies in the axis-aligned paper rect
are selected; a crease is selected only if both endpoints are. Shift unions
with the current selection. Click-without-drag still clears.

**Reason.** Crease patterns are sparse; contained selection matches "grab these
vertices" and avoids picking a long crease that merely crosses the box. The
selection model already held both sets.

**Reconsider when.** Users ask to select a crease by crossing it (Illustrator
crossing mode); then add a modifier, don't replace window-select.

---

### Local theorems only: BLB + degree-4 layer order, no global solver

**Decision.** Big-little-big (strict local-min sectors) and a degree-4 local
layer-order check run in `analyzeDocument` with the same structured result
shape as Kawasaki/Maekawa. Global flat-foldability and NP-hard layer ordering
are not attempted. The fold preview states that painter-order stacking is a
heuristic. Auto-assignment enumerates at most 8 unassigned creases at one
Kawasaki-valid vertex.

**Reason.** The product claim is live local feedback beside the hand, not a
"this folds" certificate. A global solver would be slow, often incomplete, and
easy to overclaim.

**Reconsider when.** A restricted family (single-vertex, degree-4 maps, known
tessellation cells) has a complete local-to-global story worth shipping.

---

### Construction symmetry is session-baked copies, not a document field

**Decision.** 2-fold / 4-fold rotation and axial mirrors (`mx` left–right, `my`
up–down) live in `editorStore.symmetry`. Images are ordinary vertices and
creases around the paper centre. Enabling a mode runs `completeSymmetry` once;
later edits orbit only the geometry that changed. Mid-drag uses `moveOrbit`
only — never `completeSymmetry` per frame.

**Reason.** The document model stays vertices+creases (Swift-portable, JSON/
FOLD round-trip unchanged). The square twist is already 4-fold around
(100,100), so enabling the mode is a no-op. Per-edit orbits avoid exploding a
tiled pattern the next time the user places a vertex. 4-fold is well-defined
on the default square sheet; copies that leave non-square paper after Repeat
are clamped.

**Reconsider when.** Wallpaper groups, a live constraint solver, or a native
document-level symmetry record is actually needed for export (Oripa / FOLD
`frame_classes`). Unit-cell edge-matching is the remaining M3 tessellation
slice and is still later.
