# Native iPhone app

Not started. This is the plan the web codebase is being written against, so that
the port is a translation rather than a rewrite.

## Stack

| Concern | Choice |
| --- | --- |
| Language | Swift 6, strict concurrency |
| UI | SwiftUI for chrome (top bar, tool rail, inspector sheet, menus) |
| Canvas | Core Graphics inside a `Canvas`/`UIView` drawing layer; Metal only if profiling demands it |
| Gestures | `UIGestureRecognizer` subclasses driving a port of `EditorController` |
| Storage | `FileDocument` / `ReferenceFileDocument` with a custom `UTType` |
| Haptics | Core Haptics, with `UIFeedbackGenerator` as the fallback path |

## What ports 1:1

The document model is deliberately free of web concepts — plain data, stable string
ids, pure `doc → doc` operations — so it becomes Swift structs directly:

```swift
struct Vertex: Codable, Identifiable { let id: String; var x: Double; var y: Double }
struct Crease: Codable, Identifiable {
    let id: String; var startVertexId: String; var endVertexId: String
    var assignment: CreaseAssignment
}
struct OrigamiDocument: Codable {
    var version: Int; var name: String; var paper: PaperSpec
    var vertices: [Vertex]; var creases: [Crease]
}
```

The JSON wire format is unchanged, so web and iOS read each other's files.

The engines are pure functions with no dependencies beyond the model and basic
math, and port as free functions or `enum` namespaces:

- `geometry/vec2`, `angles`, `segment`, `tolerance` → small Swift value types over
  `CGPoint`-like structs.
- `origami/analysis` → `analyzeVertex`, `analyzeDocument` returning the same
  structured results (status, residual, expected vs actual, explanation).
- `origami/kawasakiSnap` → the same gradient descent, unchanged constants.
- `geometry/snap` → same priority order, same tolerances.
- `editor/viewport`, `editor/hitTest` → unchanged arithmetic. Note paper space is
  y-up while UIKit is y-down, the same flip the web viewport already performs.

`INTERACTIONS.md` is the gesture contract; keep the constants identical so the two
apps feel the same.

## Interaction mapping

| Web | iOS |
| --- | --- |
| Pointer press + 4px threshold + drag | One-finger pan gesture, same 4pt threshold |
| Wheel zoom at cursor | Pinch, anchored at the gesture centroid (already implemented for touch on web) |
| Middle-drag / space-drag pan | Two-finger pan, or one-finger drag in the Pan tool |
| Hover highlight | No hover: use touch-down (highlight on finger contact) and selection state |
| Right-click / Escape cancel | Second finger down cancels the in-flight gesture; a Cancel affordance during drafts |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Three-finger swipe left/right, shake-to-undo, plus explicit undo/redo buttons in the toolbar |
| Tool keys `V P C H` | Tool rail buttons (also a hardware-keyboard path for iPad later) |
| Keys `1 2 3` assignment | Assignment segmented control in the selection sheet |
| Inspector floating panel | Bottom sheet with detents, appearing on selection |
| Status bar readout | Compact overlay; the coordinate readout can be omitted on phone |

Touch targets: the web build already uses 44px-equivalent controls (tool buttons
56×52, icon buttons 34–36px with padding), so the layout translates without
resizing the hit areas.

## Haptics

Core Haptics carries information; it never decorates. A user who cannot see the
badge should still be able to feel that something became valid.

| Event | Pattern |
| --- | --- |
| Snapping onto a vertex, guide, or grid; selecting a crease | Very light transient tick (intensity ~0.3, sharpness ~0.6) |
| Completing a crease; snapping into a valid constraint | Light-to-medium impact |
| A vertex becomes flat-foldable; a unit cell completes | Success pattern (two ascending transients) |
| Impossible operation; breaking a satisfied constraint | Warning pattern (two dull transients) |

Rules:

- **No continuous vibration during drags.** Only transitions fire — the web
  controller already tracks `lastSnapKind` frame-to-frame for exactly this reason.
- One event, one haptic. Never stack a snap tick and a success pattern in the same
  frame; the stronger one wins.
- Everything degrades silently when haptics are unavailable or the user has them
  off, exactly as `navigator.vibrate` does on the web.

## Documents and files

- Custom `UTType` for `.origami.json`, conforming to `public.json`, matching the
  extension the web export already produces (`<slug>.origami.json`).
- `FileDocument`-based app so patterns live in the Files app, support drag and
  drop, versioning, and the share sheet.
- SVG export via the share sheet, reusing a port of `src/export/svg.ts`.
- iCloud Documents later; local files first. No account, no sync service in v1.

## Open questions

- Whether the analysis loop stays fully synchronous on device, or moves to a
  background actor with the render layer reading the last completed result.
- Whether to render creases through `Canvas` (SwiftUI) or a `CALayer` per crease —
  the web build's per-element transform approach argues for immediate-mode drawing.
