/**
 * Shared helpers for parametric pattern generators.
 *
 * Generators build documents with deterministic, human-readable ids so the
 * same pattern is byte-identical across runs (stable thumbnails, testable
 * snapshots, meaningful diffs).
 */

import type { Vec2 } from "@/geometry/vec2";
import type {
  CreaseAssignment,
  OrigamiDocument,
  Vertex,
  Crease,
} from "../model";

export const PAPER = 200;

export class PatternBuilder {
  private vertices: Vertex[] = [];
  private creases: Crease[] = [];
  private byPosition = new Map<string, string>();
  private creaseCounter = 0;

  constructor(
    private name: string,
    private size = PAPER,
  ) {}

  private posKey(p: Vec2): string {
    return `${p.x.toFixed(6)}|${p.y.toFixed(6)}`;
  }

  /** Add (or reuse) a vertex at a position. Coincident points merge. */
  vertex(p: Vec2, id?: string): string {
    const key = this.posKey(p);
    const existing = this.byPosition.get(key);
    if (existing) return existing;
    const vid = id ?? `v${this.vertices.length}`;
    this.vertices.push({ id: vid, x: p.x, y: p.y });
    this.byPosition.set(key, vid);
    return vid;
  }

  /** Add a crease between two positions (vertices created/reused). */
  crease(a: Vec2, b: Vec2, assignment: CreaseAssignment): void {
    const av = this.vertex(a);
    const bv = this.vertex(b);
    if (av === bv) return;
    const exists = this.creases.some(
      (c) =>
        (c.startVertexId === av && c.endVertexId === bv) ||
        (c.startVertexId === bv && c.endVertexId === av),
    );
    if (exists) return;
    this.creases.push({
      id: `c${this.creaseCounter++}`,
      startVertexId: av,
      endVertexId: bv,
      assignment,
    });
  }

  /** A straight line creased as segments through the given points. */
  polyline(points: Vec2[], assignment: CreaseAssignment): void {
    for (let i = 0; i < points.length - 1; i++) {
      this.crease(points[i], points[i + 1], assignment);
    }
  }

  build(): OrigamiDocument {
    return {
      version: 1,
      name: this.name,
      paper: { width: this.size, height: this.size },
      vertices: this.vertices,
      creases: this.creases,
    };
  }
}

/**
 * First intersection of the ray from `origin` along `angle` (radians) with
 * the paper boundary. Origin must be inside (or on) the paper.
 */
export const rayToBoundary = (
  origin: Vec2,
  angle: number,
  size = PAPER,
): Vec2 => {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = Infinity;
  const consider = (t: number) => {
    if (t > 1e-9 && t < best) {
      const x = origin.x + dx * t;
      const y = origin.y + dy * t;
      if (x >= -1e-6 && x <= size + 1e-6 && y >= -1e-6 && y <= size + 1e-6) {
        best = t;
      }
    }
  };
  if (Math.abs(dx) > 1e-12) {
    consider((0 - origin.x) / dx);
    consider((size - origin.x) / dx);
  }
  if (Math.abs(dy) > 1e-12) {
    consider((0 - origin.y) / dy);
    consider((size - origin.y) / dy);
  }
  const clamp = (v: number) => Math.min(size, Math.max(0, v));
  return { x: clamp(origin.x + dx * best), y: clamp(origin.y + dy * best) };
};

export const degToRadP = (deg: number): number => (deg * Math.PI) / 180;
