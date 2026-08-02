"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { fetchWithCredentials, getApiUrl } from "@/lib/auth";
import ReviewsSection from "@/components/community/ReviewsSection";
import DiscussionsSection from "@/components/community/DiscussionsSection";

interface Title {
  english?: string;
  romaji?: string;
  native?: string;
}

interface AnimeDetail {
  id: number;
  anilist_id: number;
  slug: string;
  title: Title;
  description?: string;
  format?: string;
  status?: string;
  source_material?: string;
  season?: string;
  season_year?: number;
  start_date?: string;
  end_date?: string;
  episode_count?: number;
  episode_duration?: number;
  country_code?: string;
  is_adult: boolean;
  average_score?: number;
  popularity: number;
  favourites: number;
  cover_large_url?: string;
  banner_url?: string;
  official_site_url?: string;
  genres: string[];
  tags: string[];
  studios: string[];
}

interface Character {
  id: number;
  first_name?: string;
  last_name?: string;
  native_name?: string;
  image_url?: string;
  role: string;
  voice_actor_name?: string;
  voice_actor_image?: string;
}

interface Relation {
  relation_type: string;
  anime: {
    id: number;
    slug: string;
    title: Title;
    cover_url?: string;
    format?: string;
    status?: string;
    average_score?: number;
  };
}

