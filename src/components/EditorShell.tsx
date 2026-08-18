"use client";

/**
 * Application layout. Desktop: top bar, left tool rail with the analysis
 * summary, canvas center, contextual inspector floating on the right.
 * Small screens: the rail becomes a bottom toolbar and the inspector docks
 * above it.
 */

import { AnimatePresence, motion } from "motion/react";
import { TopBar } from "./panels/TopBar";
import { Toolbar } from "./panels/Toolbar";
import { AnalysisPanel } from "./panels/AnalysisPanel";
import { InspectorPanel } from "./panels/InspectorPanel";
import { CanvasStage } from "./editor/CanvasStage";
import { OnboardingHint } from "./OnboardingHint";
import { useEditorStore } from "@/state/editorStore";

export function EditorShell() {
  const hasSelection = useEditorStore(
    (s) => s.selection.vertexIds.size > 0 || s.selection.creaseIds.size > 0,
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar />
      <div className="relative flex min-h-0 flex-1">
        {/* Left rail — desktop */}
        <aside className="z-20 hidden w-[76px] flex-col items-center gap-4 border-r border-(--ink)/10 bg-(--card) py-3 md:flex">
          <Toolbar />
        </aside>

        {/* Canvas */}
        <main className="relative min-w-0 flex-1">
          <CanvasStage />
          <OnboardingHint />

          {/* Live analysis summary */}
          <div className="craft-card absolute left-4 top-4 z-20 hidden w-44 p-3 sm:block">
            <AnalysisPanel />
          </div>

          {/* Contextual inspector */}
          <AnimatePresence>
            {hasSelection && (
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="absolute right-4 top-4 z-20 max-h-[calc(100%-6rem)] overflow-y-auto"
              >
                <InspectorPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Bottom toolbar — small screens */}
        <div className="craft-card absolute bottom-3 left-1/2 z-30 -translate-x-1/2 px-2 py-1 md:hidden">
          <Toolbar horizontal />
        </div>
      </div>
    </div>
  );
}
