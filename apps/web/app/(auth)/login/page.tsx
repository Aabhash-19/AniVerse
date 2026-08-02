"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchWithCredentials, getApiUrl } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetchWithCredentials(getApiUrl("/auth/login"), {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Incorrect username or password.");
      }

      // Successful login
      router.push("/discover");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex items-center justify-center relative overflow-hidden px-4">
      {/* Background ambient light */}
      <div className="absolute top-[20%] left-[20%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-[50%] h-[50%] bg-indigo-900/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md rounded-2xl p-8 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <Link href="/discover" className="text-3xl font-black bg-gradient-to-r from-purple-400 to-indigo-500 bg-clip-text text-transparent tracking-widest">
            ANIVERSE
          </Link>
          <h2 className="text-xl font-bold mt-4 text-zinc-200">Welcome Back</h2>
          <p className="text-zinc-500 text-xs mt-1">Access your watchlist and personalized recommendations.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl p-3 mb-6 font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Username or Email</label>
            <input
              type="text"
              required
              placeholder="Enter your username or email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 text-zinc-200 transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 text-zinc-200 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-950/30 mt-2"
          >
            {loading ? "Authenticating..." : "Login"}
          </button>
        </form>

        <div className="text-center mt-8 text-xs text-zinc-500">
          Don't have an account?{" "}
          <Link href="/register" className="text-purple-400 hover:text-purple-300 font-bold transition-all">
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
