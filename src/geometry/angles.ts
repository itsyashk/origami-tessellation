/** Angle utilities. All angles are radians unless a name says otherwise. */

export const TAU = Math.PI * 2;

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;
export const radToDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Normalize an angle into [0, 2π). */
export const normalizeAngle = (angle: number): number => {
  const a = angle % TAU;
  return a < 0 ? a + TAU : a;
};

/** Normalize an angle into (-π, π]. */
export const normalizeSignedAngle = (angle: number): number => {
  const a = normalizeAngle(angle);
  return a > Math.PI ? a - TAU : a;
};

/** Smallest absolute difference between two angles, in [0, π]. */
export const angleDifference = (a: number, b: number): number => {
  const d = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return d > Math.PI ? TAU - d : d;
};

/**
 * Counter-clockwise sector from angle `from` to angle `to`, in [0, 2π).
 * `ccwSector(0, π/2)` is π/2; `ccwSector(π/2, 0)` is 3π/2.
 */
export const ccwSector = (from: number, to: number): number =>
  normalizeAngle(to - from);

/**
 * Given a set of ray angles out of a common point, return the consecutive
 * sector angles in counter-clockwise order, starting from the smallest ray
 * angle. The result always sums to 2π (for 2+ rays) and is aligned with the
 * sorted ray order: `sectors[i]` lies between `sortedRays[i]` and
 * `sortedRays[i + 1]`.
 */
export const sectorAnglesFromRays = (rayAngles: number[]): number[] => {
  if (rayAngles.length < 2) return [];
  const sorted = rayAngles.map(normalizeAngle).sort((a, b) => a - b);
  const sectors: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length];
    const raw = next - sorted[i];
    sectors.push(i === sorted.length - 1 ? raw + TAU : raw);
  }
  return sectors;
};

/** Snap an angle to the nearest multiple of `step`, if within `tolerance`. */
export const snapAngleToStep = (
  angle: number,
  step: number,
  tolerance: number,
): number | null => {
  const snapped = Math.round(angle / step) * step;
  return Math.abs(normalizeSignedAngle(angle - snapped)) <= tolerance ? snapped : null;
};
