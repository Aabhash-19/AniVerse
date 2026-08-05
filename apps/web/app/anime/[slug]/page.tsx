"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { fetchWithCredentials, getApiUrl } from "@/lib/auth";


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
    anilist_id: number;
    slug: string;
    title: Title;
    cover_url?: string;
    format?: string;
    status?: string;
    season?: string;
    season_year?: number;
    episode_count?: number;
    average_score?: number;
  };
}

export default function AnimeDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  // Extract ID from the end of the slug segment if numeric (e.g., "attack-on-titan-16498" -> 16498, else "love-unseen-beneath-the-clear-night-sky")
  const slugParts = slug ? slug.split("-") : [];
  const lastPart = slugParts[slugParts.length - 1];
  const animeId = lastPart && /^\d+$/.test(lastPart) ? lastPart : slug;


  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"characters" | "relations" | "videos" | "reviews" | "recommendations">("characters");

  // Tab content states from AniList
  const [anilistReviews, setAnilistReviews] = useState<any[]>([]);
  const [anilistRecs, setAnilistRecs] = useState<any[]>([]);
  const [anilistVideos, setAnilistVideos] = useState<{ trailer: any; streamingEpisodes: any[] }>({ trailer: null, streamingEpisodes: [] });
  const [loadingTabContent, setLoadingTabContent] = useState(false);
  const [similarRecs, setSimilarRecs] = useState<any[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState<boolean>(false);


  // Subscription (Follow) states
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [togglingSub, setTogglingSub] = useState(false);

  // User auth & watchlist states
  const [user, setUser] = useState<any>(null);
  const [watchlistStatus, setWatchlistStatus] = useState<string>("");
  const [watchlistProgress, setWatchlistProgress] = useState<number>(0);
  const [watchlistScore, setWatchlistScore] = useState<number>(0);
  const [savingWatchlist, setSavingWatchlist] = useState<boolean>(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  
  const [isFavourite, setIsFavourite] = useState<boolean>(false);
  const [togglingFavourite, setTogglingFavourite] = useState<boolean>(false);
  const [expandedSynopsis, setExpandedSynopsis] = useState<boolean>(false);

  const fetchSimilar = async () => {
    if (!anime) return;
    setLoadingSimilar(true);
    try {
      const res = await fetchWithCredentials(getApiUrl(`/recommendations/similar/${anime.id}`));
      if (res.ok) setSimilarRecs(await res.json());
    } finally {
      setLoadingSimilar(false);
    }
  };

  const fetchSubscriptionInfo = async () => {
    try {
      const res = await fetchWithCredentials(getApiUrl(`/anime/${animeId}/subscription`));
      if (res.ok) {
        const data = await res.json();
        setIsSubscribed(data !== null);
      }
    } catch (_) {}
  };

  const handleToggleSubscription = async () => {
    if (!user) return;
    setTogglingSub(true);
    try {
      const res = await fetchWithCredentials(getApiUrl(`/anime/${animeId}/subscribe`), {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        const active = data.trailer_alerts || data.episode_alerts || data.news_alerts;
        setIsSubscribed(active);
      }
    } finally {
      setTogglingSub(false);
    }
  };

  const handleRecFeedback = async (recId: number, feedbackType: "INTERESTED" | "NOT_INTERESTED") => {
    try {
      const res = await fetchWithCredentials(getApiUrl(`/recommendations/${recId}/feedback`), {
        method: "POST",
        body: JSON.stringify({ feedback_type: feedbackType }),
      });
      if (res.ok) {
        alert(feedbackType === "INTERESTED" ? "Added to your profile preferences! " : "Hiding this suggestion. ");
        fetchSimilar();
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (!animeId) return;

    const loadTabData = async () => {
      try {
        if (activeTab === "reviews" && anilistReviews.length === 0) {
          setLoadingTabContent(true);
          const res = await fetchWithCredentials(getApiUrl(`/anime/${animeId}/reviews`));
          if (res.ok) {
            const data = await res.json();
            setAnilistReviews(Array.isArray(data) ? data : []);
          }
        } else if (activeTab === "recommendations" && anilistRecs.length === 0) {
          setLoadingTabContent(true);
          const res = await fetchWithCredentials(getApiUrl(`/anime/${animeId}/anilist-recommendations`));
          if (res.ok) {
            const data = await res.json();
            setAnilistRecs(Array.isArray(data) ? data : []);
          }
        } else if (activeTab === "videos" && !anilistVideos.trailer && anilistVideos.streamingEpisodes.length === 0) {
          setLoadingTabContent(true);
          const res = await fetchWithCredentials(getApiUrl(`/anime/${animeId}/anilist-videos`));
          if (res.ok) {
            const data = await res.json();
            if (data && typeof data === "object") setAnilistVideos(data);
          }
        }
      } catch (_) {
      } finally {
        setLoadingTabContent(false);
      }

    };

    loadTabData();
  }, [activeTab, animeId]);



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
    if (!slug) return;

    const fetchAllDetails = async () => {
      setLoading(true);
      setError("");
      try {
        // Fetch Details (try animeId first, fallback to full slug)
        let detRes = await fetchWithCredentials(getApiUrl(`/anime/${animeId || slug}`));
        if (!detRes.ok && slug) {
          detRes = await fetchWithCredentials(getApiUrl(`/anime/${slug}`));
        }
        if (!detRes.ok) throw new Error("Could not load anime metadata. Please try again.");
        const detData = await detRes.json();
        setAnime(detData);

        const realId = detData.id || animeId;

        // Fetch user status, characters, relations, and videos in parallel
        const [authRes, charRes, relRes, vidRes] = await Promise.all([
          fetchWithCredentials(getApiUrl("/auth/me")),
          fetchWithCredentials(getApiUrl(`/anime/${realId}/characters`)),
          fetchWithCredentials(getApiUrl(`/anime/${realId}/relations`)),
          fetchWithCredentials(getApiUrl(`/anime/${realId}/videos`))
        ]);

        // Process user session if logged in
        if (authRes.ok) {
          const userData = await authRes.json();
          setUser(userData);
          // Fetch watchlist info, favourite info, and subscription in parallel
          Promise.all([
            fetchWatchlistInfo(userData.id),
            fetchFavouriteInfo(),
            fetchSubscriptionInfo()
          ]).catch(err => console.error("Error loading user state:", err));
        }

        // Process characters
        if (charRes.ok) {
          const charData = await charRes.json();
          setCharacters(charData);
        }

        // Process relations
        if (relRes.ok) {
          const relData = await relRes.json();
          setRelations(relData);
        }

        // Process videos
        if (vidRes.ok) {
          const vidData = await vidRes.json();
          setVideos(vidData);
        }

      } catch (err: any) {
        setError(err.message || "An error occurred loading entry details.");
      } finally {
        setLoading(false);
      }
    };

    fetchAllDetails();
  }, [slug, animeId]);


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

  // Use direct CDN URLs with referrerPolicy="no-referrer" — img tags don't have CORS restrictions
  // Proxying through backend was failing on Render (extra hop, whitelist restrictions)
  const getProxiedImageUrl = (url?: string) => {
    if (!url) return "";
    return url;
  };

  const displayTitle = anime ? (anime.title.english || anime.title.romaji || anime.title.native) : "";
  const secondaryTitle = anime ? (anime.title.romaji !== displayTitle ? anime.title.romaji : anime.title.native) : "";
  const cleanSynopsisText = anime ? (anime.description || "").replace(/<[^>]*>?/gm, "").trim() : "";

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
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-60"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
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
            <div className="w-full aspect-[3/4] bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl">
              {anime.cover_large_url ? (
                <img
                  src={anime.cover_large_url}
                  alt={displayTitle}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">No Cover</div>
              )}
            </div>

            {/* Watchlist Interaction Widget */}
            <div className="bg-zinc-900/30 border border-zinc-900/40 backdrop-blur-md rounded-2xl p-4 flex flex-col gap-4 text-sm shadow-xl">
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
                <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold">{anime.status.replace(/_/g, " ")}</span>
              )}

              {anime.season_year && (
                <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold">{anime.season} {anime.season_year}</span>
              )}
              {anime.average_score && (
                <span className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 font-bold">{anime.average_score}% Score</span>
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

              {user && (
                <button
                  onClick={handleToggleSubscription}
                  disabled={togglingSub}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                    isSubscribed
                      ? "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <span>{isSubscribed ? " Following" : "Follow"}</span>
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

            {/* Synopsis Banner Block placed directly in Hero Header space */}
            {cleanSynopsisText && (
              <div className="mt-6 space-y-2 text-left">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Synopsis</h3>
                <div className="bg-zinc-900/30 backdrop-blur-md rounded-2xl p-4 md:p-5 text-xs md:text-sm text-zinc-300 leading-relaxed shadow-xl max-w-4xl whitespace-pre-line">
                  {cleanSynopsisText}
                </div>
              </div>
            )}

            {/* Nami's Mascot Review Callout */}
            <div className="mt-4 bg-gradient-to-r from-zinc-900 via-amber-950/20 to-zinc-900 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-4 shadow-lg max-w-4xl">
              <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-amber-500 shadow-md flex-shrink-0 bg-purple-950">
                <img src="/nami-wano-avatar.jpg" alt="Nami Mascot" className="w-full h-full object-cover" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-black text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                  Nami's Navigator Log
                </div>
                <p className="text-xs text-zinc-300 font-medium mt-0.5">
                  {anime.average_score && anime.average_score >= 80
                    ? `Charted at a high rating of ${anime.average_score}%! This show is officially certified high value by your Straw Hat Navigator.`
                    : `Log pose set for ${displayTitle}! Ask me in the chatbot for similar recommendations.`}
                </p>
              </div>
            </div>


            {/* Studio & Additional Metadata Pills */}
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-left">
              {anime.studios && anime.studios.length > 0 && (
                <div className="bg-zinc-900/50 px-3.5 py-2 rounded-xl flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Studio</span>
                  <span className="text-zinc-200 font-extrabold">{anime.studios.slice(0, 2).join(", ")}</span>
                </div>
              )}
              {anime.source_material && (
                <div className="bg-zinc-900/50 px-3.5 py-2 rounded-xl flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Source</span>
                  <span className="text-zinc-200 font-extrabold">{anime.source_material}</span>
                </div>
              )}
              {anime.episode_count && (
                <div className="bg-zinc-900/50 px-3.5 py-2 rounded-xl flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Episodes</span>
                  <span className="text-zinc-200 font-extrabold">{anime.episode_count} eps ({anime.episode_duration || "24"}m)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="mt-12 border-b border-zinc-900 flex gap-6 text-sm overflow-x-auto whitespace-nowrap">
          {["characters", "relations", "videos", "reviews", "recommendations"].map((t) => (
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

          {/* Tab 2: Characters */}
          {activeTab === "characters" && (
            <div>
              {characters.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-sm">No mapped character log entries found.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {characters.map((char) => (
                    <div
                      key={char.id}
                      className="flex items-center justify-between bg-zinc-900/40 border border-zinc-900 rounded-xl p-3 backdrop-blur-sm"
                    >
                      {/* Character Info */}
                      <div className="flex gap-3">
                        <div className="w-[60px] aspect-[3/4] rounded-lg overflow-hidden bg-zinc-950 flex-shrink-0">
                          {char.image_url ? (
                            <img
                              src={getProxiedImageUrl(char.image_url)}
                              alt={char.first_name}
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233f3f46'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
                              }}
                            />
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
                              <img
                                src={getProxiedImageUrl(char.voice_actor_image)}
                                alt={char.voice_actor_name}
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233f3f46'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
                                }}
                              />
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
          {activeTab === "relations" && (() => {
            const PRIORITY = new Set(["PREQUEL", "SEQUEL", "PARENT"]);
            const LABEL_MAP: Record<string, string> = {
              PREQUEL: "Prequel",
              SEQUEL: "Sequel",
              PARENT: "Parent Story",
              SIDE_STORY: "Side Story",
              SPIN_OFF: "Spin-off",
              ALTERNATIVE: "Alternative Version",
              CHARACTER: "Character Crossover",
              ADAPTATION: "Adaptation",
              COMPILATION: "Compilation",
              CONTAINS: "Contains",
              SUMMARY: "Summary",
              SOURCE: "Source Material",
              OTHER: "Other",
            };
            const COLOR_MAP: Record<string, string> = {
              PREQUEL: "text-violet-400",
              SEQUEL: "text-indigo-400",
              PARENT: "text-blue-400",
              SIDE_STORY: "text-emerald-400",
              SPIN_OFF: "text-teal-400",
              ALTERNATIVE: "text-sky-400",
              CHARACTER: "text-pink-400",
              ADAPTATION: "text-orange-400",
              COMPILATION: "text-amber-400",
              CONTAINS: "text-yellow-400",
              SUMMARY: "text-lime-400",
              SOURCE: "text-rose-400",
              OTHER: "text-zinc-400",
            };

            const featured = relations.filter(r => PRIORITY.has(r.relation_type));
            const rest = relations.filter(r => !PRIORITY.has(r.relation_type));

            // Group the rest by relation type
            const grouped: Record<string, typeof rest> = {};
            for (const rel of rest) {
              const key = rel.relation_type;
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(rel);
            }

            const renderCard = (rel: typeof relations[0], idx: number, large = false) => {
              const relTitle = rel.anime.title.english || rel.anime.title.romaji || rel.anime.title.native || "Unknown";
              // If local DB entry exists (id != anilist_id means it's local), link locally
              const isLocal = rel.anime.id !== rel.anime.anilist_id;
              const href = isLocal
                ? `/anime/${rel.anime.slug}-${rel.anime.id}`
                : `https://anilist.co/anime/${rel.anime.anilist_id}`;
              const target = isLocal ? undefined : "_blank";
              const labelColor = COLOR_MAP[rel.relation_type] || "text-zinc-400";
              const labelText = LABEL_MAP[rel.relation_type] || rel.relation_type.replace("_", " ");

              if (large) {
                return (
                  <a
                    key={idx}
                    href={href}
                    target={target}
                    rel={target ? "noopener noreferrer" : undefined}
                    className="group flex gap-5 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-4 hover:border-zinc-700 hover:-translate-y-0.5 transition-all duration-300 shadow-lg"
                  >
                    <div className="w-[80px] aspect-[3/4] rounded-xl overflow-hidden bg-zinc-950 flex-shrink-0 shadow-xl">
                      {rel.anime.cover_url ? (
                        <img src={rel.anime.cover_url} alt={relTitle} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                          <span className="text-zinc-700 text-xs text-center px-2">{relTitle.slice(0, 20)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col justify-center gap-1.5">
                      <span className={`text-[11px] uppercase font-extrabold tracking-widest ${labelColor}`}>{labelText}</span>
                      <span className="text-base font-bold text-zinc-100 line-clamp-2 group-hover:text-purple-300 transition-colors leading-snug">{relTitle}</span>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 flex-wrap">
                        {rel.anime.format && <span className="bg-zinc-800 px-2 py-0.5 rounded-full font-medium">{rel.anime.format}</span>}
                        {rel.anime.season_year && <span>{rel.anime.season_year}</span>}
                        {rel.anime.status && <span className="bg-zinc-800/50 px-2 py-0.5 rounded-full">{rel.anime.status.replace("_", " ")}</span>}
                        {rel.anime.average_score && (
                          <span className="text-yellow-400 font-semibold">{rel.anime.average_score}%</span>
                        )}
                      </div>
                    </div>
                  </a>
                );
              }

              return (
                <a
                  key={idx}
                  href={href}
                  target={target}
                  rel={target ? "noopener noreferrer" : undefined}
                  className="group flex gap-3.5 bg-zinc-900/25 border border-zinc-900/70 rounded-xl p-3 hover:border-zinc-800 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="w-[52px] aspect-[3/4] rounded-lg overflow-hidden bg-zinc-950 flex-shrink-0">
                    {rel.anime.cover_url ? (
                      <img src={rel.anime.cover_url} alt={relTitle} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                        <span className="text-zinc-700 text-[9px] text-center px-1">{relTitle.slice(0, 15)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center gap-0.5">
                    <span className="text-sm font-semibold text-zinc-200 line-clamp-2 group-hover:text-purple-400 transition-colors leading-snug">{relTitle}</span>
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 flex-wrap">
                      {rel.anime.format && <span>{rel.anime.format}</span>}
                      {rel.anime.season_year && <><span className="w-0.5 h-0.5 rounded-full bg-zinc-700" /><span>{rel.anime.season_year}</span></>}
                      {rel.anime.average_score && <><span className="w-0.5 h-0.5 rounded-full bg-zinc-700" /><span className="text-yellow-400 font-medium">{rel.anime.average_score}%</span></>}
                    </div>
                  </div>
                </a>
              );
            };

            return (
              <div className="space-y-8">
                {relations.length === 0 && (
                  <div className="text-center py-10 text-zinc-500 text-sm">No related titles found.</div>
                )}

                {/* Featured: Prequels, Sequels, Parent */}
                {featured.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Main Timeline</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {featured.map((rel, idx) => renderCard(rel, idx, true))}
                    </div>
                  </div>
                )}

                {/* All other groups */}
                {Object.entries(grouped).map(([type, items]) => (
                  <div key={type} className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                      {LABEL_MAP[type] || type.replace("_", " ")}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {items.map((rel, idx) => renderCard(rel, idx, false))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Tab 4: Videos */}
          {activeTab === "videos" && (
            <div>
              {loadingTabContent ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !anilistVideos.trailer && (!anilistVideos.streamingEpisodes || anilistVideos.streamingEpisodes.length === 0) && videos.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-sm">No official videos or trailers found for this anime.</div>
              ) : (
                <div className="space-y-8">
                  {/* Official Trailer & Promotional Videos */}
                  {anilistVideos.trailer && anilistVideos.trailer.site === "youtube" && (
                    <div>
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Official Trailer</h3>
                      <div
                        onClick={() => setActiveVideoId(anilistVideos.trailer.id)}
                        className="max-w-md cursor-pointer group flex flex-col bg-zinc-900/30 rounded-xl overflow-hidden hover:bg-zinc-900/60 transition-all duration-300 shadow-md"
                      >
                        <div className="aspect-video w-full bg-zinc-950 relative overflow-hidden">
                          <img
                            src={anilistVideos.trailer.thumbnail || `https://img.youtube.com/vi/${anilistVideos.trailer.id}/hqdefault.jpg`}
                            alt="Official Trailer"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/10 transition-all">
                            <div className="w-11 h-11 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                              <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </div>
                          <span className="absolute bottom-2 right-2 text-[10px] bg-black/80 px-2 py-0.5 rounded font-bold text-zinc-300">
                            YouTube PV
                          </span>
                        </div>
                        <div className="p-3 flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-zinc-200 group-hover:text-purple-400 transition-colors">
                            Official Trailer • {anime?.title?.english || anime?.title?.romaji}
                          </span>
                          <span className="text-[11px] text-zinc-500">Tap to play inside AniVerse</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Episodes, Clips & Official YouTube Content */}
                  {((anilistVideos.streamingEpisodes && anilistVideos.streamingEpisodes.length > 0) || videos.length > 0) && (
                    <div>
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Official Episodes & Clips</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {anilistVideos.streamingEpisodes.map((ep: any, idx: number) => (
                          <a
                            key={idx}
                            href={ep.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex flex-col bg-zinc-900/20 rounded-xl overflow-hidden hover:bg-zinc-900/50 transition-all"
                          >
                            <div className="aspect-video w-full bg-zinc-950 relative overflow-hidden">
                              {ep.thumbnail ? (
                                <img src={ep.thumbnail} alt={ep.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs font-semibold">Preview</div>
                              )}
                              <span className="absolute bottom-2 right-2 text-[10px] bg-black/80 text-zinc-300 px-2 py-0.5 rounded font-bold">
                                {ep.site || "Stream"}
                              </span>
                            </div>
                            <div className="p-2.5">
                              <span className="text-xs font-bold text-zinc-300 line-clamp-1 group-hover:text-purple-400 transition-colors">
                                {ep.title}
                              </span>
                            </div>
                          </a>
                        ))}
                        {videos.map((vid: any) => (
                          <div
                            key={vid.id}
                            onClick={() => setActiveVideoId(vid.provider_video_id)}
                            className="cursor-pointer group flex flex-col bg-zinc-900/20 rounded-xl overflow-hidden hover:bg-zinc-900/50 transition-all"
                          >
                            <div className="aspect-video w-full bg-zinc-950 relative overflow-hidden">
                              <img
                                src={vid.thumbnail_url || `https://img.youtube.com/vi/${vid.provider_video_id}/0.jpg`}
                                alt={vid.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-lg">
                                  <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                            <div className="p-2.5">
                              <span className="text-xs font-bold text-zinc-300 line-clamp-1 group-hover:text-purple-400 transition-colors">
                                {vid.title}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* YouTube Search Link for More Official PVs */}
                  {anime && (
                    <div className="pt-2">
                      <a
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent((anime.title.english || anime.title.romaji) + " official PV trailer")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900/40 hover:bg-zinc-900 text-xs font-semibold text-zinc-400 hover:text-purple-400 rounded-xl transition-all"
                      >
                        <svg className="w-4 h-4 fill-current text-red-500" viewBox="0 0 24 24">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                        </svg>
                        Search More Official PVs & Teasers on YouTube
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Reviews */}
          {activeTab === "reviews" && (
            <div>
              {loadingTabContent ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : anilistReviews.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-sm">No community reviews found for this title yet.</div>
              ) : (
                <div className="space-y-6">
                  {anilistReviews.map((rev: any) => (
                    <div key={rev.id} className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-6 flex flex-col gap-4 hover:border-zinc-850 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {rev.user?.avatar?.medium ? (
                            <img src={rev.user.avatar.medium} alt={rev.user.name} className="w-10 h-10 rounded-full object-cover border border-zinc-800" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-sm">
                              {rev.user?.name?.[0] || "?"}
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-bold text-zinc-200">{rev.user?.name || "Community Member"}</div>
                            <div className="text-[11px] text-zinc-500">
                              {new Date(rev.createdAt * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                        </div>
                        {rev.score && (
                          <div className="px-3 py-1 bg-purple-950/60 border border-purple-800/50 rounded-xl text-xs font-black text-purple-300">
                            {rev.score} / 100
                          </div>
                        )}
                      </div>
                      {rev.summary && (
                        <h4 className="text-sm font-bold text-zinc-200 italic">"{rev.summary}"</h4>
                      )}
                      <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-line line-clamp-6">
                        {rev.body}
                      </p>
                      {rev.ratingAmount > 0 && (
                        <div className="text-[11px] text-zinc-500 font-medium pt-2 border-t border-zinc-900/60">
                          {rev.rating} of {rev.ratingAmount} members found this review helpful
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 6: Recommendations */}
          {activeTab === "recommendations" && (
            <div>
              {loadingTabContent ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : anilistRecs.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-sm">No community recommendations available for this title.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                  {anilistRecs.map((item: any) => {
                    const rec = item.mediaRecommendation;
                    if (!rec) return null;
                    const recTitle = rec.title.english || rec.title.romaji || rec.title.native;
                    const cover = rec.coverImage?.large || rec.coverImage?.medium;
                    const rawSlug = (rec.title.romaji || rec.title.english || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `anime-${rec.id}`;

                    return (
                      <Link
                        key={item.id}
                        href={`/anime/${rawSlug}-${rec.id}`}
                        className="group bg-zinc-900/20 border border-zinc-900 hover:border-purple-500/50 rounded-2xl p-3 flex flex-col justify-between gap-3 transition-all duration-300"
                      >
                        <div className="space-y-2.5">
                          <div className="aspect-[3/4] rounded-xl overflow-hidden bg-zinc-950 relative">
                            {cover ? (
                              <img src={cover} alt={recTitle} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">No Cover</div>
                            )}
                            {item.rating > 0 && (
                              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-purple-600/90 backdrop-blur-md text-[10px] font-black text-white shadow-md">
                                +{item.rating} votes
                              </span>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-zinc-200 group-hover:text-purple-400 transition-colors line-clamp-1">
                              {recTitle}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-1 font-medium">
                              {rec.format && <span>{rec.format}</span>}
                              {rec.seasonYear && <span>• {rec.seasonYear}</span>}
                              {rec.averageScore && <span className="text-purple-400 font-bold">• {rec.averageScore}%</span>}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </main>

      {/* Modal Video Player */}
      {activeVideoId && (
        <div 
          onClick={() => setActiveVideoId(null)}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 md:p-6"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative"
          >
            <button
              onClick={() => setActiveVideoId(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/80 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center text-lg font-bold transition-all"
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

