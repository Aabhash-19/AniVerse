"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { fetchWithCredentials, getApiUrl } from "@/lib/auth";

interface NotificationItem {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  created_at: string;
}

interface Preferences {
  episodes_enabled: boolean;
  trailers_enabled: boolean;
  movies_enabled: boolean;
  replies_enabled: boolean;
  followers_enabled: boolean;
  emails_enabled: boolean;
  push_enabled: boolean;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pref, setPref] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [error, setError] = useState("");
  const [updatingPref, setUpdatingPref] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetchWithCredentials(getApiUrl(`/notifications?unread_only=${unreadOnly}`));
      if (res.ok) {
        setNotifications(await res.json());
      } else {
        setError("Failed to load notifications.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const res = await fetchWithCredentials(getApiUrl("/notification-preferences"));
      if (res.ok) {
        setPref(await res.json());
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchNotifications();
    fetchPreferences();
  }, [unreadOnly]);

  const handleMarkRead = async (id: string) => {
    try {
      const res = await fetchWithCredentials(getApiUrl(`/notifications/${id}/read`), {
        method: "PATCH",
      });
      if (res.ok) {
        fetchNotifications();
        // Dispatch custom event to notify Header bell to update unread count
        window.dispatchEvent(new Event("notifications_updated"));
      }
    } catch (_) {}
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetchWithCredentials(getApiUrl("/notifications/read-all"), {
        method: "POST",
      });
      if (res.ok) {
        fetchNotifications();
        window.dispatchEvent(new Event("notifications_updated"));
      }
    } catch (_) {}
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetchWithCredentials(getApiUrl(`/notifications/${id}`), {
        method: "DELETE",
      });
      if (res.ok) {
        fetchNotifications();
        window.dispatchEvent(new Event("notifications_updated"));
      }
    } catch (_) {}
  };

  const handlePreferenceToggle = async (key: keyof Preferences) => {
    if (!pref) return;
    setUpdatingPref(true);
    const updated = { ...pref, [key]: !pref[key] };
    try {
      const res = await fetchWithCredentials(getApiUrl("/notification-preferences"), {
        method: "PUT",
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setPref(await res.json());
      }
    } finally {
      setUpdatingPref(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "NEW_EPISODE": return "EPISODE";
      case "NEW_TRAILER": case "NEW_PV": return "TRAILER";
      case "PREMIERE": return "PREMIERE";
      case "REPLY_COMMENT": case "REPLY_REVIEW": return "REPLY";
      case "REVIEW_LIKE": return "LIKE";
      default: return "NOTIF";
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden pb-20">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-10 relative z-10 space-y-10">
        
        {/* Title & Filters */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-zinc-900/50 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              Notification Center
            </h1>
            <p className="text-zinc-400 mt-2">Manage your personalized anime alerts and preferences.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleMarkAllRead}
              className="text-xs px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold border border-zinc-800 transition-all"
            >
              Mark All Read
            </button>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setUnreadOnly(false)}
            className={`text-xs px-4 py-1.5 rounded-full font-bold border transition-all ${
              !unreadOnly 
                ? "bg-purple-500/10 border-purple-500/50 text-purple-400"
                : "border-zinc-850 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All Alerts
          </button>
          <button
            onClick={() => setUnreadOnly(true)}
            className={`text-xs px-4 py-1.5 rounded-full font-bold border transition-all ${
              unreadOnly 
                ? "bg-purple-500/10 border-purple-500/50 text-purple-400"
                : "border-zinc-850 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Unread Only
          </button>
        </div>

        {/* Alerts List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-400 text-sm font-medium">Scanning notification logs...</p>
          </div>
        ) : error ? (
          <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-6 text-center text-red-400">{error}</div>
        ) : notifications.length === 0 ? (
          <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-16 text-center text-zinc-500">
            <p className="text-lg font-bold">Inbox is empty</p>
            <p className="text-xs text-zinc-650 mt-1">You have no matching notifications at this time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex gap-4 items-start bg-zinc-900/30 border border-zinc-900 rounded-2xl p-4 hover:border-zinc-800 transition-all ${
                  !n.is_read ? "border-l-4 border-l-purple-500" : ""
                }`}
              >
                <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-purple-400 mt-0.5">
                  {getTypeIcon(n.notification_type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-zinc-200">{n.title}</h3>
                    {!n.is_read && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold uppercase tracking-wider">Unread</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">{n.message}</p>
                  
                  {/* Entity links if present */}
                  {n.entity_type === "anime" && n.entity_id && (
                    <Link
                      href={`/anime/slug-${n.entity_id}`}
                      className="inline-block mt-3 text-[10px] font-bold text-purple-400 hover:text-purple-300 transition-all uppercase tracking-wider"
                    >
                      View Details →
                    </Link>
                  )}

                  <p className="text-[10px] text-zinc-600 mt-2">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="text-[10px] font-bold text-purple-400 hover:underline px-2 py-1 rounded"
                    >
                      Mark Read
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="text-[10px] font-bold text-zinc-600 hover:text-red-400 px-2 py-1 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preferences Control Card */}
        {pref && (
          <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-zinc-200">Alert Configuration</h2>
              <p className="text-xs text-zinc-500 mt-1">Configure your email and browser delivery channels.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Category switches */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-2">Category Triggers</h3>
                {[
                  { key: "episodes_enabled", label: "Episode Release Alerts", desc: "Notify when followed anime episodes air." },
                  { key: "trailers_enabled", label: "Promotional & Trailer PVs", desc: "Notify when new trailers are added." },
                  { key: "movies_enabled", label: "Upcoming Premiere Alerts", desc: "Notify when movies release." },
                  { key: "replies_enabled", label: "Replies & Community Activity", desc: "Notify when comments receive replies." },
                  { key: "followers_enabled", label: "New Follower Alerts", desc: "Notify when users follow you." },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-zinc-300">{label}</p>
                      <p className="text-[10px] text-zinc-500">{desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={(pref as any)[key]}
                      disabled={updatingPref}
                      onChange={() => handlePreferenceToggle(key as any)}
                      className="rounded accent-purple-500 cursor-pointer h-4 w-4 mt-0.5"
                    />
                  </div>
                ))}
              </div>

              {/* Delivery Channels */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-2">Delivery Channels</h3>
                {[
                  { key: "emails_enabled", label: "Email Alerts", desc: "Receive email updates for alert events." },
                  { key: "push_enabled", label: "Browser Web Push Alerts", desc: "Receive real-time push events." },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-zinc-300">{label}</p>
                      <p className="text-[10px] text-zinc-500">{desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={(pref as any)[key]}
                      disabled={updatingPref}
                      onChange={() => handlePreferenceToggle(key as any)}
                      className="rounded accent-purple-500 cursor-pointer h-4 w-4 mt-0.5"
                    />
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
