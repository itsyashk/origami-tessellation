"use client";

import { useDocumentStore } from "@/state/documentStore";
import { useEditorStore } from "@/state/editorStore";

/** Quiet readout: pointer position, geometry counts, active snap label. */
export function StatusBar() {
  const pointer = useEditorStore((s) => s.pointerPaper);
  const snap = useEditorStore((s) => s.activeSnap);
  const vertexCount = useDocumentStore((s) => s.doc.vertices.length);
  const creaseCount = useDocumentStore((s) => s.doc.creases.length);

  return (
    <div className="craft-card pointer-events-none absolute bottom-4 left-4 hidden items-center gap-3 px-3 py-1.5 text-[11.5px] font-semibold text-(--ink-soft) sm:flex">
      <span className="tnum" data-testid="status-counts">
        {vertexCount} vertices · {creaseCount} creases
      </span>
      {pointer && (
        <span className="tnum" data-testid="status-pointer">
          {pointer.x.toFixed(1)}, {pointer.y.toFixed(1)}
        </span>
      )}
      {snap?.label && <span className="text-(--cyan)">{snap.label}</span>}
      {snap && !snap.label && snap.kind !== "grid" && (
        <span className="text-(--cyan)">snap: {snap.kind}</span>
      )}
    </div>
  );
}
