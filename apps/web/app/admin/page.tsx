"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import { fetchWithCredentials, getApiUrl } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface VideoCandidate {
  id: number;
  anime_id: number;
  provider_video_id: string;
  confidence_score?: number;
  matched_rules?: any[];
  status: string;
}

interface ModerationReport {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  description?: string;
  status: string;
  reporter: string;
  created_at: string;
}

interface AuditLog {
  id: number;
  moderator: string;
  action: string;
  target_type: string;
  target_id: string;
  reason?: string;
  created_at: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"curator" | "moderation" | "audit">("curator");

  // General Loading & Error State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Curator Tab States
  const [candidates, setCandidates] = useState<VideoCandidate[]>([]);
  const [processing, setProcessing] = useState<number | null>(null);
  const [discoveryAnimeId, setDiscoveryAnimeId] = useState<string>("");
  const [runningDiscovery, setRunningDiscovery] = useState(false);

  // Moderation Tab States
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [resolvingReportId, setResolvingReportId] = useState<string | null>(null);

  // Audit Log Tab States
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Check role & load initial view
  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      if (activeTab === "curator") {
        await fetchCandidates();
      } else if (activeTab === "moderation") {
        await fetchReports();
      } else if (activeTab === "audit") {
        await fetchAuditLogs();
      }
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // CURATOR LOGIC
  // ───────────────────────────────────────────────────────────────────────────

  const fetchCandidates = async () => {
    const res = await fetchWithCredentials(getApiUrl("/admin/video-candidates"));
    if (!res.ok) {
      if (res.status === 401) { router.push("/login"); return; }
      if (res.status === 403) { throw new Error("Access denied. Curator or Admin role required."); }
      throw new Error("Failed to load candidate queue.");
    }
    const data = await res.json();
    setCandidates(data);
  };