export default function AnimeDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  // Extract ID from the end of the slug segment (e.g., "attack-on-titan-16498" -> 16498)
  const slugParts = slug ? slug.split("-") : [];
  const animeId = slugParts[slugParts.length - 1];

  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "characters" | "relations" | "videos" | "reviews" | "discussions">("overview");

  // User auth & watchlist states
  const [user, setUser] = useState<any>(null);
  const [watchlistStatus, setWatchlistStatus] = useState<string>("");
  const [watchlistProgress, setWatchlistProgress] = useState<number>(0);
  const [watchlistScore, setWatchlistScore] = useState<number>(0);
  const [savingWatchlist, setSavingWatchlist] = useState<boolean>(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  
  const [isFavourite, setIsFavourite] = useState<boolean>(false);
  const [togglingFavourite, setTogglingFavourite] = useState<boolean>(false);

  const fetchWatchlistInfo = async (userId: string) => {
    try {
      const res = await fetchWithCredentials(getApiUrl("/me/lists"));
      if (res.ok) {
        const data = await res.json();
        const entry = data.find((e: any) => e.anime_id === Number(animeId));
        if (entry) {
          setWatchlistStatus(entry.status);
          setWatchlistProgress(entry.progress);
          setWatchlistScore(entry.score || 0);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFavouriteInfo = async () => {
    try {
      const res = await fetchWithCredentials(getApiUrl("/me/lists/favourites?entity_type=ANIME"));
      if (res.ok) {
        const data = await res.json();
        const hasFav = data.some((f: any) => f.entity_id === Number(animeId));
        setIsFavourite(hasFav);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleFavourite = async () => {
    if (!user) return;
    setTogglingFavourite(true);
    try {
      if (isFavourite) {
        const res = await fetchWithCredentials(getApiUrl(`/me/lists/favourites/ANIME/${animeId}`), {
          method: "DELETE",
        });
        if (res.ok || res.status === 204) {
          setIsFavourite(false);
        }
      } else {
        const res = await fetchWithCredentials(getApiUrl(`/me/lists/favourites/ANIME/${animeId}`), {
          method: "PUT",
        });
        if (res.ok) {
          setIsFavourite(true);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTogglingFavourite(false);
    }
  };

  const handleSaveWatchlist = async () => {
    if (!user) return;
    setSavingWatchlist(true);
    try {
      const res = await fetchWithCredentials(getApiUrl(`/me/lists/${animeId}`), {
        method: "PUT",
        body: JSON.stringify({
          status: watchlistStatus || "PLANNING",
          progress: watchlistProgress,
          score: watchlistScore || null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        alert(errData.detail || "Failed to update watchlist");
      } else {
        alert("Watchlist updated successfully!");
        fetchWatchlistInfo(user.id);
      }
    } catch (e) {
      alert("Error saving progress");
    } finally {
      setSavingWatchlist(false);
    }
  };

  const handleDeleteWatchlist = async () => {
    if (!user) return;
    if (!confirm("Are you sure you want to remove this from your list?")) return;
    setSavingWatchlist(true);
    try {
      const res = await fetchWithCredentials(getApiUrl(`/me/lists/${animeId}`), {
        method: "DELETE",
      });
      if (res.ok) {
        setWatchlistStatus("");
        setWatchlistProgress(0);
        setWatchlistScore(0);
        alert("Removed from watchlist");
      }
    } catch (e) {
      alert("Error removing from list");
    } finally {
      setSavingWatchlist(false);
    }
  };

  useEffect(() => {
    if (!animeId) return;

    const fetchAllDetails = async () => {
      setLoading(true);
      setError("");
      try {
        // Fetch Details
        const detRes = await fetch(`http://localhost:8000/api/v1/anime/${animeId}`);
        if (!detRes.ok) throw new Error("Anime not found in database");
        const detData = await detRes.json();
        setAnime(detData);

        // Check user session
        const authRes = await fetchWithCredentials(getApiUrl("/auth/me"));
        if (authRes.ok) {
          const userData = await authRes.json();
          setUser(userData);
          fetchWatchlistInfo(userData.id);
          fetchFavouriteInfo();
        }

        // Fetch Characters
        const charRes = await fetch(`http://localhost:8000/api/v1/anime/${animeId}/characters`);
        if (charRes.ok) {
          const charData = await charRes.json();
          setCharacters(charData);
        }

        // Fetch Relations
        const relRes = await fetch(`http://localhost:8000/api/v1/anime/${animeId}/relations`);
        if (relRes.ok) {
          const relData = await relRes.json();
          setRelations(relData);
        }

        // Fetch Videos
        const vidRes = await fetch(`http://localhost:8000/api/v1/anime/${animeId}/videos`);
        if (vidRes.ok) {
          const vidData = await vidRes.json();
          setVideos(vidData);
        }

      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchAllDetails();
  }, [animeId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-zinc-100 font-sans">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 text-sm font-medium">Retrieving catalog records...</p>
      </div>
    );
  }

  if (error || !anime) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-zinc-100 font-sans p-6 text-center">
        <div className="text-red-400 text-xl font-bold">Metadata Fetch Failure</div>
        <p className="text-zinc-400 text-sm max-w-md">{error || "Could not retrieve entry details."}</p>
        <Link href="/discover" className="mt-4 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl text-sm font-semibold transition-all">
          Back to Discover
        </Link>
      </div>
    );
  }

  const displayTitle = anime.title.english || anime.title.romaji || anime.title.native;
  const secondaryTitle = anime.title.romaji !== displayTitle ? anime.title.romaji : anime.title.native;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative">
      <Header />
      <main>
        {/* Banner */}
        <div className="relative h-[250px] md:h-[400px] w-full overflow-hidden bg-zinc-950">
        {anime.banner_url ? (
          <img
            src={anime.banner_url}
            alt={displayTitle}
            className="w-full h-full object-cover opacity-60"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-purple-950/20 to-indigo-950/20 opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
      </div>

      {/* Main Info Layer */}
      <div className="max-w-6xl mx-auto px-6 relative -mt-32 md:-mt-48 z-10">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Left Column: Cover & Watchlist */}
          <div className="flex flex-col gap-4 w-[180px] md:w-[240px] flex-shrink-0 mx-auto md:mx-0">
            <div className="w-full aspect-[3/4] bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800/80">
              {anime.cover_large_url ? (
                <img
                  src={anime.cover_large_url}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">No Cover</div>
              )}
            </div>

            {/* Watchlist Interaction Widget */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md rounded-2xl p-4 flex flex-col gap-4 text-sm shadow-xl">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">YOUR WATCHLIST</span>
              {user ? (
                <div className="flex flex-col gap-3">
                  {/* Status Dropdown */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Status</label>
                    <select
                      value={watchlistStatus}
                      onChange={(e) => setWatchlistStatus(e.target.value)}
                      className="bg-zinc-950/80 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
                    >
                      <option value="">Not in list</option>
                      <option value="PLANNING">Planning</option>
                      <option value="WATCHING">Watching</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="PAUSED">Paused</option>
                      <option value="DROPPED">Dropped</option>
                    </select>
                  </div>

                  {/* Episode Progress */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">
                      Progress {anime.episode_count ? `(Max ${anime.episode_count})` : ""}
                    </label>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => setWatchlistProgress(Math.max(0, watchlistProgress - 1))}
                        className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center font-bold"
                      >
                        -
                      </button>
                      <span className="text-sm font-semibold flex-1 text-center">
                        {watchlistProgress}
                      </span>
                      <button
                        onClick={() => setWatchlistProgress(watchlistProgress + 1)}
                        className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Score (0-100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={watchlistScore || ""}
                      onChange={(e) => setWatchlistScore(Number(e.target.value))}
                      placeholder="e.g. 85"
                      className="bg-zinc-950/80 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  {/* Save / Delete Actions */}
                  <div className="flex flex-col gap-2 mt-2">
                    <button
                      onClick={handleSaveWatchlist}
                      disabled={savingWatchlist || !watchlistStatus}
                      className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md"
                    >
                      {savingWatchlist ? "Saving..." : "Save Progress"}
                    </button>
                    {watchlistStatus && (
                      <button
                        onClick={handleDeleteWatchlist}
                        disabled={savingWatchlist}
                        className="w-full py-1.5 rounded-xl bg-zinc-800 hover:bg-red-950/40 hover:text-red-400 text-zinc-400 text-[10px] font-bold transition-all"
                      >
                        Remove from List
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-2 flex flex-col gap-2">
                  <p className="text-zinc-500 text-xs">Sign in to track your watching progress.</p>
                  <Link
                    href="/login"
                    className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-bold transition-all block text-center"
                  >
                    Login to Track
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Core Info */}
          <div className="flex-grow text-center md:text-left mt-4 md:mt-20">
            <h1 className="text-3xl md:text-5xl font-black tracking-tight">{displayTitle}</h1>
            {secondaryTitle && <p className="text-zinc-400 mt-1 font-medium">{secondaryTitle}</p>}
            
            <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-2.5 text-xs">
              {anime.format && (
                <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold">{anime.format}</span>
              )}
              {anime.status && (
                <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold">{anime.status}</span>
              )}
              {anime.season_year && (
                <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold">{anime.season} {anime.season_year}</span>
              )}
              {anime.average_score && (
                <span className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 font-bold">⭐ {anime.average_score}%</span>
              )}
            </div>

            {/* Actions & Site Link Row */}
            <div className="mt-6 flex flex-wrap justify-center md:justify-start items-center gap-5">
              {user && (
                <button
                  onClick={handleToggleFavourite}
                  disabled={togglingFavourite}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                    isFavourite
                      ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <svg className={`w-3.5 h-3.5 ${isFavourite ? "fill-red-500 text-red-500 animate-pulse" : "text-zinc-500"}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  {isFavourite ? "Favourited" : "Favourite"}
                </button>
              )}

              {anime.official_site_url && (
                <a
                  href={anime.official_site_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-semibold"
                >
                  Visit Official Website
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="mt-12 border-b border-zinc-900 flex gap-6 text-sm overflow-x-auto whitespace-nowrap">
          {["overview", "characters", "relations", "videos", "reviews", "discussions"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t as any)}
              className={`pb-4 font-bold capitalize transition-all border-b-2 ${
                activeTab === t
                  ? "border-purple-500 text-purple-400"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content Tabs */}
        <div className="py-10">
          {/* Tab 1: Overview */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Left Column: Synopsis */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                <div>
                  <h2 className="text-xl font-bold mb-3 text-zinc-300">Synopsis</h2>
                  <p className="text-zinc-400 leading-relaxed text-sm whitespace-pre-line">
                    {anime.description || "No synopsis available."}
                  </p>
                </div>
              </div>

              {/* Right Column: Metadata Panel */}
              <div className="lg:col-span-4 bg-zinc-900/20 border border-zinc-900/80 rounded-2xl p-6 flex flex-col gap-5 text-sm h-fit">
                <div>
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1">Studios</span>
                  <span className="text-zinc-300 font-medium">{anime.studios.join(", ") || "None"}</span>
                </div>
                {anime.source_material && (
                  <div>
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1">Source Material</span>
                    <span className="text-zinc-300 font-medium">{anime.source_material}</span>
                  </div>
                )}
                {anime.episode_count && (
                  <div>
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1">Episodes</span>
                    <span className="text-zinc-300 font-medium">{anime.episode_count} episodes ({anime.episode_duration || "Unknown"} mins)</span>
                  </div>
                )}
                {anime.genres.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-2">Genres</span>
                    <div className="flex flex-wrap gap-1.5">
                      {anime.genres.map((g) => (
                        <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-zinc-950 border border-zinc-900 text-zinc-400">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {anime.tags.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-2">Tags</span>
                    <div className="flex flex-wrap gap-1.5">
                      {anime.tags.slice(0, 8).map((t) => (
                        <span key={t} className="text-[11px] px-2 py-0.5 rounded-md bg-purple-950/20 border border-purple-900/10 text-purple-400">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Characters */}
          {activeTab === "characters" && (
            <div>
              {characters.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-sm">No character maps found for this anime.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {characters.map((char) => (
                    <div
                      key={char.id}
                      className="flex justify-between bg-zinc-900/30 border border-zinc-900 rounded-xl overflow-hidden p-3.5 hover:border-zinc-800 transition-all duration-300"
                    >
                      {/* Character Info */}
                      <div className="flex gap-3">
                        <div className="w-[60px] aspect-[3/4] rounded-lg overflow-hidden bg-zinc-950 flex-shrink-0">
                          {char.image_url ? (
                            <img src={char.image_url} alt={char.first_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-zinc-900" />
                          )}
                        </div>
                        <div className="flex flex-col justify-center">
                          <span className="text-sm font-semibold text-zinc-200">
                            {`${char.first_name || ""} ${char.last_name || ""}`.trim()}
                          </span>
                          {char.native_name && <span className="text-[11px] text-zinc-500">{char.native_name}</span>}
                          <span className="text-[10px] uppercase font-bold text-purple-400 mt-1 tracking-wider">{char.role}</span>
                        </div>
                      </div>

                      {/* Voice Actor Info */}
                      {char.voice_actor_name && (
                        <div className="flex gap-3 text-right">
                          <div className="flex flex-col justify-center">
                            <span className="text-sm font-medium text-zinc-300">{char.voice_actor_name}</span>
                            <span className="text-[11px] text-zinc-500">Japanese</span>
                          </div>
                          <div className="w-[60px] aspect-[3/4] rounded-lg overflow-hidden bg-zinc-950 flex-shrink-0">
                            {char.voice_actor_image ? (
                              <img src={char.voice_actor_image} alt={char.voice_actor_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-zinc-900" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Relations */}
          {activeTab === "relations" && (
            <div>
              {relations.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-sm">No mapped relation logs found.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {relations.map((rel, idx) => {
                    const relTitle = rel.anime.title.english || rel.anime.title.romaji || rel.anime.title.native;
                    return (
                      <Link
                        key={idx}
                        href={`/anime/${rel.anime.slug}-${rel.anime.id}`}
                        className="group flex gap-4 bg-zinc-900/30 border border-zinc-900 rounded-xl p-3.5 hover:border-zinc-800 hover:-translate-y-0.5 transition-all duration-300"
                      >
                        {/* Cover image */}
                        <div className="w-[60px] aspect-[3/4] rounded-lg overflow-hidden bg-zinc-950 flex-shrink-0">
                          {rel.anime.cover_url ? (
                            <img src={rel.anime.cover_url} alt={relTitle} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-zinc-900" />
                          )}
                        </div>
                        <div className="flex flex-col justify-center">
                          <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider mb-1">
                            {rel.relation_type}
                          </span>
                          <span className="text-sm font-semibold text-zinc-200 line-clamp-2 group-hover:text-purple-400 transition-colors">
                            {relTitle}
                          </span>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                            <span>{rel.anime.format || "Unknown"}</span>
                            {rel.anime.average_score && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                <span className="text-yellow-500 font-medium">⭐ {rel.anime.average_score}%</span>
                              </>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Videos */}
          {activeTab === "videos" && (
            <div>
              {videos.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-sm">No official videos synced for this anime yet.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {videos.map((vid) => (
                    <div
                      key={vid.id}
                      onClick={() => setActiveVideoId(vid.provider_video_id)}
                      className="cursor-pointer group flex flex-col bg-zinc-900/30 border border-zinc-900 rounded-xl overflow-hidden hover:border-zinc-800 transition-all duration-300 shadow-lg"
                    >
                      <div className="aspect-video w-full bg-zinc-950 relative overflow-hidden">
                        <img
                          src={vid.thumbnail_url || `https://img.youtube.com/vi/${vid.provider_video_id}/0.jpg`}
                          alt={vid.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {/* Play button overlay */}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-900/50">
                            <svg className="w-6 h-6 fill-current ml-0.5" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                        <span className="absolute bottom-2 right-2 text-[10px] bg-black/75 px-1.5 py-0.5 rounded font-bold tracking-wide">
                          {vid.video_type}
                        </span>
                      </div>
                      <div className="p-3.5 flex flex-col gap-1">
                        <span className="text-sm font-semibold text-zinc-200 line-clamp-1 group-hover:text-purple-400 transition-colors">
                          {vid.title}
                        </span>
                        <span className="text-[11px] text-zinc-500">Official Embed • YouTube</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Reviews */}
          {activeTab === "reviews" && (
            <ReviewsSection animeId={anime.id} currentUser={user} />
          )}

          {/* Tab 6: Discussions */}
          {activeTab === "discussions" && (
            <DiscussionsSection animeId={anime.id} currentUser={user} />
          )}
        </div>
      </div>
    </main>

      {/* Modal Video Player */}
      {activeVideoId && (
        <div 
          onClick={() => setActiveVideoId(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl aspect-video bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl relative"
          >
            <button
              onClick={() => setActiveVideoId(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/60 hover:bg-zinc-800/80 text-zinc-300 hover:text-white flex items-center justify-center text-xl font-bold transition-all border border-zinc-800"
            >
              ×
            </button>
            <iframe
              src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1&enablejsapi=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
