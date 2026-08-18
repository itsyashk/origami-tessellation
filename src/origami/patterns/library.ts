/**
 * The pattern library: every built-in pattern with its tutorial metadata.
 * Patterns are ordinary OrigamiDocuments from parametric generators — the
 * editor, analysis, and fold preview treat them like anything hand-drawn.
 * Tests assert every entry is planar and fully flat-foldable.
 */

import type { OrigamiDocument } from "../model";
import {
  bookFold,
  gateFold,
  blintzBase,
  kiteBase,
  fishBase,
  waterbombBase,
  preliminaryBase,
} from "./bases";
import { accordion, diagonalPleats, mapFold } from "./pleats";
import { starburst, birdsFoot } from "./fans";
import { polygonTwist } from "./twists";
import { miuraOri, waterbombTessellation } from "./tessellations";
import { squareTwist } from "../examples";

export type PatternCategory =
  | "bases"
  | "pleats"
  | "vertices"
  | "twists"
  | "tessellations";

export type PatternDifficulty = "beginner" | "intermediate" | "advanced";

export interface PatternEntry {
  slug: string;
  title: string;
  category: PatternCategory;
  difficulty: PatternDifficulty;
  description: string;
  build: () => OrigamiDocument;
}

export const CATEGORY_LABELS: Record<PatternCategory, string> = {
  bases: "Bases & classics",
  pleats: "Pleats & maps",
  vertices: "Single vertices",
  twists: "Twists",
  tessellations: "Tessellations",
};

