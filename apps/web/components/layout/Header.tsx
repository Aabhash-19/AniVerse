"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { fetchWithCredentials, getApiUrl } from "@/lib/auth";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  const checkUser = async () => {
    try {
      const res = await fetchWithCredentials(getApiUrl("/auth/me"));
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    }
  };

  useEffect(() => {
    checkUser();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetchWithCredentials(getApiUrl("/auth/logout"), { method: "POST" });
      setUser(null);
      router.push("/discover");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 px-6 py-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-8">
          <Link href="/discover" className="flex items-center gap-2">
            <span className="text-2xl font-black bg-gradient-to-r from-purple-400 to-indigo-500 bg-clip-text text-transparent tracking-wider">
              ANIVERSE
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link 
              href="/discover" 
              className={`font-semibold transition-all ${pathname === "/discover" ? "text-purple-400" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              Discover
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
              {user.role === "ADMIN" && (
                <Link 
                  href="/admin" 
                  className="text-xs px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-850"
                >
                  Curator Queue
                </Link>
              )}
              <span className="text-sm font-semibold text-zinc-300">
                {user.display_name}
              </span>
              <button 
                onClick={handleLogout}
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
