import type { Vec2 } from "./vec2";
import { add, cross, distance, dot, lengthSq, scale, sub } from "./vec2";
import { clamp, POSITION_EPSILON } from "./tolerance";

export interface Segment {
  readonly a: Vec2;
  readonly b: Vec2;
}

/** Parameter t in [0, 1] of the point on segment ab closest to p. */
export const closestParamOnSegment = (p: Vec2, a: Vec2, b: Vec2): number => {
  const ab = sub(b, a);
  const denom = lengthSq(ab);
  if (denom === 0) return 0;
  return clamp(dot(sub(p, a), ab) / denom, 0, 1);
};

export const closestPointOnSegment = (p: Vec2, a: Vec2, b: Vec2): Vec2 => {
  const t = closestParamOnSegment(p, a, b);
  return add(a, scale(sub(b, a), t));
};

export const distanceToSegment = (p: Vec2, a: Vec2, b: Vec2): number =>
  distance(p, closestPointOnSegment(p, a, b));

export interface SegmentIntersection {
  point: Vec2;
  /** Parameter along the first segment, in [0, 1]. */
  t: number;
  /** Parameter along the second segment, in [0, 1]. */
  u: number;
}

/**
 * Proper intersection of two segments, or null when they are parallel,
 * collinear, or do not overlap. Endpoint touches count as intersections.
 */
export const segmentIntersection = (
  a1: Vec2,
  a2: Vec2,
  b1: Vec2,
  b2: Vec2,
  epsilon = POSITION_EPSILON,
): SegmentIntersection | null => {
  const r = sub(a2, a1);
  const s = sub(b2, b1);
  const denom = cross(r, s);
  if (Math.abs(denom) < epsilon) return null;
  const qp = sub(b1, a1);
  const t = cross(qp, s) / denom;
  const u = cross(qp, r) / denom;
  const slack = epsilon;
  if (t < -slack || t > 1 + slack || u < -slack || u > 1 + slack) return null;
  return {
    point: add(a1, scale(r, clamp(t, 0, 1))),
    t: clamp(t, 0, 1),
    u: clamp(u, 0, 1),
  };
};

/** Whether point p lies on segment ab within `epsilon` distance. */
export const pointOnSegment = (
  p: Vec2,
  a: Vec2,
  b: Vec2,
  epsilon = POSITION_EPSILON,
): boolean => distanceToSegment(p, a, b) <= epsilon;
