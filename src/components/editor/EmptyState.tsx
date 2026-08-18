"use client";

import { useDocumentStore } from "@/state/documentStore";
import { useEditorStore } from "@/state/editorStore";

/** Hand-written nudge on a blank sheet; disappears at the first vertex. */
export function EmptyState() {
  const isEmpty = useDocumentStore((s) => s.doc.vertices.length === 0);
  const tool = useEditorStore((s) => s.tool);
  if (!isEmpty) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
      <div className="font-hand max-w-70 -rotate-2 text-center text-[20px] leading-snug text-(--ink-faint)">
        {tool === "vertex" || tool === "crease" ? (
          <>click anywhere on the sheet to begin ↓</>
        ) : (
          <>
            a blank sheet — grab the <span className="text-(--cyan)">Vertex</span>{" "}
            or <span className="text-(--cyan)">Crease</span> tool,
            <br />
            or open an Example from the top bar
          </>
        )}
      </div>
    </div>
  );
}