  const handleApproveCandidate = async (candidateId: number) => {
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
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectCandidate = async (candidateId: number) => {
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
        alert(`Discovery complete! ${newCandidates.length} candidates generated.`);
        fetchCandidates();
        setDiscoveryAnimeId("");
      } else {
        const err = await res.json();
        alert(err.detail || "Discovery failed.");
      }
    } finally {
      setRunningDiscovery(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // MODERATION LOGIC
  // ───────────────────────────────────────────────────────────────────────────

  const fetchReports = async () => {
    const res = await fetchWithCredentials(getApiUrl("/moderation/reports?status_filter=OPEN"));
    if (!res.ok) {
      if (res.status === 403) { throw new Error("Access denied. Moderator or Admin role required."); }
      throw new Error("Failed to fetch open reports list.");
    }
    const data = await res.json();
    setReports(data.items);
  };

  const handleResolveReport = async (reportId: string, action: string) => {
    const reason = prompt("Enter moderation reason/comment (optional):");
    setResolvingReportId(reportId);
    try {
      const res = await fetchWithCredentials(getApiUrl(`/moderation/reports/${reportId}/resolve`), {
        method: "POST",
        body: JSON.stringify({
          action: action,
          reason: reason || "",
        }),
      });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
        alert("Report resolved successfully.");
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to resolve report.");
      }
    } finally {
      setResolvingReportId(null);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // AUDIT LOG LOGIC
  // ───────────────────────────────────────────────────────────────────────────

  const fetchAuditLogs = async () => {
    const res = await fetchWithCredentials(getApiUrl("/moderation/audit-logs"));
    if (!res.ok) {
      if (res.status === 403) { throw new Error("Access denied. Moderator or Admin role required."); }
      throw new Error("Failed to fetch audit log logs.");
    }
    const data = await res.json();
    setAuditLogs(data.items);
  };

  const getConfidenceColor = (score?: number) => {
    if (!score) return "text-zinc-500 bg-zinc-900 border-zinc-800";
    if (score >= 70) return "text-green-400 bg-green-500/10 border-green-500/20";
    if (score >= 40) return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
    return "text-red-400 bg-red-500/10 border-red-500/20";
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden pb-20">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-10 relative z-10">
        {/* Title and navigation tabs */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-6 border-b border-zinc-900">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-[10px] uppercase font-black tracking-widest text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
                Administration Portal
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              Control Panel
            </h1>
          </div>

          {/* Tabs header control */}
          <div className="flex bg-zinc-900/80 border border-zinc-800 rounded-xl p-1 relative z-20">
            <button
              onClick={() => setActiveTab("curator")}
              className={`text-xs px-4 py-2 rounded-lg font-bold transition-all ${
                activeTab === "curator" ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              Curator Queue
            </button>
            <button
              onClick={() => setActiveTab("moderation")}
              className={`text-xs px-4 py-2 rounded-lg font-bold transition-all ${
                activeTab === "moderation" ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              Moderation Queue
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`text-xs px-4 py-2 rounded-lg font-bold transition-all ${
                activeTab === "audit" ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              Audit Trail
            </button>
          </div>
        </div>

        {/* Global Loading, Error or Queue state switch */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-400 text-sm font-medium">Loading details...</p>
          </div>
        ) : error ? (
          <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-6 text-red-400 text-sm">
            <p className="font-bold">Access Restriction</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* 1. CURATOR TAB CONTAINER */}
            {activeTab === "curator" && (
              <div className="space-y-6">
                <div className="bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl">
                  <h2 className="text-base font-bold text-zinc-200 mb-4">Run Video Discovery</h2>
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                    <div className="flex flex-col gap-2 flex-1 w-full">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Anime Database ID</label>
                      <input
                        type="number"
                        value={discoveryAnimeId}
                        onChange={(e) => setDiscoveryAnimeId(e.target.value)}
                        placeholder="e.g. 1 (Attack on Titan)"
                        className="bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 text-zinc-200 transition-all w-full"
                      />
                    </div>
                    <button
                      onClick={handleRunDiscovery}
                      disabled={runningDiscovery || !discoveryAnimeId}
                      className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold transition-all shadow-lg w-full sm:w-auto"
                    >
                      {runningDiscovery ? "Scanning..." : "Run Discovery"}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-zinc-200">
                    Pending Video Candidates ({candidates.length})
                  </h2>
                </div>

                {candidates.length === 0 ? (
                  <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-12 text-center text-zinc-500">
                    Curation queue is empty.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {candidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-zinc-800 transition-all"
                      >
                        <div className="flex flex-col gap-2 flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm font-bold text-zinc-200 font-mono">{candidate.provider_video_id}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black border uppercase tracking-wider ${getConfidenceColor(candidate.confidence_score)}`}>
                              {candidate.confidence_score != null ? `${candidate.confidence_score}% confidence` : "Unscored"}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-500">
                            Anime ID: <span className="text-zinc-400 font-bold">{candidate.anime_id}</span> • Status: <span className="text-zinc-400 font-bold">{candidate.status}</span>
                          </div>
                        </div>

                        <div className="flex gap-3 w-full sm:w-auto justify-end">
                          <a
                            href={`https://www.youtube.com/watch?v=${candidate.provider_video_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-4 py-2 rounded-xl bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-bold transition-all"
                          >
                            Preview ↗
                          </a>
                          <button
                            onClick={() => handleRejectCandidate(candidate.id)}
                            disabled={processing === candidate.id}
                            className="text-xs px-4 py-2 rounded-xl bg-red-950/20 border border-red-900/20 text-red-400 font-bold hover:bg-red-950/45 transition-all"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleApproveCandidate(candidate.id)}
                            disabled={processing === candidate.id}
                            className="text-xs px-4 py-2 rounded-xl bg-green-950/20 border border-green-900/20 text-green-400 font-bold hover:bg-green-950/45 transition-all"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. MODERATOR TAB CONTAINER */}
            {activeTab === "moderation" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-zinc-200">
                    Harmful Content Reports Queue ({reports.length})
                  </h2>
                </div>

                {reports.length === 0 ? (
                  <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-12 text-center text-zinc-500">
                    No open community moderation reports. Great job!
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {reports.map((report) => (
                      <div
                        key={report.id}
                        className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-5 flex flex-col gap-4 hover:border-zinc-800 transition-all"
                      >
                        <div className="flex items-start justify-between flex-wrap gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                {report.target_type}
                              </span>
                              <span className="text-xs text-red-400 font-bold bg-red-500/10 border border-red-500/10 px-2 py-0.5 rounded-full">
                                🚨 {report.reason}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-500 font-medium">
                              Reported by <span className="text-zinc-400 font-bold">@{report.reporter}</span> on {new Date(report.created_at).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="text-xs text-zinc-500 font-mono select-all">
                            Target ID: {report.target_id}
                          </div>
                        </div>

                        {report.description && (
                          <div className="bg-zinc-950/40 rounded-xl p-3 border border-zinc-900 text-xs text-zinc-400">
                            <span className="font-bold text-zinc-500 block mb-1">REPORTER NOTE:</span>
                            {report.description}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-zinc-855/40">
                          {/* Navigate to target context preview details */}
                          <div>
                            {report.target_type === "discussion" ? (
                              <Link
                                href={`/discussions/${report.target_id}`}
                                className="text-xs text-purple-400 hover:underline font-semibold"
                              >
                                View discussion thread details →
                              </Link>
                            ) : (
                              <span className="text-xs text-zinc-600">Content context (review/comment ID listed above)</span>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleResolveReport(report.id, "DISMISS")}
                              disabled={resolvingReportId === report.id}
                              className="text-xs px-3.5 py-1.5 rounded-lg bg-zinc-855 hover:bg-zinc-750 text-zinc-300 font-bold transition-all border border-zinc-850"
                            >
                              Dismiss Report
                            </button>
                            <button
                              onClick={() => handleResolveReport(report.id, "HIDE")}
                              disabled={resolvingReportId === report.id}
                              className="text-xs px-3.5 py-1.5 rounded-lg bg-yellow-950/30 border border-yellow-900/30 hover:bg-yellow-900/20 text-yellow-400 font-bold transition-all"
                            >
                              Hide Content
                            </button>
                            <button
                              onClick={() => handleResolveReport(report.id, "REMOVE")}
                              disabled={resolvingReportId === report.id}
                              className="text-xs px-3.5 py-1.5 rounded-lg bg-red-950/30 border border-red-900/30 hover:bg-red-950/60 text-red-400 font-bold transition-all"
                            >
                              Remove Content
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. AUDIT LOG TAB CONTAINER */}
            {activeTab === "audit" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-zinc-200">
                    System Moderation Action Logs ({auditLogs.length})
                  </h2>
                </div>

                {auditLogs.length === 0 ? (
                  <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-12 text-center text-zinc-500">
                    No moderation audit events recorded.
                  </div>
                ) : (
                  <div className="bg-zinc-900/10 border border-zinc-900 rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-zinc-400">
                        <thead className="bg-zinc-900/60 text-zinc-500 uppercase tracking-wider font-extrabold text-[10px] border-b border-zinc-800">
                          <tr>
                            <th className="px-6 py-4">Moderator</th>
                            <th className="px-6 py-4">Action</th>
                            <th className="px-6 py-4">Target Type</th>
                            <th className="px-6 py-4">Target ID</th>
                            <th className="px-6 py-4">Reason / Notes</th>
                            <th className="px-6 py-4">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                          {auditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-zinc-900/20 transition-all">
                              <td className="px-6 py-4 font-bold text-zinc-300">@{log.moderator}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  log.action === "REMOVE" || log.action === "HIDE"
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-green-500/10 text-green-400"
                                }`}>
                                  {log.action}
                                </span>
                              </td>
                              <td className="px-6 py-4 capitalize font-semibold">{log.target_type}</td>
                              <td className="px-6 py-4 font-mono text-[10px]">{log.target_id}</td>
                              <td className="px-6 py-4 italic text-zinc-500">{log.reason || "None"}</td>
                              <td className="px-6 py-4 text-zinc-600 font-medium">
                                {new Date(log.created_at).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}
