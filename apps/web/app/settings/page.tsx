"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { fetchWithCredentials, getApiUrl } from "@/lib/auth";

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const checkUser = async () => {
    setLoading(true);
    try {
      const res = await fetchWithCredentials(getApiUrl("/auth/me"));
      if (res.ok) {
        setCurrentUser(await res.json());
      } else {
        router.push("/login");
      }
    } catch (_) {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUser();
  }, []);

  const handleExportData = async () => {
    setExporting(true);
    try {
      const res = await fetchWithCredentials(getApiUrl("/auth/me/export"));
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `aniverse_export_${currentUser.username}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert("Failed to export user profile data.");
      }
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    const check1 = confirm("️ WARNING: Are you absolutely sure you want to delete your account? This action is permanent and cannot be undone.");
    if (!check1) return;
    const check2 = confirm("Confirming again: All watchlists, ratings, comments, and profile preferences will be permanently wiped from the database.");
    if (!check2) return;

    setDeleting(true);
    try {
      const res = await fetchWithCredentials(getApiUrl("/auth/me"), {
        method: "DELETE",
      });
      if (res.status === 204 || res.ok) {
        alert("Your account has been deleted successfully.");
        router.push("/discover");
        router.refresh();
      } else {
        alert("Failed to delete account. Please try again later.");
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 text-sm font-medium">Resolving settings portal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden pb-20">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <Header />

      <main className="max-w-3xl mx-auto px-6 py-12 relative z-10 space-y-10">
        
        {/* Title */}
        <div className="border-b border-zinc-900 pb-6">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Account Settings
          </h1>
          <p className="text-zinc-400 mt-2">Manage your data settings and legal controls.</p>
        </div>

        {/* Data & Privacy Section */}
        <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h2 className="text-lg font-bold text-zinc-200">Data Controls & Export</h2>
            <p className="text-xs text-zinc-550 mt-1">Download or clear your data footprints from NamiVerse databases.</p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/40 border border-zinc-850">
              <div>
                <p className="text-xs font-bold text-zinc-350">Download Data Archive</p>
                <p className="text-[10px] text-zinc-500">Request a download containing your watchlist, ratings, reviews, and preferences.</p>
              </div>
              <button
                onClick={handleExportData}
                disabled={exporting}
                className="text-xs px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold transition-all shadow-md flex-shrink-0"
              >
                {exporting ? "Compiling..." : "Export Data (JSON)"}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-red-950/5 border border-red-950/20">
              <div>
                <p className="text-xs font-bold text-red-400">Permanently Delete Account</p>
                <p className="text-[10px] text-zinc-500">Wipe all watchlists, reviews, and profile data. This action is irreversible.</p>
              </div>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="text-xs px-4 py-2 rounded-xl bg-red-650 hover:bg-red-550 disabled:opacity-50 text-white font-bold transition-all flex-shrink-0"
              >
                {deleting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>

        {/* Legal disclosures & quick links */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-2">Legal References</h3>
          <div className="flex gap-6 text-xs font-bold text-purple-400">
            <Link href="/privacy" className="hover:text-purple-300 transition-all">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-purple-300 transition-all">
              Terms of Service
            </Link>
          </div>
        </div>

      </main>
    </div>
  );
}
