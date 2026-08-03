"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { getApiUrl } from "@/lib/auth";

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

  const [genre, setGenre] = useState("");
  const [sort, setSort] = useState("popularity"); // popularity, score, title

  const genres = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Mystery", "Psychological", "Sci-Fi", "Thriller", "Romance"];

  const fetchUpcomingList = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.append("status", "NOT_YET_RELEASED");
      if (genre) params.append("genre", genre);
      if (sort) params.append("sort", sort);

      const res = await fetch(getApiUrl(`/anime?${params.toString()}`));
      if (res.ok) {
        setAnimeList(await res.json());
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
  }, [genre, sort]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden pb-20">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-10 relative z-10 space-y-8">
        
        {/* Title row */}
        <div className="border-b border-zinc-900/50 pb-6">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Upcoming Premieres
          </h1>
          <p className="text-zinc-400 mt-2">Browse upcoming seasons, movies, OVAs, ONAs, and sequels.</p>
        </div>

        {/* Filters control block */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 backdrop-blur-md">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Genre</label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-purple-500 w-full sm:w-44"
            >
              <option value="">All Genres</option>
              {genres.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Sort by:</span>
            <div className="flex gap-2">
              {[
                { id: "popularity", label: "Popularity" },
                { id: "score", label: "Score" },
                { id: "title", label: "Title" }
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSort(s.id)}
                  className={`text-xs px-3.5 py-1.5 rounded-full border transition-all ${
                    sort === s.id
                      ? "bg-purple-500/10 border-purple-500/50 text-purple-400 font-bold"
                      : "border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-400 text-sm font-medium">Scanning premiere logs...</p>
          </div>
        ) : error ? (
          <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-6 text-center text-red-400">{error}</div>
        ) : animeList.length === 0 ? (
          <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-16 text-center text-zinc-500">
            <p className="font-bold text-lg">No Upcoming Entries</p>
            <p className="text-xs text-zinc-650 mt-1">We couldn't locate any matching upcoming titles.</p>
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
                      <img src={anime.cover_url} alt={displayTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">No Cover</div>
                    )}

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
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">
                        {anime.season || "PREMIERE"} {anime.season_year || "TBA"}
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
