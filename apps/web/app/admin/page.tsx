"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { fetchWithCredentials, getApiUrl } from "@/lib/auth";
import { useRouter } from "next/navigation";

interface VideoCandidate {
  id: number;
  anime_id: number;
  provider_video_id: string;
  confidence_score?: number;
  matched_rules?: any[];
  status: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<VideoCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState<number | null>(null);
  const [discoveryAnimeId, setDiscoveryAnimeId] = useState<string>("");
  const [runningDiscovery, setRunningDiscovery] = useState(false);

  const fetchCandidates = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchWithCredentials(getApiUrl("/admin/video-candidates"));
      if (!res.ok) {
        if (res.status === 401) { router.push("/login"); return; }
        if (res.status === 403) { setError("You do not have curator or admin access."); setLoading(false); return; }
        throw new Error("Failed to load candidate queue.");
      }
      const data = await res.json();
      setCandidates(data);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (candidateId: number) => {
    setProcessing(candidateId);
    try {
      const res = await fetchWithCredentials(getApiUrl(`/admin/video-candidates/${candidateId}/approve`), {
        method: "POST",
      });
      if (res.ok) {
        setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to approve candidate.");
      }
    } catch (e) {
      alert("Error approving candidate.");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (candidateId: number) => {
    setProcessing(candidateId);
    try {
      const res = await fetchWithCredentials(getApiUrl(`/admin/video-candidates/${candidateId}/reject`), {
        method: "POST",
      });
      if (res.ok || res.status === 204) {
        setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to reject candidate.");
      }
    } catch (e) {
      alert("Error rejecting candidate.");
    } finally {
      setProcessing(null);
    }
  };

  const handleRunDiscovery = async () => {
    if (!discoveryAnimeId.trim()) { alert("Enter an Anime ID first."); return; }
    setRunningDiscovery(true);
    try {
      const res = await fetchWithCredentials(getApiUrl(`/admin/video-discovery/${discoveryAnimeId}`), {
        method: "POST",
      });
      if (res.ok) {
        const newCandidates = await res.json();
        alert(`Discovery complete! ${newCandidates.length} new candidates added to the queue.`);
        fetchCandidates();
        setDiscoveryAnimeId("");
      } else {
        const err = await res.json();
        alert(err.detail || "Discovery failed.");
      }
    } catch (e) {
      alert("Error running discovery.");
    } finally {
      setRunningDiscovery(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const getConfidenceColor = (score?: number) => {
    if (!score) return "text-zinc-500 bg-zinc-900";
    if (score >= 70) return "text-green-400 bg-green-500/10 border-green-500/20";
    if (score >= 40) return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
    return "text-red-400 bg-red-500/10 border-red-500/20";
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-10 relative z-10">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[10px] uppercase font-black tracking-widest text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
              Admin
            </span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Curator Dashboard
          </h1>
          <p className="text-zinc-400 mt-2">Review video candidates and approve official media for the public library.</p>
        </div>

        {/* Discovery trigger panel */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md rounded-2xl p-6 mb-8 shadow-xl">
          <h2 className="text-base font-bold text-zinc-200 mb-4">Run Video Discovery</h2>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex flex-col gap-2 flex-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Anime Database ID</label>
              <input
                type="number"
                value={discoveryAnimeId}
                onChange={(e) => setDiscoveryAnimeId(e.target.value)}
                placeholder="e.g. 1 (Attack on Titan)"
                className="bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 text-zinc-200 transition-all"
              />
            </div>
            <button
              onClick={handleRunDiscovery}
              disabled={runningDiscovery || !discoveryAnimeId}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold transition-all shadow-lg shadow-purple-900/30"
            >
              {runningDiscovery ? "Scanning..." : "Run Discovery"}
            </button>
          </div>
          <p className="text-xs text-zinc-600 mt-3">
            Discovery fetches mock video candidates and scores them using the confidence rules engine. Approve or reject each candidate below.
          </p>
        </div>

        {/* Candidates Queue */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-200">
            Pending Candidates
            <span className="ml-2 text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">
              {candidates.length}
            </span>
          </h2>
          <button
            onClick={fetchCandidates}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-all font-bold"
          >
            Refresh ↺
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-400 text-sm font-medium">Loading curator queue...</p>
          </div>
        ) : error ? (
          <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-6 text-red-400 text-sm">
            <p className="font-bold">Access Error</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-12 text-center">
            <p className="text-zinc-400 font-bold">Queue is empty</p>
            <p className="text-sm text-zinc-600 mt-1">Run discovery on an anime to generate candidates for review.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-zinc-800 transition-all"
              >
                {/* Candidate info */}
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-bold text-zinc-200 font-mono">{candidate.provider_video_id}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-black border uppercase tracking-wider ${getConfidenceColor(candidate.confidence_score)}`}
                    >
                      {candidate.confidence_score != null ? `${candidate.confidence_score}% confidence` : "Unscored"}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    Anime ID: <span className="text-zinc-400 font-bold">{candidate.anime_id}</span> • 
                    Status: <span className="text-zinc-400 font-bold ml-1">{candidate.status}</span>
                  </div>
                  {candidate.matched_rules && candidate.matched_rules.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {candidate.matched_rules.map((rule: any, idx: number) => (
                        <span
                          key={idx}
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                            rule.points > 0
                              ? "text-green-400 bg-green-500/5 border-green-500/10"
                              : "text-red-400 bg-red-500/5 border-red-500/10"
                          }`}
                        >
                          {rule.rule} ({rule.points > 0 ? "+" : ""}{rule.points})
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 flex-shrink-0">
                  <a
                    href={`https://www.youtube.com/watch?v=${candidate.provider_video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-bold transition-all border border-zinc-700"
                  >
                    Preview ↗
                  </a>
                  <button
                    onClick={() => handleReject(candidate.id)}
                    disabled={processing === candidate.id}
                    className="text-xs px-4 py-2 rounded-xl bg-red-950/30 hover:bg-red-950/60 text-red-400 font-bold transition-all border border-red-900/30 disabled:opacity-40"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(candidate.id)}
                    disabled={processing === candidate.id}
                    className="text-xs px-4 py-2 rounded-xl bg-green-950/30 hover:bg-green-950/60 text-green-400 font-bold transition-all border border-green-900/30 disabled:opacity-40"
                  >
                    {processing === candidate.id ? "..." : "Approve"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
