/**
 * Serialization of the origami document to/from JSON.
 *
 * The wire format IS the document model (plus nothing else), so a document
 * round-trips byte-for-byte deterministically. `parseDocument` is the single
 * entry point for untrusted input and runs migrations + validation.
 */

import {
  DOCUMENT_VERSION,
  validateDocument,
  type CreaseAssignment,
  type OrigamiDocument,
} from "./model";
import { foldToDocument, isFoldDocument } from "./foldFormat";
import { planarizeDocument } from "./planarize";

const ASSIGNMENTS: readonly CreaseAssignment[] = [
  "mountain",
  "valley",
  "unassigned",
  "boundary",
];

export const serializeDocument = (doc: OrigamiDocument): string =>
  JSON.stringify(doc, null, 2);

export class DocumentParseError extends Error {}

/** Migrate older document versions forward. Currently a no-op (version 1). */
const migrate = (raw: Record<string, unknown>): Record<string, unknown> => {
  const version = typeof raw.version === "number" ? raw.version : 0;
  if (version > DOCUMENT_VERSION) {
    throw new DocumentParseError(
      `Document version ${version} is newer than this app understands (${DOCUMENT_VERSION}).`,
    );
  }
  return raw;
};

export const parseDocument = (json: string): OrigamiDocument => {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new DocumentParseError("Not valid JSON.");
  }
  if (typeof raw !== "object" || raw === null) {
    throw new DocumentParseError("Document must be a JSON object.");
  }
  const data = migrate(raw as Record<string, unknown>);

  const paper = data.paper as { width?: unknown; height?: unknown } | undefined;
  if (
    !paper ||
    typeof paper.width !== "number" ||
    typeof paper.height !== "number" ||
    paper.width <= 0 ||
    paper.height <= 0
  ) {
    throw new DocumentParseError("Document is missing a valid paper size.");
  }

  if (!Array.isArray(data.vertices) || !Array.isArray(data.creases)) {
    throw new DocumentParseError("Document must contain vertices and creases arrays.");
  }

  const vertices = data.vertices.map((v: unknown, i: number) => {
    const vert = v as { id?: unknown; x?: unknown; y?: unknown };
    if (
      typeof vert.id !== "string" ||
      typeof vert.x !== "number" ||
      typeof vert.y !== "number"
    ) {
      throw new DocumentParseError(`Vertex at index ${i} is malformed.`);
    }
    return { id: vert.id, x: vert.x, y: vert.y };
  });

  const creases = data.creases.map((c: unknown, i: number) => {
    const crease = c as {
      id?: unknown;
      startVertexId?: unknown;
      endVertexId?: unknown;
      assignment?: unknown;
    };
    if (
      typeof crease.id !== "string" ||
      typeof crease.startVertexId !== "string" ||
      typeof crease.endVertexId !== "string" ||
      !ASSIGNMENTS.includes(crease.assignment as CreaseAssignment)
    ) {
      throw new DocumentParseError(`Crease at index ${i} is malformed.`);
    }
    return {
      id: crease.id,
      startVertexId: crease.startVertexId,
      endVertexId: crease.endVertexId,
      assignment: crease.assignment as CreaseAssignment,
    };
  });

  const doc: OrigamiDocument = {
    version: DOCUMENT_VERSION,
    name: typeof data.name === "string" ? data.name : "Imported pattern",
    paper: { width: paper.width, height: paper.height },
    vertices,
    creases,
  };

  const problems = validateDocument(doc);
  if (problems.length > 0) {
    throw new DocumentParseError(`Invalid document: ${problems.join("; ")}`);
  }
  return doc;
};

/**
 * Parse either native `.origami.json` or a FOLD file. Does not planarize —
 * use `ingestImportedDocument` when loading into the editor so crossings
 * gain vertices the same way a drawn crease would.
 */
export const parseImportedDocument = (json: string): OrigamiDocument => {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new DocumentParseError("Not valid JSON.");
  }
  if (isFoldDocument(raw)) {
    try {
      return foldToDocument(raw);
    } catch (error) {
      throw new DocumentParseError(
        error instanceof Error ? error.message : "Could not read that FOLD file.",
      );
    }
  }
  return parseDocument(json);
};

/**
 * Load path for untrusted files: parse, then planarize so the editor never
 * holds creases that cross without a shared vertex. Native documents that
 * are already planar come back as the same object (planarize is idempotent).
 */
export const ingestImportedDocument = (json: string): OrigamiDocument =>
  planarizeDocument(parseImportedDocument(json));
