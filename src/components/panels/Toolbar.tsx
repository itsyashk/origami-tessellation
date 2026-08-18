"use client";

import { MousePointer2, CircleDot, Spline, Hand } from "lucide-react";
import { useEditorStore, type ToolId } from "@/state/editorStore";

const TOOLS: { id: ToolId; label: string; keyHint: string; icon: React.ReactNode }[] = [
  { id: "select", label: "Select", keyHint: "V", icon: <MousePointer2 size={19} /> },
  { id: "vertex", label: "Vertex", keyHint: "P", icon: <CircleDot size={19} /> },
  { id: "crease", label: "Crease", keyHint: "C", icon: <Spline size={19} /> },
  { id: "pan", label: "Pan", keyHint: "H", icon: <Hand size={19} /> },
];

export function Toolbar({ horizontal = false }: { horizontal?: boolean }) {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <div
      className={
        horizontal ? "flex flex-row items-center gap-1" : "flex flex-col gap-1"
      }
      role="toolbar"
      aria-label="Editing tools"
      aria-orientation={horizontal ? "horizontal" : "vertical"}
    >
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          className="tool-btn"
          data-active={tool === t.id}
          data-testid={horizontal ? `tool-${t.id}-mobile` : `tool-${t.id}`}
          aria-pressed={tool === t.id}
          onClick={() => setTool(t.id)}
          title={`${t.label} (${t.keyHint})`}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
