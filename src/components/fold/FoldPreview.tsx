"use client";

/**
 * Fold preview: a physically simulated folding animation and the folded
 * result.
 *
 * The paper is a triangulated mass-spring mesh (`src/origami/foldSim.ts`):
 * connected by construction, so it can never tear; inextensible bars keep it
 * from stretching; hinge torques drive creases toward the slider's fold
 * fraction while facet hinges let it bend the way real paper bends on
 * non-rigid patterns (twists). This component only steps the sim each frame
 * and draws the triangles.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Slider from "@radix-ui/react-slider";
import { Pause, Play, TriangleAlert, X } from "lucide-react";
import { buildFoldSim } from "@/origami/foldSim";
import { simOptionsForDocName } from "@/origami/patterns/library";
import {
  applyMat,
  multiplyMat,
  rotationX,
  rotationZ,
  MAT_IDENTITY,
  type Mat34,
  type Vec3,
} from "@/geometry/mat3d";
import { useDocumentStore } from "@/state/documentStore";
import { useEditorStore } from "@/state/editorStore";
import { useAnalysis } from "@/state/useAnalysis";

const FRONT = { r: 0xfd, g: 0xfb, b: 0xf7 };
const BACK = { r: 0xbc, g: 0xe2, b: 0xec };
const INK = { r: 0x2b, g: 0x2a, b: 0x28 };
const LIGHT = normalize3({ x: 0.35, y: 0.45, z: 0.82 });

/** Simulation substeps per animation frame. */
const STEPS_PER_FRAME = 14;
/** Play duration for the full fold, ms. */
const PLAY_MS = 3200;

