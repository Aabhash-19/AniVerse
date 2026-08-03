"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { fetchWithCredentials, getApiUrl } from "@/lib/auth";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<Record<string, any> | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    const checkUser = async () => {
      try {
        const res = await fetchWithCredentials(getApiUrl("/auth/me"));
        if (res.ok && active) {
          const data = await res.json();
          setUser(data);
        } else if (active) {
          setUser(null);
        }
      } catch {
        if (active) setUser(null);
      }
    };
    checkUser();
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!user) return;

    let active = true;
    const fetchUnreadCount = async () => {
      try {
        const res = await fetchWithCredentials(getApiUrl("/notifications?unread_only=true"));
        if (res.ok && active) {
          const data = await res.json();
          setUnreadCount(data.length);
        }
      } catch {
        // Ignore fetch errors
      }
    };

    fetchUnreadCount();
    window.addEventListener("notifications_updated", fetchUnreadCount);
    return () => {
      active = false;
      window.removeEventListener("notifications_updated", fetchUnreadCount);
    };
  }, [user]);

  const handleLogout = async () => {
    try {
      await fetchWithCredentials(getApiUrl("/auth/logout"), { method: "POST" });
      setUser(null);
      setUnreadCount(0);
      router.push("/discover");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header role="banner" aria-label="AniVerse site header" className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 px-6 py-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-8">
          <Link href="/discover" aria-label="AniVerse — Go to homepage" className="flex items-center gap-2.5">
            <span className="text-2xl font-black bg-gradient-to-r from-purple-400 via-violet-300 to-indigo-500 bg-clip-text text-transparent tracking-wider">
              ANIVERSE
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 hidden sm:inline-flex items-center gap-1">
              Navigated by Nami
            </span>
          </Link>


          <nav role="navigation" aria-label="Main navigation" className="hidden md:flex items-center gap-6 text-sm">
            <Link 
              href="/discover" 
              className={`font-semibold transition-all ${pathname === "/discover" ? "text-purple-400" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              Discover
            </Link>
            <Link 
              href="/calendar" 
              className={`font-semibold transition-all ${pathname === "/calendar" ? "text-purple-400" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              Calendar
            </Link>
            <Link 
              href="/upcoming" 
              className={`font-semibold transition-all ${pathname === "/upcoming" ? "text-purple-400" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              Upcoming
            </Link>
            <Link 
              href="/videos" 
              className={`font-semibold transition-all ${pathname === "/videos" ? "text-purple-400" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              Videos
            </Link>
            {user && (
              <Link 
                href="/my-list" 
                className={`font-semibold transition-all ${pathname === "/my-list" ? "text-purple-400" : "text-zinc-400 hover:text-zinc-200"}`}
              >
                My List
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              {/* Notification Bell */}
              <Link href="/notifications" aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ""}`} className="relative p-1 text-zinc-400 hover:text-zinc-200 transition-all">
                <svg className="w-5 h-5 text-zinc-400 hover:text-zinc-200 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-black leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-purple-600 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </Link>

              {user.role === "ADMIN" && (
                <Link 
                  href="/admin" 
                  className="text-xs px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-850"
                >
                  Curator Queue
                </Link>
              )}
              
              <Link href={`/profile/${user.username}`} className="text-sm font-semibold text-zinc-300 hover:text-purple-400 transition-colors">
                {user.display_name || user.username}
              </Link>
              
              <Link href="/settings" className="text-xs font-bold text-zinc-400 hover:text-zinc-200 transition-all">
                Settings
              </Link>
              
              <button 
                onClick={handleLogout}
                aria-label="Log out of your account"
                className="text-xs px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold transition-all border border-zinc-850"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link 
                href="/login" 
                className="text-xs px-4 py-2 text-zinc-400 hover:text-zinc-200 font-bold transition-all"
              >
                Login
              </Link>
              <Link 
                href="/register" 
                className="text-xs px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-lg shadow-purple-900/20"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
