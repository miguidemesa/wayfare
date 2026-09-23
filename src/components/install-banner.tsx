"use client";

// PWA install affordance. Captures the browser's beforeinstallprompt event and
// presents it as a calm, dismissible banner. On iOS (no beforeinstallprompt)
// it shows the Share-sheet instructions once.

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "wayfare.installDismissed.v1";
const IOS_HINT_KEY = "wayfare.iosHintShown.v1";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosMode, setIosMode] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS: no install prompt event — show the manual hint once per device.
    if (isIos() && !localStorage.getItem(IOS_HINT_KEY)) {
      setIosMode(true);
      setShow(true);
      localStorage.setItem(IOS_HINT_KEY, "1");
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") localStorage.setItem(DISMISS_KEY, "1");
    setDeferred(null);
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Wayfare"
      className="fixed inset-x-4 bottom-4 z-[80] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3.5 shadow-pop backdrop-blur animate-fade-up"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-strong text-white">
        <Download size={18} />
      </span>
      <div className="min-w-0 flex-1">
        {iosMode ? (
          <>
            <p className="text-[13px] font-semibold">Add Wayfare to your Home Screen</p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-ink-3">
              Tap <span className="font-semibold">Share</span> ↓ then{" "}
              <span className="font-semibold">“Add to Home Screen”</span>.
            </p>
          </>
        ) : (
          <>
            <p className="text-[13px] font-semibold">Install Wayfare</p>
            <p className="mt-0.5 text-[11.5px] text-ink-3">
              Offline-ready, on your Home Screen, no store needed.
            </p>
          </>
        )}
      </div>
      {!iosMode && (
        <button
          onClick={install}
          className="shrink-0 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-strong"
        >
          Install
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="shrink-0 rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <X size={15} />
      </button>
    </div>
  );
}