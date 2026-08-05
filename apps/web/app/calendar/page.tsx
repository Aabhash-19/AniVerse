"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  format?: string;
  audio_type?: string;
}

interface UserActivityEvent {
  id: string;
  anime_id: number;
  anime_title: string;
  cover_url?: string;
  slug: string;
  action_type: string;
  description: string;
  timestamp: string;
  progress?: number;
  status?: string;
  score?: number;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<AiringEvent[]>([]);
  const [userActivities, setUserActivities] = useState<UserActivityEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list" | "personal">("calendar");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Modal Trailer ID state
  const [activeTrailerId, setActiveTrailerId] = useState<string | null>(null);

  const checkUser = async () => {
    try {
      const res = await fetchWithCredentials(getApiUrl("/auth/me"));
      if (res.ok) {
        const u = await res.json();
        setCurrentUser(u);
        return u;
      }
    } catch (_) {}
    return null;
  };

  const fetchCalendarEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();

      // Fetch window
      const startDate = new Date(year, month, 1);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(year, month + 1, 0);
      endDate.setDate(endDate.getDate() + 7);

      const formatDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };

      const params = new URLSearchParams();
      params.append("start_date", formatDate(startDate));
      params.append("end_date", formatDate(endDate));
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

      // Also fetch user activity if logged in
      if (currentUser || viewMode === "personal") {
        try {
          const actUrl = getApiUrl(`/calendar/user-activity?start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}`);
          const actRes = await fetchWithCredentials(actUrl);
          if (actRes.ok) {
            setUserActivities(await actRes.json());
          }
        } catch (_) {}
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
  }, [currentMonth, viewMode, currentUser]);

  // Helper to parse UTC timestamps safely into browser local Date object
  const parseUtcDate = (ts: string | Date): Date => {
    if (!ts) return new Date();
    if (ts instanceof Date) return ts;
    const str = String(ts).trim();
    if (str.includes("T") && !str.endsWith("Z") && !str.includes("+") && !str.includes("-", 10)) {
      return new Date(`${str}Z`);
    }
    return new Date(str);
  };

  // Group events by local date string YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map: Record<string, AiringEvent[]> = {};
    events.forEach((ev) => {
      const d = parseUtcDate(ev.airing_at);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${day}`;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [events]);

  // Group user activities by date string YYYY-MM-DD
  const activitiesByDate = useMemo(() => {
    const map: Record<string, UserActivityEvent[]> = {};
    userActivities.forEach((act) => {
      const d = parseUtcDate(act.timestamp);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${day}`;
      if (!map[key]) map[key] = [];
      map[key].push(act);
    });
    return map;
  }, [userActivities]);

  // Calendar Grid Days Calculation
  const calendarGrid = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday...

    const cells: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month padding
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        cells.push({
          date: new Date(year, month + 1, i),
          isCurrentMonth: false,
        });
      }
    }

    return cells;
  }, [currentMonth]);

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const getDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const selectedKey = getDateKey(selectedDate);
  const selectedDayEvents = eventsByDate[selectedKey] || [];
  const selectedDayActivities = activitiesByDate[selectedKey] || [];

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

  const monthYearHeader = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const selectedDateHeader = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden pb-20">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-10 relative z-10 space-y-8">
        
        {/* Header Title & Navigation Mode Selector */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-6 border-b border-zinc-900/50 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              {viewMode === "personal" ? "My Personal Calendar" : "Release Schedule Calendar"}
            </h1>
            <p className="text-zinc-400 mt-2">
              {viewMode === "personal"
                ? "Your custom calendar — highlighting seasonal releases you watch & your daily watch history."
                : "Interactive anime broadcast schedule — select any day to view airings."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2 bg-zinc-900/40 p-1.5 rounded-xl border border-zinc-800 backdrop-blur-md">
              {[
                { id: "calendar", label: "Airing Schedule" },

                { id: "list", label: "List View" },
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
        </div>

        {/* Nami's Airing Weather Report Banner */}
        <div className="bg-gradient-to-r from-zinc-900 via-amber-950/20 to-zinc-900 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
          <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-amber-500 shadow-md flex-shrink-0 bg-purple-950">
            <img src="/nami-wano-avatar.jpg" alt="Nami Navigator" className="w-full h-full object-cover scale-110" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-xs font-black text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
              Nami's Airing Weather Report 
            </div>
            <p className="text-xs text-zinc-300 font-medium mt-0.5 truncate">
              {events.length > 0
                ? `Clear skies today across the Grand Line! We have ${events.length} episode airings scheduled on the radar.`
                : "Forecast looks clear! Select any date on the calendar to chart upcoming releases."}
            </p>
          </div>
        </div>


        {/* LOGGED OUT CALLOUT FOR MY CALENDAR */}
        {viewMode === "personal" && !currentUser && (
          <div className="bg-gradient-to-r from-purple-950/60 via-zinc-900 to-zinc-950 border border-purple-800/40 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
            <div>
              <h3 className="text-xl font-bold text-white">Log in to unlock My Calendar</h3>
              <p className="text-sm text-zinc-400 mt-1 max-w-xl">
                My Calendar filters out general anime and shows only the seasonal airings you are currently watching, along with your daily watch progress, ratings, and history!
              </p>
            </div>
            <Link
              href="/login"
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-xl text-sm transition-all shadow-lg shadow-purple-900/50 flex-shrink-0"
            >
              Log In Now
            </Link>
          </div>
        )}

        {/* CALENDAR GRID VIEW (or MY CALENDAR GRID VIEW) */}
        {(viewMode === "calendar" || viewMode === "personal") && (
          <div className="space-y-6">
            
            {/* Month Navigation Control Bar */}
            <div className="flex items-center justify-between bg-zinc-900/40 border border-zinc-850 rounded-2xl p-4 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePrevMonth}
                  className="w-9 h-9 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-purple-500/50 hover:text-purple-400 flex items-center justify-center font-bold transition-all text-sm"
                  title="Previous Month"
                >
                  ←
                </button>
                <h2 className="text-lg font-extrabold text-zinc-100 min-w-40 text-center">
                  {monthYearHeader}
                </h2>
                <button
                  onClick={handleNextMonth}
                  className="w-9 h-9 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-purple-500/50 hover:text-purple-400 flex items-center justify-center font-bold transition-all text-sm"
                  title="Next Month"
                >
                  →
                </button>
              </div>

              <button
                onClick={handleToday}
                className="text-xs px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold hover:bg-purple-500/20 transition-all"
              >
                Jump to Today
              </button>
            </div>

            {/* Color Legend Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/30 border border-zinc-900 rounded-2xl px-4 py-2.5 backdrop-blur-sm text-xs font-semibold text-zinc-400">
              <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                {viewMode === "personal" ? "My Calendar Legend:" : "Schedule Legend:"}
              </span>
              <div className="flex flex-wrap items-center gap-4 text-[11px]">
                {viewMode === "personal" ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-sm shadow-purple-500/50" />
                      <span className="text-purple-300">Seasonal Airing (Your List)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50" />
                      <span className="text-emerald-300">Your Activity / Watch History</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 ring-2 ring-cyan-500/40 animate-pulse" />
                      <span className="text-cyan-300">Today</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-500/50" />
                      <span className="text-amber-300">Past Broadcast</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 ring-2 ring-cyan-500/40 animate-pulse" />
                      <span className="text-cyan-300">Today</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                      <span className="text-purple-300">Upcoming Broadcast</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 7-Column Month Grid */}
            <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-4 md:p-6 backdrop-blur-md space-y-3">
              {/* Days of Week Header */}
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-zinc-500 uppercase tracking-widest pb-2 border-b border-zinc-900">
                {daysOfWeek.map((day) => (
                  <div key={day} className="py-1">{day}</div>
                ))}
              </div>

              {/* Grid Cells */}
              <div className="grid grid-cols-7 gap-2 md:gap-3">
                {calendarGrid.map((cell, idx) => {
                  const key = getDateKey(cell.date);
                  const dayEvents = eventsByDate[key] || [];
                  const dayActivities = activitiesByDate[key] || [];
                  const isSelected = isSameDay(cell.date, selectedDate);
                  
                  const todayObj = new Date();
                  todayObj.setHours(0,0,0,0);
                  const cellObj = new Date(cell.date);
                  cellObj.setHours(0,0,0,0);

                  const isPast = cellObj < todayObj;
                  const isToday = cellObj.getTime() === todayObj.getTime();
                  const isFuture = cellObj > todayObj;

                  const hasEvents = dayEvents.length > 0;
                  const hasActivities = dayActivities.length > 0;
                  const hasPersonalRecord = hasEvents || hasActivities;

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(cell.date)}
                      className={`min-h-[75px] md:min-h-[95px] p-2.5 md:p-3 rounded-2xl flex flex-col justify-between items-start transition-all relative border ${
                        isSelected
                          ? "ring-2 ring-purple-500 bg-purple-900/40 border-purple-400 text-white shadow-xl shadow-purple-950/50 scale-[1.03] z-10"
                          : isToday
                          ? "bg-cyan-950/40 border-cyan-500/80 text-cyan-200 shadow-md shadow-cyan-950/30"
                          : viewMode === "personal" && hasPersonalRecord
                          ? "bg-purple-950/20 border-purple-500/40 text-purple-200 hover:border-purple-400"
                          : isPast && hasEvents
                          ? "bg-amber-950/25 border-amber-500/35 text-amber-200 hover:border-amber-400/60"
                          : isFuture && hasEvents
                          ? "bg-zinc-900/60 border-zinc-800 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900/90"
                          : cell.isCurrentMonth
                          ? "bg-zinc-950/40 border-zinc-900/60 text-zinc-500 hover:border-zinc-800 hover:text-zinc-400"
                          : "bg-zinc-950/10 border-zinc-950 text-zinc-800 opacity-30 hover:opacity-60"
                      }`}
                    >
                      {/* Date Number & Status Indicators */}
                      <div className="w-full flex items-center justify-between">
                        <span className={`text-xs md:text-sm font-extrabold ${
                          isSelected ? "text-purple-300" : isToday ? "text-cyan-300" : "text-zinc-300"
                        }`}>
                          {cell.date.getDate()}
                        </span>

                        {isToday && (
                          <span className="text-[8px] md:text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-sm">
                            Today
                          </span>
                        )}
                      </div>

                      {/* Event & Activity Count Status Badges */}
                      <div className="w-full mt-2 flex flex-col gap-1">
                        {hasEvents && (
                          <div className={`text-[9px] md:text-[10px] px-2 py-0.5 rounded-lg font-extrabold flex items-center gap-1.5 w-fit ${
                            isSelected
                              ? "bg-purple-500 text-white shadow-sm"
                              : "bg-purple-950/60 border border-purple-800/60 text-purple-300"
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                            <span>{dayEvents.length} {dayEvents.length === 1 ? "ep" : "eps"}</span>
                          </div>
                        )}
                        {hasActivities && viewMode === "personal" && (
                          <div className="text-[9px] md:text-[10px] px-2 py-0.5 rounded-lg font-extrabold flex items-center gap-1.5 w-fit bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>{dayActivities.length} log</span>
                          </div>
                        )}
                        {!hasEvents && !hasActivities && cell.isCurrentMonth && (
                          <span className="text-[9px] text-zinc-700 font-semibold italic">Clean</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SELECTED DAY PANEL */}
            <div className="space-y-6 pt-6 border-t border-zinc-900">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-xl font-black text-zinc-100 flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-purple-500" />
                  <span>
                    {viewMode === "personal" ? "My Activity & Releases" : "Broadcast Schedule"} — {selectedDateHeader}
                  </span>
                </h2>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-zinc-400 text-xs font-medium">Fetching schedule and history logs...</p>
                </div>
              ) : (
                <div className="space-y-8">
                  
                  {/* 1. PERSONAL USER WATCH HISTORY & ACTIVITY FOR THIS DAY */}
                  {viewMode === "personal" && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                        <span></span>
                        <span>My Activity & History on This Day ({selectedDayActivities.length})</span>
                      </h3>

                      {selectedDayActivities.length === 0 ? (
                        <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-6 text-center text-zinc-500 text-xs font-medium">
                          No watch list updates or activity recorded on {selectedDateHeader}.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedDayActivities.map((act) => (
                            <div
                              key={act.id}
                              className="flex items-center bg-zinc-900/40 border border-emerald-900/30 hover:border-emerald-500/40 rounded-2xl p-4 transition-all"
                            >
                              <Link
                                href={`/anime/${act.slug}-${act.anime_id}`}
                                className="w-12 h-16 bg-zinc-950 rounded-xl overflow-hidden shadow flex-shrink-0"
                              >
                                {act.cover_url ? (
                                  <img src={act.cover_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-zinc-850 flex items-center justify-center text-[9px]">No Cover</div>
                                )}
                              </Link>
                              <div className="ml-4 flex-grow min-w-0">
                                <Link
                                  href={`/anime/${act.slug}-${act.anime_id}`}
                                  className="text-sm font-bold text-zinc-100 hover:text-emerald-400 transition-colors line-clamp-1"
                                >
                                  {act.anime_title}
                                </Link>
                                <p className="text-xs text-emerald-300 font-semibold mt-1">
                                  {act.description}
                                </p>
                                <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                                  {parseUtcDate(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. SEASONAL EPISODE AIRINGS FOR THIS DAY */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-extrabold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                      <span></span>
                      <span>
                        {viewMode === "personal"
                          ? `Watched Anime Episodes Airing on This Day (${selectedDayEvents.length})`
                          : `Scheduled Broadcasts (${selectedDayEvents.length})`}
                      </span>
                    </h3>

                    {selectedDayEvents.length === 0 ? (
                      <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-8 text-center text-zinc-500">
                        <p className="font-bold text-sm text-zinc-400">
                          {viewMode === "personal"
                            ? "No episodes airing on this day for anime on your list."
                            : "No broadcast releases scheduled for this day."}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedDayEvents.map((ev) => (
                          <div
                            key={`${ev.anime_id}-${ev.episode_number}`}
                            className="flex bg-zinc-900/40 border border-zinc-900 hover:border-zinc-800 rounded-2xl p-4 transition-all group backdrop-blur-sm"
                          >
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

                            <div className="ml-4 flex-grow flex flex-col justify-between min-w-0">
                              <div>
                                <Link
                                  href={`/anime/slug-${ev.anime_id}`}
                                  className="text-sm font-bold text-zinc-200 line-clamp-1 group-hover:text-purple-400 transition-colors"
                                >
                                  {ev.anime_title}
                                </Link>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold">
                                    Ep {ev.episode_number}
                                  </span>
                                  {ev.format && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-850 border border-zinc-800 text-zinc-400 font-bold">
                                      {ev.format}
                                    </span>
                                  )}
                                  {ev.audio_type && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                                      {ev.audio_type}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-zinc-400 font-medium">
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
                                     Watch Trailer
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>

          </div>
        )}

        {/* LIST VIEW */}
        {viewMode === "list" && (
          <div className="space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-400 text-sm font-medium font-mono">Loading schedule list...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-16 text-center text-zinc-500">
                <p className="text-zinc-350 font-bold text-lg">No Airing Events Found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {events.map((ev) => (
                  <div
                    key={`${ev.anime_id}-${ev.episode_number}`}
                    className="flex bg-zinc-900/30 border border-zinc-900 hover:border-zinc-800 rounded-2xl p-4 transition-all group"
                  >
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

                    <div className="ml-4 flex-grow flex flex-col justify-between min-w-0">
                      <div>
                        <Link
                          href={`/anime/slug-${ev.anime_id}`}
                          className="text-sm font-bold text-zinc-200 line-clamp-1 group-hover:text-purple-400 transition-colors"
                        >
                          {ev.anime_title}
                        </Link>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold">
                            Ep {ev.episode_number}
                          </span>
                          {ev.format && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-850 border border-zinc-800 text-zinc-400 font-bold">
                              {ev.format}
                            </span>
                          )}
                          {ev.audio_type && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                              {ev.audio_type}
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-400 font-medium">
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
                             Watch Trailer
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Trailer Modal Player */}
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
