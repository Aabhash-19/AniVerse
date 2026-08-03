"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { fetchWithCredentials, getApiUrl } from "@/lib/auth";

interface WatchlistEntry {
  id: string;
  anime_id: number;
  status: string;
  progress: number;
  score?: number;
  notes?: string;
  is_private: boolean;
  anime: {
    id: number;
    slug: string;
    title: {
      english?: string;
      romaji?: string;
      native?: string;
    };
    cover_url: string;
    format?: string;
    status?: string;
    season_year?: number;
    episode_count?: number;
    average_score?: number;
    genres: string[];
  };
}

interface FavouriteEntry {
  entity_type: string;
  entity_id: number;
  created_at: string;
  anime?: {
    id: number;
    slug: string;
    title: { english?: string; romaji?: string; native?: string };
    cover_url: string;
  };
}

export default function MyListPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [favourites, setFavourites] = useState<FavouriteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<string>("WATCHING");
  const [anilistUsername, setAnilistUsername] = useState("");
  const [importing, setImporting] = useState(false);

  // Blocked users
  const [blockedUsers, setBlockedUsers] = useState<{ blocked_id: string; username: string }[]>([]);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  // Streaming progress modal state
  const [importProgress, setImportProgress] = useState<{
    showModal: boolean;
    username: string;
    total: number;
    current: number;
    currentTitle: string;
    currentCover?: string;
    currentStatus?: string;
    isComplete: boolean;
    errorMessage?: string;
    importedCount: number;
    logItems: Array<{ id: string; title: string; status: string; progress?: number; score?: number }>;
  }>({
    showModal: false,
    username: "",
    total: 0,
    current: 0,
    currentTitle: "",
    isComplete: false,
    importedCount: 0,
    logItems: [],
  });

  const handleImportAniList = async (e: React.FormEvent) => {
    e.preventDefault();
    const uname = anilistUsername.trim();
    if (!uname) return;

    setImportProgress({
      showModal: true,
      username: uname,
      total: 0,
      current: 0,
      currentTitle: "Connecting to AniList...",
      isComplete: false,
      importedCount: 0,
      logItems: [],
    });

    try {
      const response = await fetchWithCredentials(
        getApiUrl(`/me/lists/import/anilist/stream?username=${encodeURIComponent(uname)}`)
      );

      if (!response.ok) {
        let errMessage = "AniList import failed";
        try {
          const errData = await response.json();
          errMessage = errData.detail || errMessage;
        } catch (_) {}
        setImportProgress((prev) => ({ ...prev, errorMessage: errMessage }));
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.startsWith("data: ")) {
              try {
                const payload = JSON.parse(cleanLine.replace("data: ", ""));
                if (payload.type === "start") {
                  setImportProgress((prev) => ({
                    ...prev,
                    total: payload.total,
                    currentTitle: `Fetched ${payload.total} items...`,
                  }));
                } else if (payload.type === "progress") {
                  setImportProgress((prev) => ({
                    ...prev,
                    current: payload.current,
                    total: payload.total,
                    currentTitle: payload.title,
                    currentCover: payload.cover_url,
                    currentStatus: payload.status,
                    logItems: [
                      {
                        id: `${payload.current}-${payload.title}`,
                        title: payload.title,
                        status: payload.status,
                        progress: payload.progress,
                        score: payload.score,
                      },
                      ...prev.logItems.slice(0, 24),
                    ],
                  }));
                } else if (payload.type === "complete") {
                  setImportProgress((prev) => ({
                    ...prev,
                    current: payload.total,
                    isComplete: true,
                    importedCount: payload.imported_count,
                  }));
                  setAnilistUsername("");
                  fetchWatchlist();
                } else if (payload.type === "error") {
                  setImportProgress((prev) => ({ ...prev, errorMessage: payload.message }));
                }
              } catch (_) {}
            }
          }
        }
      }
    } catch (err: any) {
      setImportProgress((prev) => ({ ...prev, errorMessage: err.message || "Failed to reach backend service." }));
    }
  };


  const fetchWatchlist = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchWithCredentials(getApiUrl("/me/lists"));
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to load your watchlist.");
      }
      const data = await res.json();
      setEntries(data);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const fetchFavourites = async () => {
    try {
      const res = await fetchWithCredentials(getApiUrl("/me/lists/favourites?entity_type=ANIME"));
      if (res.ok) {
        const data = await res.json();
        setFavourites(data);
      }
    } catch (e) {
      console.error("Failed to fetch favourites", e);
    }
  };

  const fetchBlocked = async () => {
    try {
      const res = await fetchWithCredentials(getApiUrl("/me/blocks"));
      if (res.ok) setBlockedUsers(await res.json());
    } catch (_) {}
  };

  const handleUnblock = async (username: string) => {
    setUnblocking(username);
    try {
      const res = await fetchWithCredentials(getApiUrl(`/users/${username}/block`), { method: "DELETE" });
      if (res.ok) fetchBlocked();
      else { const e = await res.json(); alert(e.detail || "Failed to unblock."); }
    } finally {
      setUnblocking(null);
    }
  };

  useEffect(() => {
    fetchWatchlist();
    fetchFavourites();
    fetchBlocked();
  }, []);

  const handleIncrementEpisode = async (entry: WatchlistEntry) => {
    const nextProgress = entry.progress + 1;
    if (entry.anime.episode_count && nextProgress > entry.anime.episode_count) {
      return;
    }

    try {
      const res = await fetchWithCredentials(getApiUrl(`/me/lists/${entry.anime_id}`), {
        method: "PUT",
        body: JSON.stringify({
          status: nextProgress === entry.anime.episode_count ? "COMPLETED" : entry.status,
          progress: nextProgress,
          score: entry.score || null,
        }),
      });

      if (res.ok) {
        fetchWatchlist();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredEntries = entries.filter((e) => e.status === activeTab);

  const statuses = [
    { key: "WATCHING", label: "Watching" },
    { key: "PLANNING", label: "Planning" },
    { key: "COMPLETED", label: "Completed" },
    { key: "PAUSED", label: "Paused" },
    { key: "DROPPED", label: "Dropped" },
    { key: "REWATCHING", label: "Rewatching" },
  ];


  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />

      <Header />

      <main className="max-w-6xl mx-auto px-6 py-10 relative z-10">
        <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-900/50 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              My Watchlist
            </h1>
            <p className="text-zinc-400 mt-2">Manage and track your watching progress.</p>
          </div>
          
          <form onSubmit={handleImportAniList} className="flex gap-2 w-full md:w-auto">
            <input
              type="text"
              placeholder="AniList Username"
              required
              value={anilistUsername}
              onChange={(e) => setAnilistUsername(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-purple-500 text-zinc-200"
            />
            <button
              type="submit"
              disabled={importing}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all disabled:opacity-50 flex-shrink-0"
            >
              {importing ? "Importing..." : "Sync AniList"}
            </button>
          </form>
        </div>

        {/* Status Tab list */}
        <div className="flex border-b border-zinc-900 gap-6 text-sm mb-8 overflow-x-auto">
          {statuses.map((tab) => {
            const count = entries.filter((e) => e.status === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-4 font-bold capitalize transition-all border-b-2 flex items-center gap-2 flex-shrink-0 ${
                  activeTab === tab.key
                    ? "border-purple-500 text-purple-400"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? "bg-purple-500/20 text-purple-300" : "bg-zinc-900 text-zinc-500"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-400 text-sm font-medium">Scanning watchlist logs...</p>
          </div>
        ) : error ? (
          <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-6 text-center text-red-400">
            <p className="font-semibold">Error occurred</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="bg-zinc-900/40 border border-amber-500/30 rounded-3xl p-12 text-center flex flex-col items-center gap-4 max-w-lg mx-auto shadow-2xl backdrop-blur-xl">
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-amber-500 shadow-xl bg-purple-950">
              <img src="/nami-avatar.png" alt="Nami Mascot" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-zinc-200 font-black text-lg">Your {activeTab} map is empty!</p>
              <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                "Don't leave this section blank! Explore the catalogue or ask me in the bottom-right chat for a top-tier recommendation to add."
              </p>
            </div>
            <Link
              href="/discover"
              className="mt-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-lg"
            >
              Explore Catalogue
            </Link>
          </div>
        ) : (

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredEntries.map((entry) => {
              const displayTitle = entry.anime.title.english || entry.anime.title.romaji || entry.anime.title.native || "Unknown Title";
              return (
                <div
                  key={entry.id}
                  className="flex bg-zinc-900/30 border border-zinc-900 rounded-2xl overflow-hidden p-4 hover:border-zinc-800 transition-all duration-300 shadow-lg relative group"
                >
                  {/* Cover */}
                  <Link
                    href={`/anime/${entry.anime.slug}-${entry.anime_id}`}
                    className="w-[80px] md:w-[100px] aspect-[3/4] bg-zinc-950 rounded-xl overflow-hidden shadow-md flex-shrink-0"
                  >
                    <img
                      src={entry.anime.cover_url}
                      alt={displayTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </Link>

                  {/* Info details */}
                  <div className="ml-4 flex-grow flex flex-col justify-between">
                    <div>
                      <Link
                        href={`/anime/${entry.anime.slug}-${entry.anime_id}`}
                        className="text-base font-bold text-zinc-200 line-clamp-2 hover:text-purple-400 transition-all"
                      >
                        {displayTitle}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1.5 items-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        <span>{entry.anime.format || "TV"}</span>
                        <span>•</span>
                        <span>{entry.anime.season_year || "Unknown Year"}</span>
                        {entry.score && (
                          <>
                            <span>•</span>
                            <span className="text-yellow-500 font-black">⭐ {entry.score}%</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Progress tracking */}
                    <div className="mt-4 flex items-center justify-between border-t border-zinc-800/40 pt-3">
                      <div className="text-xs text-zinc-400">
                        Progress:{" "}
                        <span className="font-bold text-zinc-200">
                          {entry.progress} / {entry.anime.episode_count || "∞"}
                        </span>
                      </div>
                      
                      {/* Plus button to quickly increment episode progress */}
                      {(!entry.anime.episode_count || entry.progress < entry.anime.episode_count) && (
                        <button
                          onClick={() => handleIncrementEpisode(entry)}
                          className="w-8 h-8 rounded-lg bg-purple-600/10 border border-purple-500/20 hover:bg-purple-600 hover:text-white text-purple-400 font-black flex items-center justify-center transition-all text-sm"
                        >
                          +1
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Favourites Section */}
        {favourites.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-xl font-extrabold tracking-tight text-zinc-200">
                Favourites
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-bold">
                {favourites.length}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {favourites.map((fav) => {
                const title = fav.anime?.title?.english || fav.anime?.title?.romaji || "Unknown";
                const slug = fav.anime?.slug || "";
                const cover = fav.anime?.cover_url;
                return (
                  <Link
                    key={`${fav.entity_type}-${fav.entity_id}`}
                    href={slug ? `/anime/${slug}` : "#"}
                    className="group flex flex-col gap-2"
                  >
                    <div className="aspect-[3/4] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 group-hover:border-purple-500/40 transition-all shadow-lg relative">
                      {cover ? (
                        <img src={cover} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">No Cover</div>
                      )}
                      {/* Heart overlay */}
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 fill-red-500 text-red-500" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors line-clamp-2 leading-tight">
                      {title}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        {/* Live AniList Import Progress Modal */}
        {importProgress.showModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 relative overflow-hidden">
              {/* Ambient purple lighting */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />

              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                <div>
                  <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                    <span>Syncing Watchlist</span>
                    <span className="text-purple-400 font-mono text-sm">@{importProgress.username}</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Importing your live public profile and ratings from AniList...
                  </p>
                </div>
                {importProgress.isComplete || importProgress.errorMessage ? (
                  <button
                    onClick={() => setImportProgress((prev) => ({ ...prev, showModal: false }))}
                    className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center text-sm font-bold"
                  >
                    
                  </button>
                ) : (
                  <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              {/* Error state */}
              {importProgress.errorMessage ? (
                <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-4 text-center text-red-400 text-xs font-semibold">
                  {importProgress.errorMessage}
                </div>
              ) : (
                <>
                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-zinc-300">
                      <span>
                        {importProgress.total > 0
                          ? `${Math.round((importProgress.current / importProgress.total) * 100)}% Complete`
                          : "Fetching profile..."}
                      </span>
                      <span className="text-purple-400 font-mono">
                        {importProgress.current} / {importProgress.total || "?"}
                      </span>
                    </div>

                    <div className="w-full bg-zinc-900 border border-zinc-850 h-3 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-600 via-purple-500 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-lg shadow-purple-950/50"
                        style={{
                          width: `${
                            importProgress.total > 0
                              ? Math.min(100, Math.round((importProgress.current / importProgress.total) * 100))
                              : 5
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Currently Importing Anime Card */}
                  {importProgress.currentTitle && !importProgress.isComplete && (
                    <div className="bg-zinc-900/50 border border-purple-900/40 rounded-2xl p-3.5 flex items-center gap-3">
                      {importProgress.currentCover ? (
                        <img
                          src={importProgress.currentCover}
                          alt=""
                          className="w-10 h-14 object-cover rounded-lg flex-shrink-0 shadow"
                        />
                      ) : (
                        <div className="w-10 h-14 bg-zinc-850 rounded-lg flex items-center justify-center text-[9px] text-zinc-600">
                          Cover
                        </div>
                      )}
                      <div className="min-w-0 flex-grow">
                        <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block">
                          Currently Importing:
                        </span>
                        <p className="text-sm font-bold text-zinc-100 truncate mt-0.5">
                          {importProgress.currentTitle}
                        </p>
                        {importProgress.currentStatus && (
                          <span className="text-[10px] text-zinc-400 font-medium">
                            Status: {importProgress.currentStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Live Activity Log Stream */}
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 text-xs font-mono">
                    {importProgress.logItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between bg-zinc-900/40 border border-zinc-900 rounded-xl px-3 py-2 text-zinc-300"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-emerald-400"></span>
                          <span className="truncate font-semibold text-zinc-200">{item.title}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-850 border border-zinc-800 text-purple-300 font-bold flex-shrink-0">
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Completion Banner */}
                  {importProgress.isComplete && (
                    <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-4 text-center space-y-3">
                      <p className="text-emerald-300 font-bold text-sm">
                         Successfully imported {importProgress.importedCount} entries from AniList!
                      </p>
                      <button
                        onClick={() => setImportProgress((prev) => ({ ...prev, showModal: false }))}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs transition-all shadow-lg shadow-emerald-950/40"
                      >
                        View Updated Watchlist
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

