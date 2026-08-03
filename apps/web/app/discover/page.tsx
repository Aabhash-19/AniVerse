"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { fetchWithCredentials, getApiUrl } from "@/lib/auth";

interface AnimeSummary {
  id: number;
  slug: string;
  title: {
    english: string;
    romaji: string;
    native: string;
  };
  cover_url: string;
  format: string;
  status: string;
  average_score?: number;
  similarity?: number;
  genres?: string[];
}

interface RecommendationItem {
  id: number;
  slug: string;
  title: {
    english: string;
    romaji: string;
    native: string;
  };
  cover_url?: string;
  format?: string;
  status?: string;
  average_score?: number;
  score: number;
  reasons: string[];
}

export default function DiscoverPage() {
  const [animeList, setAnimeList] = useState<AnimeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & Filter states
  const [search, setSearch] = useState("");
  const [latency, setLatency] = useState<number | null>(null);

  // Filters state
  const [genre, setGenre] = useState("");
  const [season, setSeason] = useState("");
  const [format, setFormat] = useState("");
  const [sort, setSort] = useState("popularity");
  const [syncLoading, setSyncLoading] = useState(false);

  // Pagination & Infinite Scroll states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerTarget = React.useRef<HTMLDivElement>(null);

  // Recommendations state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const genres = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Mystery", "Psychological", "Sci-Fi", "Thriller", "Romance"];
  const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const formats = ["TV", "MOVIE", "OVA", "ONA", "SPECIAL"];

  // Authenticate user & load recommendations
  const checkUserAndRecs = async () => {
    try {
      const res = await fetchWithCredentials(getApiUrl("/auth/me"));
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        fetchRecommendations();
      }
    } catch (_) {}
  };

  const fetchRecommendations = async () => {
    setLoadingRecs(true);
    try {
      const res = await fetchWithCredentials(getApiUrl("/recommendations/home?limit=5"));
      if (res.ok) {
        setRecommendations(await res.json());
      }
    } finally {
      setLoadingRecs(false);
    }
  };

  const handleRecommendationFeedback = async (animeId: number, feedbackType: "INTERESTED" | "NOT_INTERESTED") => {
    try {
      const res = await fetchWithCredentials(getApiUrl(`/recommendations/${animeId}/feedback`), {
        method: "POST",
        body: JSON.stringify({ feedback_type: feedbackType }),
      });
      if (res.ok) {
        setRecommendations((prev) => prev.filter((r) => r.id !== animeId));
        alert(feedbackType === "INTERESTED" ? "Added to your profile preferences! 👍" : "Hiding this suggestion. 👎");
      }
    } catch (_) {}
  };

  const fetchCatalog = async (pageNum = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setPage(1);
      setHasMore(true);
    }
    setError("");
    setLatency(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      if (genre) params.append("genre", genre);
      if (season) params.append("season", season);
      if (format) params.append("format", format);
      if (sort) params.append("sort", sort);
      params.append("page", pageNum.toString());
      params.append("limit", "20");

      const url = getApiUrl(`/anime?${params.toString()}`);
      let response = await fetch(url);
      if (!response.ok) {
        if (response.status === 429) {
          await new Promise((r) => setTimeout(r, 1200));
          response = await fetch(url);
        } else {
          await new Promise((r) => setTimeout(r, 600));
          response = await fetch(url);
        }
      }
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Rate limit reached — please wait a moment before searching again.");
        }
        throw new Error("Failed to fetch catalog from backend");
      }
      const data = await response.json();
      const items = Array.isArray(data) ? data : (data.items || []);

      if (append) {
        setAnimeList((prev) => [...prev, ...items]);
      } else {
        setAnimeList(items);
      }

      if (items.length < 20) {
        setHasMore(false);
      }

      if (data.latency_ms) setLatency(data.latency_ms);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading catalogue.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };



  useEffect(() => {
    checkUserAndRecs();
  }, []);

  useEffect(() => {
    if (!search) {
      fetchCatalog(1, false);
    }
  }, [genre, season, format, sort]);

  // Infinite Scroll IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && !search) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchCatalog(nextPage, true);
        }
      },
      { threshold: 0.5 }
    );

    const target = observerTarget.current;
    if (target) observer.observe(target);

    return () => {
      if (target) observer.unobserve(target);
    };
  }, [page, hasMore, loading, loadingMore, search, genre, season, format, sort]);


  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCatalog();
  };

  const handleTriggerSync = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch(getApiUrl("/admin/catalogue/sync?limit=40"), { method: "POST" });
      if (!res.ok) throw new Error("Sync failed to trigger");
      setTimeout(() => {
        fetchCatalog();
        setSyncLoading(false);
      }, 5000);
    } catch (err: any) {
      alert("Error starting catalogue sync: " + err.message);
      setSyncLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
      <Header />

      <main id="main-content" role="main" className="max-w-7xl mx-auto px-6 py-10 relative z-10 space-y-10">
        
        {/* Title row */}
        <div className="border-b border-zinc-900/50 pb-6">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Discovery Engine
          </h1>
          <p className="text-zinc-400 mt-2">Filter and browse the official verified anime database.</p>
        </div>

        {/* Personalized Recommendations Section */}
        {currentUser && recommendations.length > 0 && (
          <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-200">Recommended for You</h2>
                <p className="text-xs text-zinc-500 mt-1">Based on watchlist ratings, genre preferences, and engagement.</p>
              </div>
              <button onClick={fetchRecommendations} className="text-xs text-purple-400 hover:text-purple-300 font-bold transition-all">Refresh ↺</button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              {recommendations.map((rec) => {
                const recTitle = rec.title.english || rec.title.romaji || rec.title.native;
                return (
                  <div key={rec.id} className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-3 flex flex-col justify-between space-y-3 group hover:border-zinc-800 transition-all">
                    <Link href={`/anime/${rec.slug}-${rec.id}`} className="space-y-2">
                      <div className="aspect-[3/4] rounded-lg overflow-hidden bg-zinc-900 relative">
                        {rec.cover_url ? (
                          <img src={rec.cover_url} alt={recTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">No Cover</div>
                        )}
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-purple-600 text-[10px] font-black text-white">
                          {(rec.score * 100).toFixed(0)}% Match
                        </span>
                      </div>
                      <p className="text-xs font-bold text-zinc-200 line-clamp-1 group-hover:text-purple-400 transition-colors">{recTitle}</p>
                    </Link>
                    
                    {/* Reason block */}
                    {rec.reasons.length > 0 && (
                      <p className="text-[10px] text-zinc-500 italic leading-tight">✓ {rec.reasons[0]}</p>
                    )}

                    {/* Feedback Buttons */}
                    <div className="flex gap-2 pt-1 border-t border-zinc-900/60">
                      <button 
                        onClick={() => handleRecommendationFeedback(rec.id, "INTERESTED")}
                        className="text-[10px] font-bold text-zinc-400 hover:text-green-400 bg-zinc-900 hover:bg-green-500/10 border border-zinc-800 px-2 py-1 rounded flex-1 text-center transition-all"
                      >
                        👍 Yes
                      </button>
                      <button 
                        onClick={() => handleRecommendationFeedback(rec.id, "NOT_INTERESTED")}
                        className="text-[10px] font-bold text-zinc-400 hover:text-red-400 bg-zinc-900 hover:bg-red-500/10 border border-zinc-800 px-2 py-1 rounded flex-1 text-center transition-all"
                      >
                        👎 No
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Unified Search Filters */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-6">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-8 flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Search Catalogue
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. Attack on Titan, Solo Leveling, Bleach..."
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 text-zinc-200 transition-all"
              />
            </div>

            <div className="md:col-span-2 flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Genre</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 text-zinc-300"
              >
                <option value="">All Genres</option>
                {genres.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div className="md:col-span-2 flex flex-col gap-2">
              <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-all shadow-lg">
                Search
              </button>
            </div>
          </form>

          {/* Catalogue Filters Row */}
          <div className="pt-4 border-t border-zinc-850/50 flex flex-wrap gap-4 items-center justify-between">

              <div className="flex flex-wrap gap-4 items-center">
                <select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-purple-500"
                >
                  <option value="">All Seasons</option>
                  {seasons.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-purple-500"
                >
                  <option value="">All Formats</option>
                  {formats.map(f => <option key={f} value={f}>{f}</option>)}
                </select>

                <span className="text-xs font-bold text-zinc-600 uppercase">Sort:</span>
                <div className="flex gap-2">
                  {["popularity", "score", "title"].map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setSort(s)}
                      className={`text-xs px-3 py-1 rounded-full border transition-all ${
                        sort === s 
                          ? "bg-purple-500/10 border-purple-500/50 text-purple-400 font-medium"
                          : "border-zinc-800 text-zinc-400 hover:text-zinc-300"
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {latency != null && (
                <span className="text-xs font-mono text-zinc-500">Query processed in {latency.toFixed(1)}ms</span>
              )}
            </div>
        </div>



        {/* Catalog Grid Results */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-400 text-sm font-medium">Scanning discovery matrix...</p>
          </div>
        ) : error ? (
          <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-6 text-center text-red-400">
            <p className="font-semibold">Search Failure</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : animeList.length === 0 ? (
          <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-16 text-center">
            <svg className="w-12 h-12 text-zinc-650 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-zinc-300 font-bold text-lg">No matches found</p>
            <p className="text-sm text-zinc-650 mt-1 max-w-sm mx-auto">
              We couldn't retrieve matching entries for your query. Try broadening your terms or seeding the database.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {animeList.map((anime) => {
              const displayTitle = anime.title.english || anime.title.romaji || anime.title.native;
              return (
                <Link
                  key={anime.id}
                  href={`/anime/${anime.slug}-${anime.id}`}
                  className="group flex flex-col bg-zinc-900/30 border border-zinc-900 hover:border-zinc-800 rounded-xl overflow-hidden hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-950/20 transition-all duration-300"
                >
                  <div className="relative aspect-[3/4] bg-zinc-950 overflow-hidden">
                    {anime.cover_url ? (
                      <img src={anime.cover_url} alt={displayTitle} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">No Cover</div>
                    )}
                    
                    {/* Nami's Log Pose Choice badge for top rated shows */}
                    {anime.average_score && anime.average_score >= 84 && (
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-amber-500/90 backdrop-blur-md text-[9px] font-extrabold text-zinc-950 shadow-md flex items-center gap-1">
                        Nami's Pick 🍊
                      </div>
                    )}

                    {/* Score badge / Similarity match */}
                    {anime.similarity != null ? (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-purple-600/90 backdrop-blur-sm border border-purple-500/20 text-xs font-bold text-white">
                        {(anime.similarity * 100).toFixed(0)}% Match
                      </div>
                    ) : anime.average_score ? (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-zinc-950/80 backdrop-blur-sm border border-zinc-800 text-xs font-bold text-yellow-500">
                        ⭐ {anime.average_score}%
                      </div>
                    ) : null}


                    {anime.format && (
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-zinc-950/80 backdrop-blur-sm border border-zinc-800 text-[10px] font-bold text-zinc-400">
                        {anime.format}
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 flex flex-col flex-grow justify-between space-y-2">
                    <div>
                      <h3 className="text-sm font-semibold line-clamp-2 text-zinc-200 group-hover:text-purple-400 transition-colors">
                        {displayTitle}
                      </h3>
                      {anime.status && (
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">{anime.status.replace(/_/g, " ")}</p>
                      )}

                    </div>
                    
                    {anime.genres && anime.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {anime.genres.slice(0, 2).map((g) => (
                          <span key={g} className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-950/80 border border-zinc-900 text-zinc-400">
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Infinite Scroll Sentinel Target & Loader */}
        <div ref={observerTarget} className="py-8 text-center flex flex-col items-center justify-center gap-2">
          {loadingMore && (
            <div className="flex items-center gap-3 text-purple-400 font-bold text-sm bg-zinc-900/60 px-5 py-2.5 rounded-full border border-purple-500/20 shadow-lg">
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              <span>Loading more anime from catalogue...</span>
            </div>
          )}
          {!hasMore && animeList.length > 0 && (
            <p className="text-xs text-zinc-600 font-semibold uppercase tracking-widest">
              ✓ All items loaded from catalogue
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
