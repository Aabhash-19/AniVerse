import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-md w-full bg-zinc-900/80 border border-purple-500/30 backdrop-blur-xl rounded-3xl p-8 shadow-2xl text-center relative z-10 flex flex-col items-center gap-6">
        
        {/* Nami Mascot Avatar Badge */}
        <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-amber-500 shadow-xl bg-purple-950">
          <img
            src="/nami-avatar.png"
            alt="Navigator Nami"
            className="w-full h-full object-cover"
          />
        </div>

        <div>
          <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider mb-3">
            404 — Uncharted Waters
          </div>
          <h1 className="text-2xl font-black text-white">Lost at Sea?</h1>
        </div>

        {/* Speech Bubble */}
        <div className="relative bg-zinc-950 border border-zinc-800 p-4 rounded-2xl text-xs text-zinc-300 leading-relaxed font-medium shadow-inner">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-zinc-950 border-t border-l border-zinc-800 rotate-45" />
          "Oops! Looks like we sailed right off the map! Don't worry, as your Straw Hat Navigator, I'll guide you back to safety."
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full pt-2">
          <Link
            href="/discover"
            className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all shadow-lg text-center"
          >
            Explore Catalogue
          </Link>
          <Link
            href="/"
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-bold py-3 px-4 rounded-xl text-xs transition-all text-center"
          >
            Chart Course Home
          </Link>
        </div>

      </div>
    </div>
  );
}
