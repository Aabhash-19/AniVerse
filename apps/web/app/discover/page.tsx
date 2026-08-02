"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";

interface AnimeSummary {
  id: number;
  anilist_id: number;
  slug: string;
  title: {
    english: string;
    romaji: string;
    native: string;
  };
  cover_url: string;
  format: string;
  status: string;
  season: string;
  season_year: number;
  episode_count: number;
  average_score: number;
  genres: string[];
}

export default function DiscoverPage() {
  const [animeList, setAnimeList] = useState<AnimeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters state
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [season, setSeason] = useState("");
  const [format, setFormat] = useState("");
  const [sort, setSort] = useState("popularity");
  const [syncLoading, setSyncLoading] = useState(false);

  // Available option arrays
  const genres = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Mystery", "Psychological", "Sci-Fi", "Thriller", "Romance"];
  const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const formats = ["TV", "MOVIE", "OVA", "ONA", "SPECIAL"];

  const fetchCatalog = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (genre) params.append("genre", genre);
      if (season) params.append("season", season);
      if (format) params.append("format", format);
      if (sort) params.append("sort", sort);
      
      const response = await fetch(`http://localhost:8000/api/v1/anime?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch catalog from backend");
      }
      const data = await response.json();
      setAnimeList(data);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading catalogue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [genre, season, format, sort]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCatalog();
  };

  const handleTriggerSync = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/catalogue/sync?limit=40", {
        method: "POST"
      });
      if (!res.ok) throw new Error("Sync failed to trigger");
      
      // Wait a moment and fetch catalog
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
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />

      <Header />

      <main className="max-w-7xl mx-auto px-6 py-10 relative z-10">
        {/* Title */}
        <div className="mb-10 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              Discovery Engine
            </h1>
            <p className="text-zinc-400 mt-2">Filter and browse the official verified anime database.</p>
          </div>
          <button 
            onClick={handleTriggerSync}
            disabled={syncLoading}
            className="text-xs self-start sm:self-center px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all font-semibold shadow-lg shadow-purple-900/20 disabled:opacity-50"
          >
            {syncLoading ? "Syncing..." : "Seed Catalogue"}
          </button>
        </div>

        {/* Filters Panel */}
        <form onSubmit={handleSearchSubmit} className="bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md rounded-2xl p-6 mb-10 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Search Input */}
            <div className="md:col-span-4 flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Attack on Titan, AOT..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 text-zinc-200 transition-all"
                />
              </div>
            </div>

            {/* Genre Dropdown */}
            <div className="md:col-span-2 flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Genre</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 text-zinc-300 transition-all"
              >
                <option value="">All Genres</option>
                {genres.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* Season Dropdown */}
            <div className="md:col-span-2 flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Season</label>
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 text-zinc-300 transition-all"
              >
                <option value="">All Seasons</option>
                {seasons.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Format Dropdown */}
            <div className="md:col-span-2 flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 text-zinc-300 transition-all"
              >
                <option value="">All Formats</option>
                {formats.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="md:col-span-2 flex flex-col gap-2">
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-all shadow-lg shadow-purple-950/30"
              >
                Apply Filters
              </button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-800/50 flex gap-4 items-center">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Sort by:</span>
            <div className="flex gap-2">
              {["popularity", "score", "title"].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSort(s)}
                  className={`text-xs px-3 py-1 rounded-full transition-all border ${
                    sort === s
                      ? "bg-purple-500/10 border-purple-500/50 text-purple-400 font-medium"
                      : "border-zinc-800 text-zinc-400 hover:text-zinc-300 hover:border-zinc-700"
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Catalog Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-400 text-sm font-medium">Scanning catalog archives...</p>
          </div>
        ) : error ? (
          <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-6 text-center text-red-400">
            <p className="font-semibold">Error occurred</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : animeList.length === 0 ? (
          <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-16 text-center">
            <svg className="w-12 h-12 text-zinc-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-zinc-300 font-semibold text-lg">No Anime entries found</p>
            <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
              The database is currently empty. Click the seed button in the navigation bar to import popular entries from AniList!
            </p>
            <button
              onClick={handleTriggerSync}
              disabled={syncLoading}
              className="mt-6 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition-all border border-zinc-700"
            >
              {syncLoading ? "Ingesting..." : "Trigger Seed Ingestion"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {animeList.map((anime) => {
              const displayTitle = anime.title.english || anime.title.romaji || anime.title.native;
              return (
                <Link
                  key={anime.id}
                  href={`/anime/${anime.slug}-${anime.id}`}
                  className="group flex flex-col bg-zinc-900/30 border border-zinc-900 rounded-xl overflow-hidden hover:border-zinc-800 hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-950/20 transition-all duration-300"
                >
                  {/* Poster Image */}
                  <div className="relative aspect-[3/4] overflow-hidden bg-zinc-950">
                    {anime.cover_url ? (
                      <img
                        src={anime.cover_url}
                        alt={displayTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">No Cover</div>
                    )}
                    {/* Score overlay */}
                    {anime.average_score && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-zinc-950/80 backdrop-blur-sm border border-zinc-800 text-xs font-bold text-yellow-500">
                        ⭐ {anime.average_score}%
                      </div>
                    )}
                    {/* Format tag */}
                    {anime.format && (
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-zinc-950/80 backdrop-blur-sm border border-zinc-800 text-[10px] font-bold text-zinc-400">
                        {anime.format}
                      </div>
                    )}
                  </div>

                  {/* Body Info */}
                  <div className="p-3.5 flex flex-col flex-grow">
                    <h3 className="text-sm font-semibold line-clamp-2 text-zinc-200 group-hover:text-purple-400 transition-colors">
                      {displayTitle}
                    </h3>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                      <span>{anime.season_year || "Unknown"}</span>
                      {anime.episode_count && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-zinc-700" />
                          <span>{anime.episode_count} eps</span>
                        </>
                      )}
                    </div>
                    {/* Genres */}
                    <div className="mt-2.5 flex flex-wrap gap-1">
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
