"use client";

/**
 * One-line onboarding, shown until dismissed (persisted). Teaches the whole
 * loop in a sentence; no modal, no tour.
 */

import { useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

const STORAGE_KEY = "origami.onboarding.dismissed";

const subscribeToStorage = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

const readDismissed = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export function OnboardingHint() {
  // Server snapshot says "dismissed" so the hint never flashes during SSR;
  // the client snapshot takes over right after hydration.
  const storedDismissed = useSyncExternalStore(
    subscribeToStorage,
    readDismissed,
    () => true,
  );
  const [dismissedNow, setDismissedNow] = useState(false);
  const visible = !storedDismissed && !dismissedNow;

  const dismiss = () => {
    setDismissedNow(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Private browsing — the hint will simply show again next time.
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="craft-card pointer-events-auto absolute left-1/2 top-3 z-30 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 py-2 pl-4 pr-2"
          data-testid="onboarding-hint"
          role="note"
        >
          <span className="font-hand text-[17px] leading-snug text-(--ink-soft)">
            Place vertices <span className="text-(--cyan)">→</span> connect them
            with creases <span className="text-(--cyan)">→</span> drag anything —
            the math follows live
          </span>
          <button
            type="button"
            className="btn btn-ghost h-7 w-7 shrink-0 px-0"
            onClick={dismiss}
            aria-label="Dismiss hint"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
