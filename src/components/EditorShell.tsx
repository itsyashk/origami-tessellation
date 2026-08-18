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
import { FoldPreview } from "./fold/FoldPreview";
import { PatternBrowser } from "./patterns/PatternBrowser";
import { useEffect } from "react";
import { useEditorStore } from "@/state/editorStore";

const GALLERY_SEEN_KEY = "origami.gallery.seen";

export function EditorShell() {
  const hasSelection = useEditorStore(
    (s) => s.selection.vertexIds.size > 0 || s.selection.creaseIds.size > 0,
  );

  // First visit: open straight into the pattern library — the tutorial
  // front door. (Zustand set, not React setState, so no render cascade.)
  useEffect(() => {
    try {
      if (localStorage.getItem(GALLERY_SEEN_KEY) !== "1") {
        localStorage.setItem(GALLERY_SEEN_KEY, "1");
        useEditorStore.getState().setGalleryOpen(true);
      }
    } catch {
      // Private browsing: start in the editor.
    }
  }, []);

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
                className="absolute inset-x-3 bottom-20 top-auto z-20 max-h-[45%] overflow-y-auto md:inset-x-auto md:bottom-auto md:right-4 md:top-4 md:max-h-[calc(100%-6rem)]"
              >
                <InspectorPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <FoldPreview />
        <PatternBrowser />

        {/* Bottom toolbar — small screens */}
        <div className="craft-card absolute bottom-3 left-1/2 z-30 -translate-x-1/2 px-2 py-1 md:hidden">
          <Toolbar horizontal />
        </div>
      </div>
    </div>
  );
}
