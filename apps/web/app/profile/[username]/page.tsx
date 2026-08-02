"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { fetchWithCredentials, getApiUrl } from "@/lib/auth";

interface ProfileUser {
  id: string;
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  role: string;
  created_at: string;
}

interface WatchlistStats {
  watching: number;
  completed: number;
  planning: number;
  dropped: number;
  paused: number;
}

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const router = useRouter();
  const { username } = use(params);

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Blocking state
  const [isBlocked, setIsBlocked] = useState(false);
  const [togglingBlock, setTogglingBlock] = useState(false);

  // Stats (from their public watchlist)
  const [stats, setStats] = useState<WatchlistStats | null>(null);

  const checkCurrentUser = async () => {
    try {
      const res = await fetchWithCredentials(getApiUrl("/auth/me"));
      if (res.ok) setCurrentUser(await res.json());
    } catch (_) {}
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch(getApiUrl(`/auth/profile/${username}`));
      if (!res.ok) {
        setError("User not found.");
        setLoading(false);
        return;
      }
      setProfile(await res.json());
    } catch (_) {
      setError("Failed to load profile.");
    }
  };

  const fetchBlockList = async () => {
    try {
      const res = await fetchWithCredentials(getApiUrl("/me/blocks"));
      if (res.ok) {
        const blocks = await res.json();
        setIsBlocked(blocks.some((b: any) => b.username === username));
      }
    } catch (_) {}
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(getApiUrl(`/anime-lists/public/${username}`));
      if (res.ok) {
        const entries = await res.json();
        const s: WatchlistStats = { watching: 0, completed: 0, planning: 0, dropped: 0, paused: 0 };
        for (const e of entries) {
          const st = (e.status || "").toLowerCase();
          if (st in s) (s as any)[st]++;
        }
        setStats(s);
      }
    } catch (_) {}
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([checkCurrentUser(), fetchProfile()]);
      setLoading(false);
    };
    init();
  }, [username]);

  useEffect(() => {
    if (currentUser && profile && currentUser.id !== profile.id) {
      fetchBlockList();
    }
    if (profile) {
      fetchStats();
    }
  }, [currentUser, profile]);

  const handleToggleBlock = async () => {
    if (!currentUser) { router.push("/login"); return; }
    setTogglingBlock(true);
    try {
      const method = isBlocked ? "DELETE" : "PUT";
      const res = await fetchWithCredentials(getApiUrl(`/users/${username}/block`), { method });
      if (res.ok) {
        setIsBlocked(!isBlocked);
      } else {
        const err = await res.json();
        alert(err.detail || "Action failed.");
      }
    } finally {
      setTogglingBlock(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "ADMIN": case "SUPER_ADMIN": return "text-red-400 bg-red-500/10 border-red-500/20";
      case "MODERATOR": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      case "CURATOR": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
      default: return "text-zinc-400 bg-zinc-800 border-zinc-700";
    }
  };

  const isOwnProfile = currentUser?.id === profile?.id;
  const isGuest = !currentUser;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-100 font-sans p-6">
        <div className="text-center space-y-4">
          <p className="text-5xl">👤</p>
          <h1 className="text-2xl font-extrabold text-zinc-200">User Not Found</h1>
          <p className="text-zinc-500 text-sm">{error || "This profile doesn't exist."}</p>
          <Link href="/discover" className="inline-block px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-bold transition-all">
            Back to Discover
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden pb-20">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[40%] bg-purple-900/5 rounded-full blur-[120px] pointer-events-none" />
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-12 relative z-10">
        {/* Profile Header Card */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md rounded-2xl p-8 shadow-2xl mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-3xl font-black text-white overflow-hidden flex-shrink-0 shadow-lg shadow-purple-900/30">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
              ) : (
                profile.username[0].toUpperCase()
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-2xl font-extrabold text-zinc-100 tracking-tight">
                  {profile.display_name || profile.username}
                </h1>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black border uppercase tracking-wider ${getRoleColor(profile.role)}`}>
                  {profile.role}
                </span>
              </div>
              <p className="text-sm text-zinc-500 font-medium mb-2">@{profile.username}</p>
              {profile.bio && (
                <p className="text-sm text-zinc-400 leading-relaxed">{profile.bio}</p>
              )}
              <p className="text-xs text-zinc-600 mt-2">
                Member since {new Date(profile.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              {isOwnProfile ? (
                <Link
                  href="/my-list"
                  className="text-xs px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all text-center"
                >
                  My List →
                </Link>
              ) : !isGuest ? (
                <button
                  onClick={handleToggleBlock}
                  disabled={togglingBlock}
                  className={`text-xs px-5 py-2.5 rounded-xl font-bold transition-all border disabled:opacity-50 ${
                    isBlocked
                      ? "bg-red-950/30 border-red-900/30 text-red-400 hover:bg-red-950/60"
                      : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                  }`}
                >
                  {togglingBlock ? "..." : isBlocked ? "🚫 Unblock User" : "Block User"}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Watchlist Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
            {[
              { label: "Watching", value: stats.watching, color: "text-blue-400" },
              { label: "Completed", value: stats.completed, color: "text-green-400" },
              { label: "Planning", value: stats.planning, color: "text-purple-400" },
              { label: "Paused", value: stats.paused, color: "text-yellow-400" },
              { label: "Dropped", value: stats.dropped, color: "text-red-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-zinc-900/30 border border-zinc-900 rounded-xl p-4 text-center">
                <p className={`text-2xl font-black ${color}`}>{value}</p>
                <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Blocked User Warning Banner */}
        {isBlocked && (
          <div className="bg-red-950/20 border border-red-900/30 rounded-2xl p-5 text-center mb-8">
            <p className="text-sm font-bold text-red-400">You have blocked @{profile.username}</p>
            <p className="text-xs text-zinc-500 mt-1">Their content is hidden from your feeds. Unblock to see their activity.</p>
          </div>
        )}

        {/* Public Anime List Preview */}
        {!isBlocked && (
          <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-6">
            <h2 className="text-base font-bold text-zinc-200 mb-4">
              {isOwnProfile ? "Your" : `@${profile.username}'s`} Anime List
            </h2>
            <p className="text-sm text-zinc-500">
              {isOwnProfile
                ? <>View and manage your full list on the <Link href="/my-list" className="text-purple-400 hover:underline">My List</Link> page.</>
                : "Full anime list statistics shown above. Detailed entries are private."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
