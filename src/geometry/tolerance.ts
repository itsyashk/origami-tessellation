/**
 * Central tolerance constants for geometric and origami computations.
 *
 * The document uses abstract "paper units" (default paper is 200×200).
 * All tolerances are expressed in those units or in radians, never pixels;
 * screen-space tolerances live in the editor layer where the zoom is known.
 */

/** Positions closer than this are considered coincident (paper units). */
export const POSITION_EPSILON = 1e-6;

/**
 * How close (paper units) a vertex must be to a paper edge to count as a
 * boundary vertex — exempt from interior flat-foldability theorems.
 */
export const BOUNDARY_EPSILON = 1e-4;

/** Angles closer than this are considered equal (radians), ~0.0006°. */
export const ANGLE_EPSILON = 1e-5;

/**
 * Kawasaki / Maekawa validity threshold in radians (~0.1°).
 * Below this, a vertex is reported as satisfying the theorem; small residual
 * error is still reported numerically so the UI can show "0.0° off" honestly.
 */
export const FOLDABILITY_ANGLE_TOLERANCE = (0.1 * Math.PI) / 180;

/**
 * "Near miss" threshold in radians (~4°). Between the validity tolerance and
 * this, the UI treats a vertex as *almost* valid: it shows the residual error
 * and offers a snap toward the exact configuration.
 */
export const FOLDABILITY_NEAR_TOLERANCE = (4 * Math.PI) / 180;

export const approxEqual = (a: number, b: number, epsilon = POSITION_EPSILON): boolean =>
  Math.abs(a - b) <= epsilon;

export const approxZero = (a: number, epsilon = POSITION_EPSILON): boolean =>
  Math.abs(a) <= epsilon;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
