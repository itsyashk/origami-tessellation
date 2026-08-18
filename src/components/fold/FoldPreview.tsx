"use client";

/**
 * Fold preview: an overlay that animates the crease pattern folding in 3D
 * and shows the final flat-folded result.
 *
 * All fold mathematics lives in `src/origami/fold.ts`; this component only
 * projects the transformed faces, shades them (front = paper, back = cyan,
 * classic duo paper), painter-sorts them, and drives the timeline. Faces
 * respond instantly to the slider; only the Play button animates, and it
 * never autoplays under prefers-reduced-motion.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Slider from "@radix-ui/react-slider";
import { Pause, Play, TriangleAlert, X } from "lucide-react";
import { buildFoldModel, foldedFaceTransforms } from "@/origami/fold";
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

function normalize3(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/** Newell normal of a 3D polygon. */
const polygonNormal = (points: Vec3[]): Vec3 => {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    x += (p.y - q.y) * (p.z + q.z);
    y += (p.z - q.z) * (p.x + q.x);
    z += (p.x - q.x) * (p.y + q.y);
  }
  return normalize3({ x, y, z });
};

const shade = (
  base: { r: number; g: number; b: number },
  lambert: number,
): string => {
  const k = 0.72 + 0.28 * lambert;
  const mix = (c: number, ink: number) => Math.round(ink + (c - ink) * k);
  return `rgb(${mix(base.r, INK.r)}, ${mix(base.g, INK.g)}, ${mix(base.b, INK.b)})`;
};

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

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
  const model = useMemo(() => buildFoldModel(doc), [doc]);

  const [t, setT] = useState(0);
  // Autoplay on open unless the user prefers reduced motion. This only
  // renders client-side (the dialog opens on interaction), so reading
  // matchMedia in the initializer is safe.
  const [playing, setPlaying] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [topView, setTopView] = useState(false);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (!playing) return;
    lastTimeRef.current = performance.now();
    const tick = (now: number) => {
      const dt = now - lastTimeRef.current;
      lastTimeRef.current = now;
      setT((prev) => {
        const next = prev + dt / 2400;
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  const view: Mat34 = useMemo(
    () =>
      topView
        ? MAT_IDENTITY
        : multiplyMat(rotationX(-1.05), rotationZ(-0.4)),
    [topView],
  );

  // Fixed framing: the flat sheet's projected bounds plus generous margin,
  // so the animation never causes the camera to jump.
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
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const margin = 0.3 * Math.max(w, h);
    return `${minX - margin} ${minY - margin} ${maxX - minX + 2 * margin} ${maxY - minY + 2 * margin}`;
  }, [doc.paper, view]);

  const rendered = useMemo(() => {
    if (model.graph.faces.length === 0) return [];
    const transforms = foldedFaceTransforms(model, easeInOutCubic(t));
    const polys = model.graph.faces.map((face, i) => {
      const points = face.polygon.map((p) =>
        applyMat(view, applyMat(transforms[i], { x: p.x, y: p.y, z: 0 })),
      );
      const normal = polygonNormal(points);
      const lambert = Math.abs(
        normal.x * LIGHT.x + normal.y * LIGHT.y + normal.z * LIGHT.z,
      );
      const avgZ =
        points.reduce((sum, p) => sum + p.z, 0) / Math.max(1, points.length);
      return {
        key: i,
        attr: points.map((p) => `${p.x.toFixed(2)},${(-p.y).toFixed(2)}`).join(" "),
        fill: shade(normal.z >= 0 ? FRONT : BACK, lambert),
        // Painter sort: view depth, with the stacking hint breaking the tie
        // once everything is coplanar again.
        sortKey: avgZ + model.layers[i] * 0.15,
      };
    });
    polys.sort((a, b) => a.sortKey - b.sortKey);
    return polys;
  }, [model, t, view]);

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
              <span className="chip chip-invalid" title="Kawasaki/Maekawa violations — the folded form may self-intersect">
                <TriangleAlert size={13} strokeWidth={2.5} />
                {invalidCount} vertex{invalidCount === 1 ? "" : "es"} not flat-foldable
              </span>
            )}
            {model.unassignedHingeCount > 0 && (
              <span className="chip chip-near" title="Unassigned creases don't fold — assign mountain or valley">
                {model.unassignedHingeCount} unassigned stay flat
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
                {rendered.map((poly) => (
                  <polygon
                    key={poly.key}
                    data-testid="fold-face"
                    points={poly.attr}
                    fill={poly.fill}
                    stroke="#2b2a28"
                    strokeWidth={0.8}
                    strokeLinejoin="round"
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
                setT(0);
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
                  if (t >= 1) setT(0);
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
                setT(1);
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
                setT(value);
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
              style={topView ? { borderColor: "var(--cyan)", background: "var(--cyan-soft)" } : undefined}
            >
              Top view
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
