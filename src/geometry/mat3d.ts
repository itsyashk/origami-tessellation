/**
 * Minimal 3D affine transforms (3×4 row-major matrices) for the folding
 * preview. Only what folding needs: composition, application, and rotation
 * about an arbitrary line lying in the z=0 paper plane.
 */

import type { Vec2 } from "./vec2";

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Row-major 3×4: [r00 r01 r02 tx, r10 r11 r12 ty, r20 r21 r22 tz]. */
export type Mat34 = readonly number[];

export const MAT_IDENTITY: Mat34 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

export const applyMat = (m: Mat34, v: Vec3): Vec3 => ({
  x: m[0] * v.x + m[1] * v.y + m[2] * v.z + m[3],
  y: m[4] * v.x + m[5] * v.y + m[6] * v.z + m[7],
  z: m[8] * v.x + m[9] * v.y + m[10] * v.z + m[11],
});

/** Composition: (multiplyMat(a, b))(v) === a(b(v)). */
export const multiplyMat = (a: Mat34, b: Mat34): Mat34 => {
  const out = new Array<number>(12);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      out[row * 4 + col] =
        a[row * 4] * b[col] + a[row * 4 + 1] * b[4 + col] + a[row * 4 + 2] * b[8 + col];
    }
    out[row * 4 + 3] =
      a[row * 4] * b[3] +
      a[row * 4 + 1] * b[7] +
      a[row * 4 + 2] * b[11] +
      a[row * 4 + 3];
  }
  return out;
};

/**
 * Rotation by `angle` (right-hand rule) about the line through `point` with
 * unit direction `dir`, both in the z=0 plane.
 */
export const rotationAboutLine = (
  point: Vec2,
  dir: Vec2,
  angle: number,
): Mat34 => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  const ux = dir.x;
  const uy = dir.y;
  // Rodrigues with uz = 0.
  const r = [
    c + t * ux * ux, t * ux * uy, s * uy,
    t * ux * uy, c + t * uy * uy, -s * ux,
    -s * uy, s * ux, c,
  ];
  // Translation so the line is fixed: t = p − R·p (p on the line, z = 0).
  const px = point.x;
  const py = point.y;
  const tx = px - (r[0] * px + r[1] * py);
  const ty = py - (r[3] * px + r[4] * py);
  const tz = 0 - (r[6] * px + r[7] * py);
  return [r[0], r[1], r[2], tx, r[3], r[4], r[5], ty, r[6], r[7], r[8], tz];
};

/** Rotation about the world x-axis (for the preview camera tilt). */
export const rotationX = (angle: number): Mat34 => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0];
};

/** Rotation about the world z-axis (for the preview camera spin). */
export const rotationZ = (angle: number): Mat34 => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0];
};

export const translation = (x: number, y: number, z: number): Mat34 => [
  1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z,
];
