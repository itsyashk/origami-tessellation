/**
 * Physically-based folding simulation (Origami Simulator style).
 *
 * The sheet is triangulated into a mass-spring mesh:
 *  - axial springs on every triangle edge keep the paper inextensible,
 *  - crease hinges apply torques driving their dihedral angle toward
 *    t·π·(±1) (valley up, mountain down),
 *  - facet hinges (triangulation-internal edges) prefer flat but are softer,
 *    letting the paper BEND the way real paper does on non-rigid patterns.
 *
 * Because every triangle shares nodes with its neighbors, the mesh is
 * connected by construction — the animation physically cannot tear, unlike
 * the earlier per-face kinematic transform.
 *
 * Explicit damped integration; the root face is pinned so the model doesn't
 * drift. Hinge forces use the torque-free distribution (opposite nodes
 * pushed along their face normals, edge nodes compensating barycentrically),
 * the standard formulation from cloth/origami simulators.
 */

import { buildFoldModel, foldedFaceTransforms, type FoldModel } from "./fold";
import { applyMat } from "@/geometry/mat3d";
import type { OrigamiDocument } from "./model";

export interface FoldSimOptions {
  axialStiffness?: number;
  creaseStiffness?: number;
  facetStiffness?: number;
  /**
   * Pull toward the analytic tree-kinematic fold state. Weak by design: it
   * disambiguates fold direction and mid-fold saddle points (which pure
   * torque driving can jam in), while bars and hinges keep the paper
   * connected and inextensible where the analytic map would tear.
   */
  guideStiffness?: number;
  damping?: number;
  dt?: number;
  /** EXPERIMENT: override the guide weight schedule. */
  guidePhaseFn?: (t: number, isTree: boolean) => number;
  /** EXPERIMENT: hinge target = t * PI * cap. */
  cap?: number;
  /** EXPERIMENT: PBD projection passes per iteration. */
  passes?: number;
  /** EXPERIMENT: minimum hinge lever arm as a fraction of its rest height. */
  minLever?: number;
  /** EXPERIMENT: analytic-map disagreement (× paper size) that halves trust. */
  guideTolerance?: number;
  /** EXPERIMENT: distance (× paper size) at which the guide pull halves. */
  guideReach?: number;
  /** Endgame crease-drive boost factor (0 disables the press). */
  pressBoost?: number;
}

interface Bar {
  a: number;
  b: number;
  rest: number;
}

interface Hinge {
  /** Edge node indices. */
  a: number;
  b: number;
  /** Opposite node in each adjacent triangle. */
  c: number;
  d: number;
  /** +1 valley, −1 mountain for creases; 0 for facet (flat) hinges. */
  sign: number;
  isCrease: boolean;
}

export interface FoldSim {
  nodeCount: number;
  /** Interleaved xyz, current positions. */
  positions: Float64Array;
  /** Flat (rest) positions, z = 0. */
  restPositions: Float64Array;
  triangles: Int32Array; // triples of node indices, CCW in the flat state
  /** Node index per document vertex id (mesh also has face-centroid nodes). */
  nodeOfVertex: Map<string, number>;
  /** Per-triangle face index into the fold model's face list. */
  triangleFace: Int32Array;
  bars: Bar[];
  hinges: Hinge[];
  /** Node index pairs for crease edges, with the crease's assignment. */
  creaseEdges: { a: number; b: number; assignment: string }[];
  /** Node index pairs forming the paper outline. */
  boundaryEdges: { a: number; b: number }[];
  pinned: Uint8Array;
  model: FoldModel;
  step: (t: number, iterations: number) => void;
  /** Ramp the target gradually (for jump-to-state UI actions). */
  rampTo: (from: number, to: number, increments?: number, perStep?: number) => void;
  /** Max |current length − rest| / rest across bars (strain sanity). */
  maxStrain: () => number;
  /** Mean |dihedral| across crease hinges ÷ the driven target (0..~1). */
  foldProgress: (t: number) => number;
  reset: () => void;
}

