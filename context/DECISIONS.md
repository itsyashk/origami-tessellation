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
