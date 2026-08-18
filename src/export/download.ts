/** Browser-only download helpers. Kept separate from pure serialization. */

import type { OrigamiDocument } from "@/origami/model";
import { serializeDocument } from "@/origami/serialization";
import { documentToSvg } from "./svg";

const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const safeFilename = (name: string): string =>
  name.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() ||
  "pattern";

export const downloadJson = (doc: OrigamiDocument): void => {
  triggerDownload(
    new Blob([serializeDocument(doc)], { type: "application/json" }),
    `${safeFilename(doc.name)}.origami.json`,
  );
};

export const downloadSvg = (doc: OrigamiDocument): void => {
  triggerDownload(
    new Blob([documentToSvg(doc)], { type: "image/svg+xml" }),
    `${safeFilename(doc.name)}.svg`,
  );
};
