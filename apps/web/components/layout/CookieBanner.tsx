"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) {
      // Small delay so it doesn't flash immediately on first paint
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("cookie_consent", "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem("cookie_consent", "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent notice"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl shadow-black/60">
        <p className="text-xs font-semibold text-zinc-200 mb-1">🍪 Cookie Notice</p>
        <p className="text-[11px] text-zinc-400 leading-relaxed mb-4">
          AniVerse uses session cookies for authentication and YouTube's IFrame API for trailer playback.
          We do not use advertising trackers.{" "}
          <Link href="/privacy" className="text-purple-400 underline hover:text-purple-300 transition-colors">
            Privacy Policy
          </Link>
        </p>
        <div className="flex gap-2">
          <button
            onClick={accept}
            aria-label="Accept cookies"
            className="flex-1 text-xs px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all"
          >
            Accept
          </button>
          <button
            onClick={decline}
            aria-label="Decline optional cookies"
            className="text-xs px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold transition-all"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
