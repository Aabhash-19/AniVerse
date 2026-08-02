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

  const handleImportAniList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anilistUsername.trim()) return;
    setImporting(true);
    try {
      const res = await fetchWithCredentials(getApiUrl("/me/lists/import/anilist"), {
        method: "POST",
        body: JSON.stringify({ username: anilistUsername.trim() }),
      });
      if (res.ok) {
        const result = await res.json();
        alert(`Successfully synced ${result.imported_count} list entries from AniList!`);
        setAnilistUsername("");
        fetchWatchlist();
      } else {
        const err = await res.json();
        alert(err.detail || "AniList profile import failed.");
      }
    } catch (err: any) {
      alert("Error importing AniList watchlist: " + err.message);
    } finally {
      setImporting(false);
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

  useEffect(() => {
    fetchWatchlist();
    fetchFavourites();
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
          <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-16 text-center">
            <svg className="w-12 h-12 text-zinc-650 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <p className="text-zinc-400 font-bold text-lg">No entries here</p>
            <p className="text-sm text-zinc-600 mt-1 max-w-sm mx-auto">
              Nothing is listed under this status. Browse discover page to find and add new anime!
            </p>
            <Link
              href="/discover"
              className="mt-6 inline-block px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold transition-all shadow-lg shadow-purple-900/20"
            >
              Discover Anime
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
      </main>
    </div>
  );
}
