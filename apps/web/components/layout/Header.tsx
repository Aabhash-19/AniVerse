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
      if (typeof window !== "undefined") {
        localStorage.removeItem("namiverse_token");
      }
      setUser(null);
      setUnreadCount(0);
      router.push("/discover");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header role="banner" aria-label="NamiVerse site header" className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-8">
          <Link href="/discover" aria-label="NamiVerse — Go to homepage" className="flex items-center gap-2.5">
            <span className="text-xl sm:text-2xl font-black bg-gradient-to-r from-purple-400 via-violet-300 to-indigo-500 bg-clip-text text-transparent tracking-wider">
              NAMIVERSE
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 hidden sm:inline-flex items-center gap-1">
              Navigated by Nami
            </span>
          </Link>

          {/* Desktop Nav Links */}
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

        {/* Desktop User Controls & Mobile Menu Button */}
        <div className="flex items-center gap-4">
          {/* Desktop Only controls */}
          <div className="hidden md:flex items-center gap-4">
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

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle mobile navigation menu"
            className="md:hidden p-2 text-zinc-400 hover:text-zinc-200 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 rounded-xl transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden flex justify-end">
          {/* Backdrop Click */}
          <div className="absolute inset-0" onClick={() => setMenuOpen(false)} />
          
          {/* Slide-out Menu Panel */}
          <div className="relative w-72 h-full bg-zinc-950 border-l border-zinc-900 shadow-2xl p-6 flex flex-col justify-between animate-in slide-in-from-right-4 duration-300 z-10">
            <div className="space-y-8">
              {/* Header inside Menu */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
                <span className="text-lg font-black bg-gradient-to-r from-purple-400 to-indigo-500 bg-clip-text text-transparent">
                  NAVIGATION
                </span>
                <button
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                  className="p-1 text-zinc-400 hover:text-zinc-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Navigation Links */}
              <nav role="navigation" aria-label="Mobile navigation" className="flex flex-col gap-5">
                {[
                  { href: "/discover", label: "Discover" },
                  { href: "/calendar", label: "Calendar" },
                  { href: "/upcoming", label: "Upcoming" },
                  { href: "/videos", label: "Videos" },
                  ...(user ? [{ href: "/my-list", label: "My List" }] : [])
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`text-base font-bold transition-all ${
                      pathname === item.href ? "text-purple-400" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* User Details & CTA Block */}
            <div className="pt-6 border-t border-zinc-900 space-y-4">
              {user ? (
                <div className="flex flex-col gap-4">
                  {/* Logged in info */}
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Account</span>
                      <Link
                        href={`/profile/${user.username}`}
                        onClick={() => setMenuOpen(false)}
                        className="text-sm font-bold text-zinc-200 hover:text-purple-400 truncate block mt-0.5"
                      >
                        {user.display_name || user.username}
                      </Link>
                    </div>

                    {/* Mobile Notification Bell */}
                    <Link
                      href="/notifications"
                      onClick={() => setMenuOpen(false)}
                      aria-label="Notifications"
                      className="relative p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      {unreadCount > 0 && (
                        <span className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 text-[9px] font-black text-white bg-purple-600 rounded-full translate-x-1 -translate-y-1">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                  </div>

                  {user.role === "ADMIN" && (
                    <Link
                      href="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="text-xs text-center py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-bold block"
                    >
                      Curator Queue
                    </Link>
                  )}

                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="text-xs text-center py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 font-bold block"
                  >
                    Settings
                  </Link>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full text-xs text-center py-2.5 rounded-xl bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 font-bold"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="text-xs text-center py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold block"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMenuOpen(false)}
                    className="text-xs text-center py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold block shadow-lg shadow-purple-900/20"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