export const PATTERNS: PatternEntry[] = [
  // ----------------------------------------------------------- bases
  {
    slug: "book-fold",
    title: "Book Fold",
    category: "bases",
    difficulty: "beginner",
    description: "The very first fold: one valley down the middle.",
    build: bookFold,
  },
  {
    slug: "gate-fold",
    title: "Gate Fold",
    category: "bases",
    difficulty: "beginner",
    description: "Both sides fold in to meet at the center, like shutters.",
    build: gateFold,
  },
  {
    slug: "blintz-base",
    title: "Blintz Base",
    category: "bases",
    difficulty: "beginner",
    description: "All four corners fold to the center — the start of hundreds of models.",
    build: blintzBase,
  },
  {
    slug: "kite-base",
    title: "Kite Base",
    category: "bases",
    difficulty: "beginner",
    description: "Two edges fold onto the diagonal. The 22.5° family begins here.",
    build: kiteBase,
  },
  {
    slug: "fish-base",
    title: "Fish Base",
    category: "bases",
    difficulty: "intermediate",
    description:
      "A rabbit ear on each side of the diagonal. Its two incenter vertices are perfect for studying Kawasaki's theorem.",
    build: fishBase,
  },
  {
    slug: "waterbomb-base",
    title: "Waterbomb Base",
    category: "bases",
    difficulty: "beginner",
    description:
      "Diagonals mountain, one book fold valley — collapses into the classic puffy bomb. The center is a degree-6 vertex.",
    build: waterbombBase,
  },
  {
    slug: "preliminary-base",
    title: "Preliminary Base",
    category: "bases",
    difficulty: "beginner",
    description:
      "The waterbomb base inside-out; the starting point of the crane.",
    build: preliminaryBase,
  },

  // ----------------------------------------------------------- pleats
  {
    slug: "accordion-8",
    title: "Accordion ×8",
    category: "pleats",
    difficulty: "beginner",
    description: "Alternating mountain and valley folds — the fan everyone made in school.",
    build: () => accordion(8),
  },
  {
    slug: "accordion-16",
    title: "Fine Accordion ×16",
    category: "pleats",
    difficulty: "beginner",
    description: "Twice the pleats, twice the spring.",
    build: () => accordion(16, "Fine Accordion ×16"),
  },
  {
    slug: "diagonal-pleats",
    title: "Diagonal Pleats",
    category: "pleats",
    difficulty: "beginner",
    description: "An accordion running corner to corner.",
    build: () => diagonalPleats(10),
  },
  {
    slug: "map-fold-4",
    title: "Map Fold 4×4",
    category: "pleats",
    difficulty: "intermediate",
    description:
      "The classic pocket map. Watch each horizontal crease flip between mountain and valley as it crosses the verticals — that's Maekawa at work.",
    build: () => mapFold(4, 4),
  },
  {
    slug: "map-fold-6",
    title: "City Map 6×6",
    category: "pleats",
    difficulty: "intermediate",
    description: "A denser map grid; 25 interior vertices, all flat-foldable.",
    build: () => mapFold(6, 6, "City Map 6×6"),
  },

  // ----------------------------------------------------------- single vertices
  {
    slug: "birds-foot",
    title: "Bird's Foot Study",
    category: "vertices",
    difficulty: "beginner",
    description:
      "One degree-4 vertex with unequal sectors. Drag an endpoint in the editor and watch Kawasaki respond live.",
    build: birdsFoot,
  },
  {
    slug: "starburst-6",
    title: "Starburst 6",
    category: "vertices",
    difficulty: "beginner",
    description: "Six equal sectors around one vertex — four mountains, two valleys.",
    build: () => starburst(6),
  },
  {
    slug: "starburst-8",
    title: "Starburst 8",
    category: "vertices",
    difficulty: "intermediate",
    description: "Eight creases collapse into a tight rosette.",
    build: () => starburst(8),
  },
  {
    slug: "starburst-12",
    title: "Sunburst 12",
    category: "vertices",
    difficulty: "intermediate",
    description: "Twelve creases; the paper rolls into a slender cone as it folds flat.",
    build: () => starburst(12, "Sunburst 12"),
  },

  // ----------------------------------------------------------- twists
  {
    slug: "triangle-twist",
    title: "Triangle Twist",
    category: "twists",
    difficulty: "advanced",
    description:
      "The smallest twist: a triangle spins while three pleat pairs absorb the rotation.",
    build: () => polygonTwist(3),
  },
  {
    slug: "square-twist",
    title: "Square Twist",
    category: "twists",
    difficulty: "advanced",
    description:
      "The classic flat-foldable twist — four pleats rotate the central square 45°. Famously not rigid: real paper must bend mid-fold.",
    build: squareTwist,
  },
  {
    slug: "pentagon-twist",
    title: "Pentagon Twist",
    category: "twists",
    difficulty: "advanced",
    description: "Five-fold twist symmetry on square paper.",
    build: () => polygonTwist(5),
  },
  {
    slug: "hexagon-twist",
    title: "Hexagon Twist",
    category: "twists",
    difficulty: "advanced",
    description: "The twist at the heart of most classic tessellations.",
    build: () => polygonTwist(6),
  },
  {
    slug: "octagon-twist",
    title: "Octagon Twist",
    category: "twists",
    difficulty: "advanced",
    description: "Eight shallow pleats; the closest to a smooth rotation.",
    build: () => polygonTwist(8),
  },

  // ----------------------------------------------------------- tessellations
  {
    slug: "miura-4x5",
    title: "Miura-ori 5×4",
    category: "tessellations",
    difficulty: "intermediate",
    description:
      "The herringbone corrugation that folds flat in one motion — used for solar arrays and maps. Every vertex is the same parallelogram vertex.",
    build: () => miuraOri(4, 5),
  },
  {
    slug: "miura-6x8",
    title: "Miura-ori 8×6",
    category: "tessellations",
    difficulty: "advanced",
    description: "A denser Miura field; 35 interior vertices, one degree of freedom.",
    build: () => miuraOri(6, 8),
  },
  {
    slug: "herringbone",
    title: "Steep Herringbone",
    category: "tessellations",
    difficulty: "advanced",
    description: "Miura-ori with an aggressive shear — bold zigzags, deep corrugation.",
    build: () => miuraOri(5, 6, 0.7, "Steep Herringbone"),
  },
  {
    slug: "magic-ball-4x6",
    title: "Magic Ball 6×4",
    category: "tessellations",
    difficulty: "advanced",
    description:
      "The waterbomb tessellation: rows of degree-6 waterbomb vertices. Curl it into spheres and lanterns.",
    build: () => waterbombTessellation(4, 6),
  },
  {
    slug: "magic-ball-6x9",
    title: "Magic Ball 9×6",
    category: "tessellations",
    difficulty: "advanced",
    description: "A finer waterbomb field for smoother curvature.",
    build: () => waterbombTessellation(6, 9, "Magic Ball 9×6"),
  },
  {
    slug: "weave-8",
    title: "Weave 8×8",
    category: "tessellations",
    difficulty: "advanced",
    description: "A dense map-fold lattice — 49 interior vertices, all valid.",
    build: () => mapFold(8, 8, "Weave 8×8"),
  },
];

export const getPattern = (slug: string): PatternEntry | undefined =>
  PATTERNS.find((p) => p.slug === slug);
