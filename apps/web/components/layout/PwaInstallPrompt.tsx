"use client";

import React, { useState, useEffect } from "react";

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // 1. Check if already running in PWA standalone mode
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandaloneMode) {
      setIsStandalone(true);
      return;
    }

    // 2. Check if dismissed recently (within 7 days)
    const lastDismissed = localStorage.getItem("namiverse_pwa_dismissed");
    if (lastDismissed) {
      const dismissedTime = parseInt(lastDismissed, 10);
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // 3. Detect iOS Safari
    const ua = window.navigator.userAgent;
    const isIosDevice = /iphone|ipad|ipod/i.test(ua);
    setIsIos(isIosDevice);

    // 4. Capture Chrome / Android / Desktop PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Show prompt for iOS users after a brief 3-second delay
    if (isIosDevice && !isStandaloneMode) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("namiverse_pwa_dismissed", Date.now().toString());
  };

  if (!isVisible || isStandalone) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in fade-in slide-in-from-bottom-6 duration-300">
      <div className="bg-zinc-900/95 border border-amber-500/30 rounded-3xl p-5 shadow-2xl shadow-amber-950/40 backdrop-blur-xl flex flex-col gap-4 relative overflow-hidden">
        {/* Nami Orange Ambient Light */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-amber-500/40 overflow-hidden flex-shrink-0 p-0.5 shadow-md">
            <img
              src="/icons/icon-192x192.png"
              alt="NamiVerse App Icon"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>

          <div className="flex-grow min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-amber-300 flex items-center gap-1.5">
                <span>🍊 Install NamiVerse App</span>
              </h3>
              <button
                onClick={handleDismiss}
                className="text-zinc-400 hover:text-zinc-200 text-xs p-1 rounded-lg transition-colors"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-300 font-medium mt-1 leading-relaxed">
              Add NamiVerse to your home screen for instant full-screen access, standalone app feel & zero URL bars!
            </p>
          </div>
        </div>

        {/* iOS Step-by-step installation guide */}
        {showIosGuide && isIos && (
          <div className="bg-zinc-950/80 border border-amber-500/20 rounded-2xl p-3.5 text-xs text-zinc-300 space-y-2 font-medium">
            <p className="font-bold text-amber-300">How to Install on iPhone / iPad:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-zinc-300">
              <li>Tap the <span className="font-bold text-white">Share button</span> (⎋ icon in Safari toolbar).</li>
              <li>Scroll down and select <span className="font-bold text-white">"Add to Home Screen ➕"</span>.</li>
              <li>Tap <span className="font-bold text-white">"Add"</span> in top right.</li>
            </ol>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            onClick={handleDismiss}
            className="px-3 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Not Now
          </button>
          <button
            onClick={handleInstallClick}
            className="px-4 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <span>📲 {isIos ? "Installation Guide" : "Install App"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