export const buildFoldSim = (
  doc: OrigamiDocument,
  options: FoldSimOptions = {},
): FoldSim => {
  const {
    axialStiffness = 1, // PBD projection strength per pass, 0..1
    creaseStiffness = 0.55,
    // Soft facets: non-rigid patterns (twists) must bend substantially
    // mid-fold, exactly like real paper.
    facetStiffness = 0.08,
    guideStiffness = 0.9,
    damping = 0.9,
    dt = 0.12,
    guidePhaseFn,
    cap = 0.95,
    passes = 6,
    minLever = 0.3,
    guideTolerance = 0.05,
    guideReach = 0.8,
    pressBoost = 1.6,
  } = options;

  const model = buildFoldModel(doc);
  const { faces, positions: vertexPositions } = model.graph;

  // ---- nodes: document vertices used by faces, plus centroids for n>3 fans
  const nodeOfVertex = new Map<string, number>();
  const flat: number[] = [];
  const addNode = (x: number, y: number): number => {
    flat.push(x, y, 0);
    return flat.length / 3 - 1;
  };
  const nodeFor = (vid: string): number => {
    const existing = nodeOfVertex.get(vid);
    if (existing !== undefined) return existing;
    const p = vertexPositions.get(vid)!;
    const index = addNode(p.x, p.y);
    nodeOfVertex.set(vid, index);
    return index;
  };

  const tris: number[] = [];
  const triFace: number[] = [];
  const triOfEdge = new Map<string, { tri: number; opposite: number }[]>();
  const edgeKey = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const pushTri = (a: number, b: number, c: number, face: number) => {
    const tri = tris.length / 3;
    tris.push(a, b, c);
    triFace.push(face);
    for (const [u, v, w] of [
      [a, b, c],
      [b, c, a],
      [c, a, b],
    ] as const) {
      const key = edgeKey(u, v);
      const list = triOfEdge.get(key) ?? [];
      list.push({ tri, opposite: w });
      triOfEdge.set(key, list);
    }
  };

  for (const face of faces) {
    // De-duplicate slit repeats while preserving loop order.
    const loop: string[] = [];
    for (const vid of face.vertexIds) {
      if (loop.length === 0 || loop[loop.length - 1] !== vid) loop.push(vid);
    }
    if (loop.length > 1 && loop[0] === loop[loop.length - 1]) loop.pop();
    const unique = [...new Set(loop)];
    if (unique.length < 3) continue;
    // Fan around the centroid for EVERY face, triangles included. The
    // interior spokes become soft facet hinges, which is what lets a panel
    // bend the way real paper does. Without them a triangular face is a
    // perfectly rigid plate, and single-vertex patterns (waterbomb /
    // preliminary / fish bases) become rigid spherical linkages that jam
    // in a "fold in half along one straight crease line" configuration.
    const centroid = addNode(face.centroid.x, face.centroid.y);
    for (let i = 0; i < unique.length; i++) {
      const a = nodeFor(unique[i]);
      const b = nodeFor(unique[(i + 1) % unique.length]);
      pushTri(centroid, a, b, face.index);
    }
  }

  const nodeCount = flat.length / 3;
  const restPositions = new Float64Array(flat);
  const positions = new Float64Array(flat);
  const velocities = new Float64Array(nodeCount * 3);
  const forces = new Float64Array(nodeCount * 3);
  const previous = new Float64Array(flat);

  // ---- bars: every triangle edge once
  const bars: Bar[] = [];
  for (const [key, list] of triOfEdge) {
    void list;
    const [a, b] = key.split("|").map(Number);
    const dx = restPositions[a * 3] - restPositions[b * 3];
    const dy = restPositions[a * 3 + 1] - restPositions[b * 3 + 1];
    bars.push({ a, b, rest: Math.hypot(dx, dy) });
  }

  // ---- hinges: crease edges get fold targets, internal edges stay flat
  const creaseSign = new Map<string, number>();
  for (const crease of doc.creases) {
    const a = nodeOfVertex.get(crease.startVertexId);
    const b = nodeOfVertex.get(crease.endVertexId);
    if (a === undefined || b === undefined) continue;
    const sign =
      crease.assignment === "valley" ? 1 : crease.assignment === "mountain" ? -1 : 0;
    creaseSign.set(edgeKey(a, b), sign);
  }

  const hinges: Hinge[] = [];
  const boundaryEdges: { a: number; b: number }[] = [];
  for (const [key, list] of triOfEdge) {
    const [a, b] = key.split("|").map(Number);
    if (list.length === 1) {
      boundaryEdges.push({ a, b });
      continue;
    }
    if (list.length !== 2) continue;
    const sign = creaseSign.get(key);
    hinges.push({
      a,
      b,
      c: list[0].opposite,
      d: list[1].opposite,
      sign: sign ?? 0,
      isCrease: sign !== undefined,
    });
  }
  /**
   * Rest lever arms (height of each opposite node over the hinge edge).
   * Hinge forces go as torque / height, so a sliver triangle whose height
   * collapses mid-fold would otherwise emit an unbounded force and tear the
   * mesh. Clamping to a fraction of the REST height bounds that gain.
   */
  const restLeverC = new Float64Array(hinges.length);
  const restLeverD = new Float64Array(hinges.length);
  for (let h = 0; h < hinges.length; h++) {
    const { a, b, c, d } = hinges[h];
    const ex = restPositions[b * 3] - restPositions[a * 3];
    const ey = restPositions[b * 3 + 1] - restPositions[a * 3 + 1];
    const elen = Math.hypot(ex, ey) || 1e-9;
    const area2 = (px: number, py: number) =>
      Math.abs(ex * (py - restPositions[a * 3 + 1]) - ey * (px - restPositions[a * 3]));
    restLeverC[h] = area2(restPositions[c * 3], restPositions[c * 3 + 1]) / elen;
    restLeverD[h] = area2(restPositions[d * 3], restPositions[d * 3 + 1]) / elen;
  }

  const creaseEdges: { a: number; b: number; assignment: string }[] = [];
  for (const crease of doc.creases) {
    const a = nodeOfVertex.get(crease.startVertexId);
    const b = nodeOfVertex.get(crease.endVertexId);
    if (a === undefined || b === undefined) continue;
    creaseEdges.push({ a, b, assignment: crease.assignment });
  }

  // ---- anchor: the root face marks the frame the model is displayed in.
  // These nodes are NOT held by infinite-mass constraints — hard pins inject
  // reaction forces that block legitimate folding paths (a pinned 90° sector
  // is exactly what jams the preliminary base). Instead the whole mesh is
  // rigidly re-aligned to the root face's rest pose after every iteration,
  // which removes drift without constraining the physics at all.
  const pinned = new Uint8Array(nodeCount);
  const anchorNodes: number[] = [];
  {
    const rootFace = model.root;
    for (let t = 0; t < triFace.length; t++) {
      if (triFace[t] !== rootFace) continue;
      for (const n of [tris[t * 3], tris[t * 3 + 1], tris[t * 3 + 2]]) {
        if (!pinned[n]) {
          pinned[n] = 1;
          anchorNodes.push(n);
        }
      }
    }
  }

  // Scale-aware stiffness: forces ∝ edge lengths, so normalize by paper size.
  const scale = Math.max(doc.paper.width, doc.paper.height);
  /** Unwrapped dihedral angle per hinge (continuity across the ±π seam). */
  const lastAngles = new Float64Array(hinges.length);

  // ---- rigid re-anchoring: three well-spread nodes of the root face define
  // the frame we hold still. Picking the widest triangle keeps the frame
  // numerically conditioned even for sliver faces.
  const anchorTriple: [number, number, number] = (() => {
    let best: [number, number, number] = [
      anchorNodes[0] ?? 0,
      anchorNodes[1] ?? 0,
      anchorNodes[2] ?? 0,
    ];
    let bestArea = -1;
    for (let i = 0; i < anchorNodes.length; i++) {
      for (let j = i + 1; j < anchorNodes.length; j++) {
        for (let k = j + 1; k < anchorNodes.length; k++) {
          const [a, b, c] = [anchorNodes[i], anchorNodes[j], anchorNodes[k]];
          const area = Math.abs(
            (restPositions[b * 3] - restPositions[a * 3]) *
              (restPositions[c * 3 + 1] - restPositions[a * 3 + 1]) -
              (restPositions[b * 3 + 1] - restPositions[a * 3 + 1]) *
                (restPositions[c * 3] - restPositions[a * 3]),
          );
          if (area > bestArea) {
            bestArea = area;
            best = [a, b, c];
          }
        }
      }
    }
    return best;
  })();

  /** Orthonormal frame (columns u, v, w) from three points, as a flat 9-array. */
  const frameOf = (src: Float64Array, out: Float64Array): boolean => {
    const [p, q, r] = anchorTriple;
    let ux = src[q * 3] - src[p * 3];
    let uy = src[q * 3 + 1] - src[p * 3 + 1];
    let uz = src[q * 3 + 2] - src[p * 3 + 2];
    const ul = Math.hypot(ux, uy, uz);
    if (!(ul > 1e-9)) return false;
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const ax = src[r * 3] - src[p * 3];
    const ay = src[r * 3 + 1] - src[p * 3 + 1];
    const az = src[r * 3 + 2] - src[p * 3 + 2];
    let wx = uy * az - uz * ay;
    let wy = uz * ax - ux * az;
    let wz = ux * ay - uy * ax;
    const wl = Math.hypot(wx, wy, wz);
    if (!(wl > 1e-9)) return false;
    wx /= wl;
    wy /= wl;
    wz /= wl;
    out[0] = ux;
    out[3] = uy;
    out[6] = uz;
    out[2] = wx;
    out[5] = wy;
    out[8] = wz;
    out[1] = wy * uz - wz * uy;
    out[4] = wz * ux - wx * uz;
    out[7] = wx * uy - wy * ux;
    return true;
  };
  const frameRest = new Float64Array(9);
  const frameCur = new Float64Array(9);
  const haveRestFrame = frameOf(restPositions, frameRest);

  /**
   * Undo the rigid-body drift: map the root face back onto its rest pose and
   * carry the rest of the mesh (and its velocities) along.
   */
  const reAnchor = (): void => {
    if (!haveRestFrame || !frameOf(positions, frameCur)) return;
    // R = frameRest · frameCurᵀ
    const m = new Float64Array(9);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        m[i * 3 + j] =
          frameRest[i * 3] * frameCur[j * 3] +
          frameRest[i * 3 + 1] * frameCur[j * 3 + 1] +
          frameRest[i * 3 + 2] * frameCur[j * 3 + 2];
      }
    }
    const p = anchorTriple[0];
    const cx = positions[p * 3];
    const cy = positions[p * 3 + 1];
    const cz = positions[p * 3 + 2];
    const tx = restPositions[p * 3];
    const ty = restPositions[p * 3 + 1];
    const tz = restPositions[p * 3 + 2];
    for (let n = 0; n < nodeCount; n++) {
      const i = n * 3;
      const x = positions[i] - cx;
      const y = positions[i + 1] - cy;
      const z = positions[i + 2] - cz;
      positions[i] = tx + m[0] * x + m[1] * y + m[2] * z;
      positions[i + 1] = ty + m[3] * x + m[4] * y + m[5] * z;
      positions[i + 2] = tz + m[6] * x + m[7] * y + m[8] * z;
      const vx = velocities[i];
      const vy = velocities[i + 1];
      const vz = velocities[i + 2];
      velocities[i] = m[0] * vx + m[1] * vy + m[2] * vz;
      velocities[i + 1] = m[3] * vx + m[4] * vy + m[5] * vz;
      velocities[i + 2] = m[6] * vx + m[7] * vy + m[8] * vz;
    }
  };

  // ---- analytic guidance: which faces each node belongs to
  const nodeFaceLists: number[][] = Array.from({ length: nodeCount }, () => []);
  for (let ti = 0; ti < triFace.length; ti++) {
    for (const n of [tris[ti * 3], tris[ti * 3 + 1], tris[ti * 3 + 2]]) {
      if (!nodeFaceLists[n].includes(triFace[ti])) nodeFaceLists[n].push(triFace[ti]);
    }
  }
  const guideTargets = new Float64Array(nodeCount * 3);
  /**
   * Per-node trust in the analytic target. The tree-kinematic map tears at
   * loop-closure creases: mid-fold the faces meeting at a node send it to
   * wildly different places, and their average is meaningless. Where the
   * images agree the map is the truth and we follow it hard; where they
   * scatter we back off and let the physics find the path. The scatter goes
   * to zero at t=1 for flat-foldable input, so the endgame guide is always
   * at full strength — no per-pattern gating needed.
   */
  const guideTrust = new Float64Array(nodeCount);
  let guideT = -1;
  /** Tree face graphs (no loop closures) follow the analytic map exactly. */
  const isTree =
    model.graph.adjacencies.length === Math.max(0, model.graph.faces.length - 1);
  const isFlat = (): boolean => {
    const eps = scale * 1e-6;
    for (let n = 0; n < nodeCount; n++) {
      if (Math.abs(positions[n * 3 + 2]) > eps) return false;
    }
    return true;
  };
  const updateGuideTargets = (t: number): void => {
    if (t === guideT) return;
    guideT = t;
    const transforms = foldedFaceTransforms(model, t);
    for (let n = 0; n < nodeCount; n++) {
      const faces = nodeFaceLists[n];
      let x = 0;
      let y = 0;
      let z = 0;
      const rest = {
        x: restPositions[n * 3],
        y: restPositions[n * 3 + 1],
        z: 0,
      };
      for (const f of faces) {
        const p = applyMat(transforms[f], rest);
        x += p.x;
        y += p.y;
        z += p.z;
      }
      const count = Math.max(1, faces.length);
      const mx = x / count;
      const my = y / count;
      const mz = z / count;
      guideTargets[n * 3] = mx;
      guideTargets[n * 3 + 1] = my;
      guideTargets[n * 3 + 2] = mz;
      let spread = 0;
      for (const f of faces) {
        const p = applyMat(transforms[f], rest);
        spread = Math.max(spread, Math.hypot(p.x - mx, p.y - my, p.z - mz));
      }
      const r = spread / (guideTolerance * scale);
      guideTrust[n] = 1 / (1 + r * r);
    }
  };

  const step = (t: number, iterations: number): void => {
    // Cap short of π: a fully degenerate hinge has antiparallel normals and
    // no defined fold direction. 0.95π reads as fully folded on screen.
    const clamped = Math.max(0, Math.min(1, t));
    const target = clamped * Math.PI * cap;
    // The analytic tree-kinematic state tears mid-fold at loop-closure
    // creases, so guiding toward it there fights the physics. But when the
    // face graph IS a tree (pleats, simple bases) the analytic path is exact
    // at every t — full guidance. Otherwise it is exact only at t=1, so the
    // guide fades in for the endgame flattening.
    // Trees follow the analytic map exactly at every t; loopy graphs get
    // full guidance only in the endgame — mid-fold the trust gate already
    // silences torn regions, but the pull still perturbs the search, so it
    // fades in as the analytic map converges toward exactness at t=1.
    const guidePhase = guidePhaseFn
      ? guidePhaseFn(clamped, isTree)
      : isTree
        ? 1
        : clamped < 0.6
          ? 0
          : ((clamped - 0.6) / 0.4) ** 2;
    // Endgame press: drive creases harder as the fold completes, the way a
    // folder sharpens a crease once the paper is already in place.
    const press = 1 + pressBoost * clamped * clamped;
    const guide = guideStiffness * guidePhase;
    // The analytic map's parameter is the fraction of a FULL (π) fold, so a
    // capped drive must ask for the correspondingly partial analytic state —
    // otherwise the guide drags a shallow fold toward the flat-folded stack.
    if (guide > 0) updateGuideTargets(clamped * cap);

    // Leaving the flat state: nudge along the analytic fold direction so
    // every vertex commits to the correct branch of the fold (the flat
    // sheet is a saddle where symmetric patterns can otherwise jam).
    if (clamped > 0 && isFlat()) {
      updateGuideTargets(Math.min(0.08, clamped));
      for (let n = 0; n < nodeCount; n++) {
        positions[n * 3 + 2] += 0.5 * guideTargets[n * 3 + 2];
      }
      guideT = -1; // targets were for the nudge t; recompute next use
    }
    for (let iter = 0; iter < iterations; iter++) {
      forces.fill(0);

      // Pull toward the analytic fold state (endgame flattening guide).
      if (guide > 0) {
        for (let n = 0; n < nodeCount; n++) {
          const i = n * 3;
          const ex = guideTargets[i] - positions[i];
          const ey = guideTargets[i + 1] - positions[i + 1];
          const ez = guideTargets[i + 2] - positions[i + 2];
          // Second gate: the guide is a straight-line pull in position, so
          // it is only meaningful once the node is already near its analytic
          // place. Far away, that straight line cuts through the middle of
          // the paper and would squash the sheet instead of folding it.
          const d = Math.hypot(ex, ey, ez) / (guideReach * scale);
          const g = (guide * guideTrust[n]) / (scale * (1 + d * d));
          forces[i] += g * ex;
          forces[i + 1] += g * ey;
          forces[i + 2] += g * ez;
        }
      }

      // Hinges.
      for (let h = 0; h < hinges.length; h++) {
        const hinge = hinges[h];
        const ia = hinge.a * 3;
        const ib = hinge.b * 3;
        const ic = hinge.c * 3;
        const id = hinge.d * 3;
        const ax = positions[ia];
        const ay = positions[ia + 1];
        const az = positions[ia + 2];
        // Edge vector.
        let ex = positions[ib] - ax;
        let ey = positions[ib + 1] - ay;
        let ez = positions[ib + 2] - az;
        const elen = Math.hypot(ex, ey, ez) || 1e-9;
        ex /= elen;
        ey /= elen;
        ez /= elen;
        // Vectors to opposite nodes.
        const cx = positions[ic] - ax;
        const cy = positions[ic + 1] - ay;
        const cz = positions[ic + 2] - az;
        const dx0 = positions[id] - ax;
        const dy0 = positions[id + 1] - ay;
        const dz0 = positions[id + 2] - az;
        // Face normals: nA = e × (c−a), nB = (d−a) × e — oriented so both
        // agree when the sheet is flat.
        let nax = ey * cz - ez * cy;
        let nay = ez * cx - ex * cz;
        let naz = ex * cy - ey * cx;
        let nbx = dy0 * ez - dz0 * ey;
        let nby = dz0 * ex - dx0 * ez;
        let nbz = dx0 * ey - dy0 * ex;
        const nalen = Math.hypot(nax, nay, naz) || 1e-9;
        const nblen = Math.hypot(nbx, nby, nbz) || 1e-9;
        // Heights of the opposite nodes over the edge.
        const hc = nalen / elen;
        const hd = nblen / elen;
        nax /= nalen;
        nay /= nalen;
        naz /= nalen;
        nbx /= nblen;
        nby /= nblen;
        nbz /= nblen;
        // Signed dihedral angle: positive when the wings fold toward +z
        // (valley), matching the editor's convention. (nB × nA, not nA × nB:
        // with these normal orientations, rising wings give +sin.)
        const crossX = nby * naz - nbz * nay;
        const crossY = nbz * nax - nbx * naz;
        const crossZ = nbx * nay - nby * nax;
        const sinTerm = crossX * ex + crossY * ey + crossZ * ez;
        const cosTerm = nax * nbx + nay * nby + naz * nbz;
        let angle = Math.atan2(sinTerm, cosTerm);
        // Unwrap: atan2 jumps at ±π, but a hinge folding past flat must see
        // a continuous angle or its restoring torque flips sign and the
        // stack goes chaotic exactly when the model is nearly folded.
        const last = lastAngles[h];
        if (angle - last > Math.PI) angle -= 2 * Math.PI;
        else if (last - angle > Math.PI) angle += 2 * Math.PI;
        lastAngles[h] = angle;
        const hingeTarget = hinge.sign * target;
        const k = hinge.isCrease ? creaseStiffness * press : facetStiffness;
        const torque = k * (hingeTarget - angle);

        // Force on opposite nodes along their normals, scaled by 1/height;
        // edge nodes take the torque-free barycentric complement.
        const fc = torque / Math.max(hc, minLever * restLeverC[h], 1e-6);
        const fd = torque / Math.max(hd, minLever * restLeverD[h], 1e-6);
        const rc = (cx * ex + cy * ey + cz * ez) / elen; // c's projection
        const rd = (dx0 * ex + dy0 * ey + dz0 * ez) / elen;
        const fcx = nax * fc;
        const fcy = nay * fc;
        const fcz = naz * fc;
        const fdx = nbx * fd;
        const fdy = nby * fd;
        const fdz = nbz * fd;
        forces[ic] += fcx;
        forces[ic + 1] += fcy;
        forces[ic + 2] += fcz;
        forces[id] += fdx;
        forces[id + 1] += fdy;
        forces[id + 2] += fdz;
        forces[ia] -= fcx * (1 - rc) + fdx * (1 - rd);
        forces[ia + 1] -= fcy * (1 - rc) + fdy * (1 - rd);
        forces[ia + 2] -= fcz * (1 - rc) + fdz * (1 - rd);
        forces[ib] -= fcx * rc + fdx * rd;
        forces[ib + 1] -= fcy * rc + fdy * rd;
        forces[ib + 2] -= fcz * rc + fdz * rd;
      }

      // Predict: integrate hinge forces (semi-implicit, damped).
      for (let n = 0; n < nodeCount; n++) {
        const i = n * 3;
        previous[i] = positions[i];
        previous[i + 1] = positions[i + 1];
        previous[i + 2] = positions[i + 2];
        positions[i] += velocities[i] * dt + forces[i] * scale * dt * dt;
        positions[i + 1] += velocities[i + 1] * dt + forces[i + 1] * scale * dt * dt;
        positions[i + 2] += velocities[i + 2] * dt + forces[i + 2] * scale * dt * dt;
      }

      // Project: enforce bar lengths (PBD — unconditionally stable, so the
      // paper stays inextensible no matter how hard the hinges drive).
      for (let pass = 0; pass < passes; pass++) {
        for (const bar of bars) {
          const ia = bar.a * 3;
          const ib = bar.b * 3;
          const dx = positions[ib] - positions[ia];
          const dy = positions[ib + 1] - positions[ia + 1];
          const dz = positions[ib + 2] - positions[ia + 2];
          const len = Math.hypot(dx, dy, dz) || 1e-9;
          const corr = (axialStiffness * (len - bar.rest)) / len / 2;
          positions[ia] += dx * corr;
          positions[ia + 1] += dy * corr;
          positions[ia + 2] += dz * corr;
          positions[ib] -= dx * corr;
          positions[ib + 1] -= dy * corr;
          positions[ib + 2] -= dz * corr;
        }
      }

      // Update velocities from actual (post-projection) motion.
      for (let n = 0; n < nodeCount; n++) {
        const i = n * 3;
        velocities[i] = ((positions[i] - previous[i]) / dt) * damping;
        velocities[i + 1] = ((positions[i + 1] - previous[i + 1]) / dt) * damping;
        velocities[i + 2] = ((positions[i + 2] - previous[i + 2]) / dt) * damping;
      }

      // Hold the display frame still without constraining the physics.
      reAnchor();
    }
  };

  const maxStrain = (): number => {
    let worst = 0;
    for (const bar of bars) {
      const dx = positions[bar.a * 3] - positions[bar.b * 3];
      const dy = positions[bar.a * 3 + 1] - positions[bar.b * 3 + 1];
      const dz = positions[bar.a * 3 + 2] - positions[bar.b * 3 + 2];
      const len = Math.hypot(dx, dy, dz);
      worst = Math.max(worst, Math.abs(len - bar.rest) / bar.rest);
    }
    return worst;
  };

  /**
   * Quasi-statically ramp from `from` to `to`: many small target increments
   * track the folding path instead of jumping into a jammed local minimum.
   */
  const rampTo = (from: number, to: number, increments = 110, perStep = 20): void => {
    for (let i = 1; i <= increments; i++) {
      step(from + ((to - from) * i) / increments, perStep);
    }
  };

  const foldProgress = (t: number): number => {
    const target = Math.max(1e-9, Math.min(1, t) * Math.PI * cap);
    let sum = 0;
    let count = 0;
    for (let h = 0; h < hinges.length; h++) {
      if (!hinges[h].isCrease || hinges[h].sign === 0) continue;
      sum += Math.abs(lastAngles[h]) / target;
      count++;
    }
    return count === 0 ? 1 : sum / count;
  };

  const reset = (): void => {
    positions.set(restPositions);
    velocities.fill(0);
    lastAngles.fill(0);
  };

  return {
    nodeCount,
    positions,
    restPositions,
    triangles: new Int32Array(tris),
    nodeOfVertex,
    triangleFace: new Int32Array(triFace),
    bars,
    hinges,
    creaseEdges,
    boundaryEdges,
    pinned,
    model,
    step,
    rampTo,
    maxStrain,
    foldProgress,
    reset,
  };
};
