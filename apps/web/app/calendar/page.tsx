"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { fetchWithCredentials, getApiUrl } from "@/lib/auth";

interface AiringEvent {
  anime_id: number;
  anime_title: string;
  cover_url?: string;
  episode_number: number;
  airing_at: string;
  countdown_seconds: number;
  trailer_url?: string;
  season?: string;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<AiringEvent[]>([]);
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "monthly" | "personal">("weekly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Modal Trailer ID state
  const [activeTrailerId, setActiveTrailerId] = useState<string | null>(null);

  const checkUser = async () => {
    try {
      const res = await fetchWithCredentials(getApiUrl("/auth/me"));
      if (res.ok) setCurrentUser(await res.json());
    } catch (_) {}
  };

  const fetchCalendarEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const start = new Date();
      let end = new Date();

      if (viewMode === "daily") {
        end.setDate(start.getDate() + 1);
      } else if (viewMode === "weekly") {
        end.setDate(start.getDate() + 7);
      } else if (viewMode === "monthly") {
        end.setDate(start.getDate() + 30);
      } else if (viewMode === "personal") {
        end.setDate(start.getDate() + 14); // 2 weeks window for personal calendar
      }

      const formatDate = (d: Date) => d.toISOString().split("T")[0];

      const params = new URLSearchParams();
      params.append("start_date", formatDate(start));
      params.append("end_date", formatDate(end));
      if (viewMode === "personal") {
        params.append("my_calendar_only", "true");
      }

      const url = getApiUrl(`/calendar/airing?${params.toString()}`);
      const res = viewMode === "personal"
        ? await fetchWithCredentials(url)
        : await fetch(url);

      if (res.ok) {
        setEvents(await res.json());
      } else {
        if (res.status === 401 && viewMode === "personal") {
          setError("Please log in to view your personalized calendar.");
        } else {
          setError("Failed to retrieve schedule events.");
        }
      }
    } catch (_) {
      setError("Failed to fetch release schedule.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    fetchCalendarEvents();
  }, [viewMode]);

  // Group events by day
  const groupEventsByDay = () => {
    const days: Record<string, AiringEvent[]> = {};
    events.forEach((ev) => {
      const dateStr = new Date(ev.airing_at).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      days[dateStr] = days[dateStr] || [];
      days[dateStr].push(ev);
    });
    return days;
  };

  const grouped = groupEventsByDay();

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getCountdownText = (seconds: number) => {
    if (seconds <= 0) return "Airing Now";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 24) {
      const days = Math.floor(hrs / 24);
      return `In ${days} day${days > 1 ? "s" : ""}`;
    }
    return `In ${hrs}h ${mins}m`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden pb-20">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-10 relative z-10 space-y-8">
        
        {/* Title and views navigation */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-6 border-b border-zinc-900/50 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              Release Calendar
            </h1>
            <p className="text-zinc-400 mt-2">Track upcoming episodes schedule and count down premieres.</p>
          </div>

          <div className="flex flex-wrap gap-2 bg-zinc-900/40 p-1.5 rounded-xl border border-zinc-800 backdrop-blur-md">
            {[
              { id: "daily", label: "Daily" },
              { id: "weekly", label: "Weekly" },
              { id: "monthly", label: "Monthly" },
              { id: "personal", label: "My Calendar" }
            ].map((view) => (
              <button
                key={view.id}
                onClick={() => setViewMode(view.id as any)}
                className={`text-xs px-4 py-2 rounded-lg font-bold transition-all ${
                  viewMode === view.id
                    ? "bg-purple-600 text-white shadow-md shadow-purple-950/20"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar schedule container */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-400 text-sm font-medium font-mono">Aligning airing timelines...</p>
          </div>
        ) : error ? (
          <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-8 text-center text-red-400">
            <p className="font-bold text-lg">Calendar Blocked</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-16 text-center text-zinc-500">
            <svg className="w-12 h-12 text-zinc-650 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-zinc-350 font-bold text-lg">No Airing Events Found</p>
            <p className="text-xs text-zinc-600 mt-1 max-w-sm mx-auto">
              There are no episode releases scheduled in this timeframe. Try adding anime to your list or following them to populate "My Calendar".
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([day, dayEvents]) => (
              <div key={day} className="space-y-4">
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest pl-2 border-l-2 border-l-purple-500">
                  {day}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dayEvents.map((ev) => (
                    <div
                      key={`${ev.anime_id}-${ev.episode_number}`}
                      className="flex bg-zinc-900/30 border border-zinc-900 hover:border-zinc-800 rounded-2xl p-4 transition-all group"
                    >
                      {/* Image cover */}
                      <Link
                        href={`/anime/slug-${ev.anime_id}`}
                        className="w-16 md:w-20 aspect-[3/4] bg-zinc-950 rounded-xl overflow-hidden shadow-md flex-shrink-0"
                      >
                        {ev.cover_url ? (
                          <img src={ev.cover_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" />
                        ) : (
                          <div className="w-full h-full bg-zinc-850 flex items-center justify-center text-[10px]">No Cover</div>
                        )}
                      </Link>

                      {/* Info body */}
                      <div className="ml-4 flex-grow flex flex-col justify-between min-w-0">
                        <div>
                          <Link
                            href={`/anime/slug-${ev.anime_id}`}
                            className="text-sm font-bold text-zinc-200 line-clamp-1 group-hover:text-purple-400 transition-colors"
                          >
                            {ev.anime_title}
                          </Link>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-850 border border-zinc-800 text-zinc-400 font-bold">
                              Episode {ev.episode_number}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-medium">
                              {formatTime(ev.airing_at)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-850/60">
                          <span className="text-[10px] font-black text-purple-400 uppercase tracking-wide">
                            {getCountdownText(ev.countdown_seconds)}
                          </span>

                          {ev.trailer_url && (
                            <button
                              onClick={() => setActiveTrailerId(ev.trailer_url || null)}
                              className="text-[9px] font-bold text-zinc-400 hover:text-zinc-200 transition-all flex items-center gap-1"
                            >
                              🎬 Watch Trailer
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Trailer Modal Player overlay */}
      {activeTrailerId && (
        <div
          onClick={() => setActiveTrailerId(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl aspect-video bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl relative"
          >
            <button
              onClick={() => setActiveTrailerId(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/60 hover:bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center text-xl font-bold transition-all border border-zinc-800"
            >
              ×
            </button>
            <iframe
              src={`https://www.youtube.com/embed/${activeTrailerId}?autoplay=1`}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

    </div>
  );
}
