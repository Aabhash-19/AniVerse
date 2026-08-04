import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden">
      {/* Dynamic ambient blobs */}
      <div className="absolute top-[20%] left-[20%] w-[60%] h-[60%] bg-purple-900/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-[60%] h-[60%] bg-indigo-900/10 rounded-full blur-[140px] pointer-events-none" />

      <main className="max-w-xl text-center px-6 relative z-10 flex flex-col items-center gap-8">
        {/* Mascot Avatar */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-amber-500 to-indigo-600 rounded-full blur-md opacity-75 group-hover:opacity-100 transition duration-500 animate-pulse" />
          <img
            src="/nami-wano-avatar.jpg"
            alt="Nami — NamiVerse Mascot"
            className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-2 border-purple-400/80 shadow-2xl shadow-purple-900/50"
          />
        </div>

        {/* Animated Brand Logo */}
        <div className="flex flex-col gap-2">
          <span className="text-5xl md:text-7xl font-black bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-500 bg-clip-text text-transparent tracking-widest animate-pulse">
            NAMIVERSE
          </span>
          <span className="text-xs uppercase font-extrabold tracking-[0.3em] text-zinc-500">
            AI-Powered Discovery Platform
          </span>
        </div>

        <p className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-md">
          Explore complete catalogue entries, official media clips, characters, studios, and staff. Safe, spoiler-free, and powered by official sources.
        </p>

        <div className="flex gap-4">
          <Link
            href="/discover"
            className="flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-8 text-sm font-bold text-white transition-all duration-300 shadow-xl shadow-purple-950/40 hover:scale-105"
          >
            Enter Platform
          </Link>
        </div>
      </main>
    </div>
  );
}

