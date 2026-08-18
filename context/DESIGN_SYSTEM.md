# Design system

Paper-craft identity: the app should look like a well-made desk tool for folding
paper, not like a SaaS dashboard and not like a toy.

Sources of truth: `src/app/globals.css` (CSS custom properties + component classes)
and `src/design-system/tokens.ts` (the same values for SVG rendering). They are
duplicated deliberately — SVG attributes cannot read CSS variables reliably — so
**changing a color means changing both.**

## Palette

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#faf6ef` | App background (warm off-white card stock) |
| `--paper-bright` | `#ffffff` | The origami sheet itself, inputs |
| `--paper-shade` | `#f1ebe0` | Recessed areas, segmented-control track |
| `--card` | `#fffdf8` | Floating panels, top bar, tool rail |
| `--ink` / `--ink-soft` / `--ink-faint` | `#2b2a28` / `#5f5b54` / `#97917f` | Text, primary button fill, paper border |
| `--cyan` / `--cyan-soft` | `#1ba5c4` / `#d9f1f6` | Focus rings, snap guides, draft crease, menu highlight |
| `--yellow` / `--yellow-soft` | `#ffc94d` / `#fff3d6` | Selection, active tool, brand mark |
| `--coral` / `--coral-soft` | `#e2574c` / `#fbe3e0` | Invalid state, destructive action |
| `--green` / `--green-soft` | `#3d9b6c` / `#def0e6` | Valid / flat-foldable, Kawasaki snap |

Status colors (`statusColors` in tokens.ts): `valid` green, `near` `#b98a00`
(amber, readable on light), `invalid` coral, `not-applicable` ink-faint.

## Surfaces

- **Graph-paper backdrop** (`.graph-paper`): four stacked linear gradients — minor
  grid at 16px (`rgba(43,42,40,0.055)`), major at 80px (`0.09`). It sits behind the
  canvas and is decorative only; it is *not* the snapping grid (that is 10 paper
  units, in document space).
- **Cards** (`.craft-card`): `--card` fill, 1px `ink/9%` border, 10px radius, layered
  shadow `--shadow-card` (tight 1px contact shadow + soft 14px lift). Popovers use
  `--shadow-lifted` (2px + 28px) so menus read as further off the desk.
- **The paper sheet** (`PaperLayer`): white rect with an offset `rgba(43,42,40,0.10)`
  shadow rect at +4/+6px — a sheet resting on the desk, not a CSS box-shadow.

## Type

- **Nunito** (`--font-nunito`, weights 400/600/700/800) for all UI. Rounded, warm,
  legible at 11px. Loaded via `next/font/google` in `src/app/layout.tsx`.
- **Caveat** (`--font-caveat`, `.font-hand`) for hand-written accents. Currently
  used only in the onboarding hint. Use it sparingly — one voice-of-the-author
  moment per screen, never for data.
- `.tnum` (`font-variant-numeric: tabular-nums`) on every number that can change:
  coordinates, angles, counts, zoom percentage. Digits must not jitter mid-drag.
- UI text runs bold-to-extrabold at small sizes (700–800 at 11–13px); section
  headings are 11px uppercase, letter-spaced, `--ink-faint`.

## Crease conventions

Origami-diagram standard, encoded by **both** color and dash pattern, so meaning
survives grayscale printing and color-blindness. Canvas values (`creaseStyles`):

| Assignment | Stroke | Dash | Width |
| --- | --- | --- | --- |
| mountain | `#d6453d` | `7 3 1.5 3` (dash-dot) | 2 |
| valley | `#1d7fd6` | `5 4` (dashed) | 2 |
| unassigned | `#8a857c` | solid | 1.5 |
| boundary | `#2b2a28` | solid | 2.5 |

SVG export (`src/export/svg.ts`) uses the same colors with print-tuned dashes
(`8 3 1.5 3`, `6 4`) and thinner strokes. Never introduce a third encoding.

## Canvas vs chrome

**The canvas stays clean; personality lives in the chrome.** On the sheet only
geometry and math live: creases, vertices, snap guides, analysis badges. No
gradients, no rounded-cartoon strokes, no decorative illustration, no animation of
geometry. Motion (`motion/react`) is limited to panel entry/exit — the inspector
slides 16px, the hint fades 8px — and `prefers-reduced-motion` kills all of it via
the global rule in `globals.css`.

Feedback on the canvas is drawn in SVG at screen scale (badge text 11.5px, snap
rings 8–10px radius) so it stays the same size at any zoom.

## Class inventory (`globals.css`)

| Class | Purpose |
| --- | --- |
| `.craft-card` | Any floating paper panel |
| `.btn` + `.btn-ghost` / `.btn-primary` / `.btn-outline` | 34px buttons; primary has a 2px hard bottom shadow and presses down 1px |
| `.tool-btn` | 56×52 icon+label tool rail button; `[data-active="true"]` → yellow-soft fill, yellow border, inset bottom bar |
| `.segment` | Segmented control (crease assignment picker) |
| `.chip` + `.chip-valid` / `.chip-near` / `.chip-invalid` / `.chip-muted` | Status pills |
| `.kbd` | Keycap hint: 2px bottom border, bright fill |
| `.field` | 32px number/text input |
| `.popover-surface` + `.menu-item` | Radix popover/menu shells |
| `.graph-paper`, `.tnum`, `.font-hand` | Backdrop and type utilities |

Focus is always a 2px `--cyan` outline with offset — every interactive class defines
`:focus-visible`. Do not remove it.

## Avoid

- Purple/indigo "AI" gradients, glow, or aurora backgrounds.
- Glassmorphism, blur-behind panels, translucent chrome over the canvas.
- Default shadcn/Radix-unstyled look — neutral grays, thin 500-weight text, 6px
  radii. Radix is used headless here; the styling is ours.
- Cartoon overload: bouncy springs, emoji in the UI, oversized rounded strokes,
  mascots. One hand-written line is the whole whimsy budget.
- Color-only meaning anywhere — creases, status, selection all carry a second cue
  (dash pattern, icon, ring, label).
- Pure `#fff` app background or pure `#000` text. The paper is warm; keep it warm.
