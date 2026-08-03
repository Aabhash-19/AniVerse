"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { getApiUrl, fetchWithCredentials } from "@/lib/auth";

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
  season_year: number;
  season: string;
  average_score?: number;
  genres: string[];
}

export default function UpcomingPage() {
  const [animeList, setAnimeList] = useState<AnimeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [season, setSeason] = useState("");
  const [year, setYear] = useState("");
  const [tbaOnly, setTbaOnly] = useState(false);
  const [format, setFormat] = useState("");
  const [genre, setGenre] = useState("");
  const [sort, setSort] = useState("popularity");

  const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const years = ["2026", "2027", "2028"];
  const formats = ["TV", "MOVIE", "OVA", "ONA", "SPECIAL"];
  const genres = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Mystery", "Psychological", "Sci-Fi", "Thriller", "Romance", "Slice of Life"];

  const [featuredIndex, setFeaturedIndex] = useState(0);

  const fetchUpcomingList = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.append("status", "NOT_YET_RELEASED");
      if (season) params.append("season", season);
      if (tbaOnly) {
        params.append("tba_only", "true");
      } else if (year) {
        params.append("year", year);
      }
      if (format) params.append("format", format);
      if (genre) params.append("genre", genre);
      if (sort) params.append("sort", sort);
      params.append("limit", "50");

      const res = await fetchWithCredentials(getApiUrl(`/anime?${params.toString()}`));
      if (res.ok) {
        setAnimeList(await res.json());
        setFeaturedIndex(0);
      } else {
        setError("Failed to fetch upcoming releases catalog.");
      }
    } catch (_) {
      setError("Error reaching backend service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpcomingList();
  }, [season, year, tbaOnly, format, genre, sort]);

  const handleNextFeatured = () => {
    if (animeList.length === 0) return;
    setFeaturedIndex((prev) => (prev + 1) % animeList.length);
  };

  const handlePrevFeatured = () => {
    if (animeList.length === 0) return;
    setFeaturedIndex((prev) => (prev - 1 + animeList.length) % animeList.length);
  };

  const handleRandomFeatured = () => {
    if (animeList.length === 0) return;
    const rand = Math.floor(Math.random() * animeList.length);
    setFeaturedIndex(rand);
  };

  const featured = animeList.length > 0 ? animeList[featuredIndex % animeList.length] : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden pb-20">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-10 relative z-10 space-y-8">
        
        {/* Title row */}
        <div className="border-b border-zinc-900/50 pb-6">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Upcoming Premieres & Announced Series
          </h1>
          <p className="text-zinc-400 mt-2">Explore unreleased anime titles, movies, and upcoming seasonal broadcasts.</p>
        </div>

        {/* Nami's Horizon Radar Banner */}
        <div className="bg-gradient-to-r from-zinc-900 via-amber-950/20 to-zinc-900 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
          <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-amber-500 shadow-md flex-shrink-0 bg-purple-950">
            <img
              src="/nami-wano-avatar.jpg"
              alt="Nami Navigator"
              className="w-full h-full object-cover scale-110 transition-transform duration-300"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-xs font-black text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
              Nami's Horizon Radar
            </div>
            <p className="text-xs text-zinc-300 font-medium mt-0.5 truncate">
              "Chart upcoming premieres and seasonal broadcasts heading into next season across the Grand Line!"
            </p>
          </div>
        </div>


        {/* FEATURED UPCOMING SPOTLIGHT HERO BANNER WITH CAROUSEL CONTROLS */}
        {featured && !loading && (
          <div className="relative rounded-3xl overflow-hidden border border-purple-500/30 bg-gradient-to-r from-zinc-950 via-zinc-950/90 to-purple-950/40 p-6 md:p-8 backdrop-blur-md shadow-2xl shadow-purple-950/20 group transition-all duration-500">
            <div key={featured.id} className="absolute inset-0 bg-cover bg-center opacity-15 group-hover:scale-105 transition-all duration-700 pointer-events-none" style={{ backgroundImage: `url(${featured.cover_url})` }} />
            
            {/* Carousel Navigation Arrows & Shuffle Bar */}
            <div className="relative z-20 flex items-center justify-between gap-2 mb-4 pb-3 border-b border-zinc-900/80">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                  <span>Featured Premiere Spotlight</span>
                </span>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevFeatured}
                  title="Previous Spotlight"
                  className="px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition-all shadow-md active:scale-95 flex items-center gap-1"
                >
                  <span>←</span>
                  <span className="hidden sm:inline">Prev</span>
                </button>

                <button
                  onClick={handleRandomFeatured}
                  title="Discover Random Premiere"
                  className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-xs font-bold text-purple-300 hover:text-purple-200 transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                >
                  <span>Shuffle</span>
                </button>

                <button
                  onClick={handleNextFeatured}
                  title="Next Spotlight"
                  className="px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition-all shadow-md active:scale-95 flex items-center gap-1"
                >
                  <span className="hidden sm:inline">Next</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
              
              {/* Cover thumbnail */}
              <Link href={`/anime/${featured.slug}-${featured.id}`} className="w-28 md:w-36 aspect-[3/4] bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 border border-zinc-800 relative group/thumb">
                {featured.cover_url ? (
                  <img src={featured.cover_url} alt="" className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600">No Cover</div>
                )}
                {featured.format && (
                  <span className="absolute bottom-2 left-2 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-zinc-950/90 border border-zinc-800 text-zinc-300">
                    {featured.format}
                  </span>
                )}
              </Link>

              {/* Info details */}
              <div className="flex-grow flex flex-col justify-between space-y-4 text-center md:text-left">
                <div>
                  <Link href={`/anime/${featured.slug}-${featured.id}`}>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-white hover:text-purple-400 transition-colors line-clamp-1">
                      {featured.title.english || featured.title.romaji || featured.title.native}
                    </h2>
                  </Link>

                  <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mt-1.5 flex items-center justify-center md:justify-start gap-1">
                    <span>Premiere Target:</span>
                    <span>{featured.season || "SEASON"} {featured.season_year || "TBA"}</span>
                  </p>
                </div>

                {/* Genres */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5">
                  {featured.genres.map((g) => (
                    <span key={g} className="text-[11px] px-2.5 py-0.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-zinc-300">
                      {g}
                    </span>
                  ))}
                </div>

                {/* Explore button */}
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <Link
                    href={`/anime/${featured.slug}-${featured.id}`}
                    className="inline-flex items-center gap-2 text-xs font-bold px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-950/40 transition-all hover:scale-[1.02]"
                  >
                    <span>View Premiere Details</span>
                    <span>→</span>
                  </Link>

                  <button
                    onClick={handleRandomFeatured}
                    className="text-xs font-bold px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
                  >
                    Discover Another
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Filters & Control Block */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 backdrop-blur-md">
          
          {/* Season Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Season</label>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-purple-500"
            >
              <option value="">All Seasons</option>
              {seasons.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Year</label>
            <select
              value={tbaOnly ? "tba" : year}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "tba") {
                  setYear("");
                  setTbaOnly(true);
                } else {
                  setYear(val);
                  setTbaOnly(false);
                }
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-purple-500"
            >
              <option value="">All Years</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
              <option value="tba">TBA</option>
            </select>
          </div>

          {/* Format Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-purple-500"
            >
              <option value="">All Formats</option>
              {formats.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Genre Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Genre</label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-purple-500"
            >
              <option value="">All Genres</option>
              {genres.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Sort Filter */}
          <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Sort</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-purple-500"
            >
              <option value="popularity">Popularity</option>
              <option value="title">Title (A-Z)</option>
            </select>
          </div>

        </div>

        {/* Grid content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-400 text-sm font-medium">Scanning premiere logs from AniList...</p>
          </div>
        ) : error ? (
          <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-6 text-center text-red-400">{error}</div>
        ) : animeList.length === 0 ? (
          <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-16 text-center text-zinc-500">
            <p className="font-bold text-lg text-zinc-300">No Matching Upcoming Premieres</p>
            <p className="text-xs text-zinc-500 mt-1">Try broadening your season, year, or genre filters.</p>
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

                    {/* Announced Badge */}
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-purple-600/90 backdrop-blur-sm border border-purple-500/30 text-[10px] font-black text-white uppercase tracking-wider">
                      Announced
                    </div>

                    {anime.format && (
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-zinc-950/80 backdrop-blur-sm border border-zinc-800 text-[10px] font-bold text-zinc-400">
                        {anime.format}
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 flex flex-col flex-grow justify-between space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold line-clamp-2 text-zinc-200 group-hover:text-purple-400 transition-colors">
                        {displayTitle}
                      </h3>
                      <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1">
                        <span>{anime.season || "PREMIERE"} {anime.season_year || "TBA"}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {anime.genres.slice(0, 2).map((g) => (
                        <span key={g} className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-950/80 border border-zinc-900 text-zinc-400">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