function normalize3(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

const shade = (
  base: { r: number; g: number; b: number },
  lambert: number,
): string => {
  const k = 0.7 + 0.3 * lambert;
  const mix = (c: number, ink: number) => Math.round(ink + (c - ink) * k);
  return `rgb(${mix(base.r, INK.r)}, ${mix(base.g, INK.g)}, ${mix(base.b, INK.b)})`;
};

export function FoldPreview() {
  const open = useEditorStore((s) => s.foldOpen);
  const setFoldOpen = useEditorStore((s) => s.setFoldOpen);
  // Mount the content fresh each time the preview opens, so its state
  // (fold fraction, playback, view) resets via initializers.
  if (!open) return null;
  return <FoldPreviewContent onOpenChange={setFoldOpen} />;
}

function FoldPreviewContent({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const doc = useDocumentStore((s) => s.doc);
  const analysis = useAnalysis();
  const sim = useMemo(
    () => buildFoldSim(doc, simOptionsForDocName(doc.name)),
    [doc],
  );

  const [t, setT] = useState(0);
  const tRef = useRef(0);
  // Autoplay on open unless the user prefers reduced motion. This only
  // renders client-side (the dialog opens on interaction), so reading
  // matchMedia in the initializer is safe.
  const [playing, setPlaying] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [topView, setTopView] = useState(false);
  const [, setFrame] = useState(0);

  const setFold = (value: number, fastForward = false) => {
    const from = tRef.current;
    tRef.current = value;
    setT(value);
    // Jumping the target far in one go can jam non-rigid patterns in a bent
    // local minimum; ramp quasi-statically instead.
    if (fastForward) sim.rampTo(from, value);
  };

  // The simulation heartbeat: advance the fold fraction while playing and
  // step the physics every frame (it also settles after scrubbing stops).
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setPlaying((isPlaying) => {
        if (isPlaying) {
          tRef.current = Math.min(1, tRef.current + dt / PLAY_MS);
          setT(tRef.current);
          if (tRef.current >= 1) return false;
        }
        return isPlaying;
      });
      sim.step(tRef.current, STEPS_PER_FRAME);
      setFrame((f) => f + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sim]);

  const view: Mat34 = useMemo(
    () =>
      topView ? MAT_IDENTITY : multiplyMat(rotationX(-1.05), rotationZ(-0.4)),
    [topView],
  );

  // Fixed framing from the flat sheet so the camera never jumps.
  const viewBox = useMemo(() => {
    const { width: w, height: h } = doc.paper;
    const corners = [
      { x: 0, y: 0, z: 0 },
      { x: w, y: 0, z: 0 },
      { x: w, y: h, z: 0 },
      { x: 0, y: h, z: 0 },
    ].map((p) => applyMat(view, p));
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => -p.y);
    const margin = 0.32 * Math.max(w, h);
    return `${Math.min(...xs) - margin} ${Math.min(...ys) - margin} ${
      Math.max(...xs) - Math.min(...xs) + 2 * margin
    } ${Math.max(...ys) - Math.min(...ys) + 2 * margin}`;
  }, [doc.paper, view]);

  // Project the mesh: triangles shaded and painter-sorted, then crease and
  // boundary edges drawn from the same node positions. Computed every
  // render — the frame counter re-renders per simulation step by design.
  const { trianglePolys, edgeLines } = (() => {
    const { positions, triangles } = sim;
    const projected: Vec3[] = new Array(sim.nodeCount);
    for (let n = 0; n < sim.nodeCount; n++) {
      projected[n] = applyMat(view, {
        x: positions[n * 3],
        y: positions[n * 3 + 1],
        z: positions[n * 3 + 2],
      });
    }
    const polys: { key: number; attr: string; fill: string; z: number }[] = [];
    for (let ti = 0; ti < triangles.length / 3; ti++) {
      const a = projected[triangles[ti * 3]];
      const b = projected[triangles[ti * 3 + 1]];
      const c = projected[triangles[ti * 3 + 2]];
      // Triangle normal in view space.
      const ux = b.x - a.x;
      const uy = b.y - a.y;
      const uz = b.z - a.z;
      const vx = c.x - a.x;
      const vy = c.y - a.y;
      const vz = c.z - a.z;
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const nlen = Math.hypot(nx, ny, nz) || 1e-9;
      nx /= nlen;
      ny /= nlen;
      nz /= nlen;
      const lambert = Math.abs(nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z);
      polys.push({
        key: ti,
        attr: `${a.x.toFixed(2)},${(-a.y).toFixed(2)} ${b.x.toFixed(2)},${(-b.y).toFixed(2)} ${c.x.toFixed(2)},${(-c.y).toFixed(2)}`,
        fill: shade(nz >= 0 ? FRONT : BACK, lambert),
        z: (a.z + b.z + c.z) / 3,
      });
    }
    polys.sort((p, q) => p.z - q.z);

    const lines: { key: string; x1: number; y1: number; x2: number; y2: number; boundary: boolean }[] = [];
    for (const edge of sim.boundaryEdges) {
      const a = projected[edge.a];
      const b = projected[edge.b];
      lines.push({ key: `b${edge.a}-${edge.b}`, x1: a.x, y1: -a.y, x2: b.x, y2: -b.y, boundary: true });
    }
    for (const edge of sim.creaseEdges) {
      const a = projected[edge.a];
      const b = projected[edge.b];
      lines.push({ key: `c${edge.a}-${edge.b}`, x1: a.x, y1: -a.y, x2: b.x, y2: -b.y, boundary: false });
    }
    return { trianglePolys: polys, edgeLines: lines };
  })();

  const hasCreases = doc.creases.length > 0;
  const invalidCount = analysis.invalidVertexCount + analysis.nearVertexCount;

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-(--ink)/30 backdrop-blur-[2px]" />
        <Dialog.Content
          className="craft-card fixed left-1/2 top-1/2 z-50 flex h-[min(88dvh,720px)] w-[min(94vw,920px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 p-4 focus:outline-none"
          aria-describedby={undefined}
          data-testid="fold-preview"
        >
          <div className="flex items-center gap-3">
            <Dialog.Title className="text-sm font-extrabold">
              Fold preview
              <span className="ml-2 font-semibold text-(--ink-faint)">
                {doc.name}
              </span>
            </Dialog.Title>
            <div className="flex-1" />
            {invalidCount > 0 && (
              <span
                className="chip chip-invalid"
                title="Kawasaki/Maekawa violations — the folded form may not lie flat"
              >
                <TriangleAlert size={13} strokeWidth={2.5} />
                {invalidCount} vertex{invalidCount === 1 ? "" : "es"} not flat-foldable
              </span>
            )}
            {sim.model.unassignedHingeCount > 0 && (
              <span
                className="chip chip-near"
                title="Unassigned creases don't fold — assign mountain or valley"
              >
                {sim.model.unassignedHingeCount} unassigned stay flat
              </span>
            )}
            <Dialog.Close asChild>
              <button
                type="button"
                className="btn btn-ghost h-8 w-8 px-0"
                aria-label="Close fold preview"
                data-testid="fold-close"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="graph-paper relative min-h-0 flex-1 overflow-hidden rounded-lg border border-(--ink)/10">
            {hasCreases ? (
              <svg
                className="h-full w-full"
                viewBox={viewBox}
                data-testid="fold-canvas"
                role="img"
                aria-label={`Folding preview at ${Math.round(t * 100)} percent folded`}
              >
                {trianglePolys.map((poly) => (
                  <polygon
                    key={poly.key}
                    data-testid="fold-face"
                    points={poly.attr}
                    fill={poly.fill}
                    stroke={poly.fill}
                    strokeWidth={0.5}
                    strokeLinejoin="round"
                  />
                ))}
                {edgeLines.map((line) => (
                  <line
                    key={line.key}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke="#2b2a28"
                    strokeWidth={line.boundary ? 1.3 : 0.6}
                    strokeLinecap="round"
                    // Lines are drawn over the whole mesh (no hidden-line
                    // removal in SVG); keep them faint so occluded creases
                    // read as texture, not wireframe.
                    opacity={line.boundary ? 0.75 : 0.3}
                  />
                ))}
              </svg>
            ) : (
              <div className="grid h-full place-items-center">
                <p className="font-hand max-w-64 -rotate-2 text-center text-[19px] leading-snug text-(--ink-faint)">
                  draw some creases first — then watch the paper fold itself
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-outline"
              data-testid="fold-flat"
              onClick={() => {
                setPlaying(false);
                setFold(0);
              }}
            >
              Flat
            </button>
            <button
              type="button"
              className="btn btn-primary w-24"
              data-testid="fold-play"
              onClick={() => {
                if (playing) {
                  setPlaying(false);
                } else {
                  if (tRef.current >= 1) {
                    sim.reset();
                    setFold(0);
                  }
                  setPlaying(true);
                }
              }}
              disabled={!hasCreases}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
              {playing ? "Pause" : "Fold"}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              data-testid="fold-folded"
              onClick={() => {
                setPlaying(false);
                setFold(1, true);
              }}
            >
              Folded
            </button>

            <Slider.Root
              className="relative mx-2 flex h-6 min-w-32 flex-1 touch-none select-none items-center"
              min={0}
              max={1}
              step={0.001}
              value={[t]}
              onValueChange={([value]) => {
                setPlaying(false);
                // A click far along the track is a jump; ramp it. Drags
                // arrive as small increments and stay fully live.
                setFold(value, Math.abs(value - tRef.current) > 0.15);
              }}
              aria-label="Fold amount"
              data-testid="fold-slider"
            >
              <Slider.Track className="relative h-1.5 grow rounded-full bg-(--paper-shade)">
                <Slider.Range className="absolute h-full rounded-full bg-(--cyan)" />
              </Slider.Track>
              <Slider.Thumb className="block h-4.5 w-4.5 rounded-full border-2 border-(--ink) bg-(--yellow) shadow focus:outline-2 focus:outline-(--cyan)" />
            </Slider.Root>

            <span className="tnum w-12 text-right text-xs font-bold text-(--ink-soft)">
              {Math.round(t * 100)}%
            </span>
            <button
              type="button"
              className="btn btn-outline"
              data-active={topView}
              data-testid="fold-topview"
              aria-pressed={topView}
              onClick={() => setTopView((v) => !v)}
              style={
                topView
                  ? { borderColor: "var(--cyan)", background: "var(--cyan-soft)" }
                  : undefined
              }
            >
              Top view
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
