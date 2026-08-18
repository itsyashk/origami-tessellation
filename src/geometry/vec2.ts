/**
 * Minimal 2D vector math over plain `{ x, y }` objects.
 *
 * Plain objects (rather than a class) keep the document model serializable
 * and portable to other runtimes (e.g. a future Swift port mirrors these as
 * free functions over a `CGPoint`-like struct).
 */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const neg = (a: Vec2): Vec2 => ({ x: -a.x, y: -a.y });

export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
/** 2D cross product (z-component). Positive when b is counter-clockwise from a. */
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;

export const lengthSq = (a: Vec2): number => a.x * a.x + a.y * a.y;
export const length = (a: Vec2): number => Math.hypot(a.x, a.y);

export const distanceSq = (a: Vec2, b: Vec2): number => lengthSq(sub(a, b));
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export const midpoint = (a: Vec2, b: Vec2): Vec2 => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export const normalize = (a: Vec2): Vec2 => {
  const len = length(a);
  if (len === 0) return { x: 0, y: 0 };
  return { x: a.x / len, y: a.y / len };
};

/** Perpendicular vector (rotated 90° counter-clockwise in a y-up frame). */
export const perp = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x });

/** Angle of the vector in radians, in (-π, π]. */
export const angleOf = (a: Vec2): number => Math.atan2(a.y, a.x);

export const fromAngle = (angle: number, magnitude = 1): Vec2 => ({
  x: Math.cos(angle) * magnitude,
  y: Math.sin(angle) * magnitude,
});

export const rotate = (a: Vec2, angle: number): Vec2 => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};

export const rotateAround = (a: Vec2, center: Vec2, angle: number): Vec2 =>
  add(center, rotate(sub(a, center), angle));

export const equalsWithin = (a: Vec2, b: Vec2, epsilon: number): boolean =>
  distanceSq(a, b) <= epsilon * epsilon;
