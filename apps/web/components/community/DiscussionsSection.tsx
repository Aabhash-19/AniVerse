"use client";

import React, { useState, useEffect } from "react";
import { fetchWithCredentials, getApiUrl } from "@/lib/auth";
import Link from "next/link";

interface DiscussionUser {
  id: string;
  username: string;
  display_name?: string;
}

interface Discussion {
  id: string;
  anime_id: number;
  episode?: number;
  title: string;
  body: string;
  has_spoiler: boolean;
  is_pinned: boolean;
  status: string;
  comment_count: number;
  view_count: number;
  created_at: string;
  user: DiscussionUser;
}

interface DiscussionsSectionProps {
  animeId: number;
  currentUser: any;
}

function SpoilerPreview({ title, body, hasSpoiler }: { title: string; body: string; hasSpoiler: boolean }) {
  const [revealed, setRevealed] = useState(false);
  if (!hasSpoiler || revealed) {
    return <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{body}</p>;
  }
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-black">️ Spoiler</span>
      <button onClick={() => setRevealed(true)} className="text-[10px] text-zinc-500 hover:text-zinc-300 underline">Reveal preview</button>
    </div>
  );
}

export default function DiscussionsSection({ animeId, currentUser }: DiscussionsSectionProps) {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [episodeFilter, setEpisodeFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [episode, setEpisode] = useState("");
  const [hasSpoiler, setHasSpoiler] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchDiscussions = async () => {
    setLoading(true);
    try {
      const ep = episodeFilter ? `&episode=${episodeFilter}` : "";
      const res = await fetchWithCredentials(getApiUrl(`/anime/${animeId}/discussions?per_page=10${ep}`));
      if (res.ok) {
        const data = await res.json();
        setDiscussions(data.items);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscussions();
  }, [animeId, episodeFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 5) { setFormError("Title must be at least 5 characters."); return; }
    if (body.trim().length < 10) { setFormError("Description must be at least 10 characters."); return; }
    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetchWithCredentials(getApiUrl(`/anime/${animeId}/discussions`), {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          episode: episode ? parseInt(episode) : null,
          has_spoiler: hasSpoiler,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setTitle(""); setBody(""); setEpisode(""); setHasSpoiler(false);
        fetchDiscussions();
      } else {
        const err = await res.json();
        setFormError(err.detail || "Failed to create discussion.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-zinc-200">
          Discussions
          <span className="ml-2 text-sm font-normal text-zinc-500">({total})</span>
        </h2>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Episode #"
            value={episodeFilter}
            onChange={(e) => setEpisodeFilter(e.target.value)}
            className="w-24 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-purple-500 text-zinc-300"
          />
          {currentUser && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="text-xs px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all"
            >
              New Thread
            </button>
          )}
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-zinc-200">New Discussion</h3>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Thread title (required)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-500 text-zinc-200"
            />
            <input
              type="number"
              placeholder="Ep #"
              value={episode}
              onChange={(e) => setEpisode(e.target.value)}
              className="w-20 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500 text-zinc-200"
            />
          </div>
          <textarea
            placeholder="What's on your mind? (min 10 chars)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 text-zinc-200 resize-none"
          />
          <div className="flex items-center gap-3">
            <input type="checkbox" id="disc-spoiler" checked={hasSpoiler} onChange={(e) => setHasSpoiler(e.target.checked)} className="accent-purple-500" />
            <label htmlFor="disc-spoiler" className="text-xs text-zinc-400">Contains spoilers</label>
          </div>
          {formError && <p className="text-xs text-red-400">{formError}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all">
              {submitting ? "Posting..." : "Post Thread"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setFormError(""); }} className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Discussion List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : discussions.length === 0 ? (
        <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-8 text-center">
          <p className="text-zinc-500 text-sm">No discussions yet. Start the first thread!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {discussions.map((disc) => (
            <Link
              key={disc.id}
              href={`/discussions/${disc.id}`}
              className="group block bg-zinc-900/30 border border-zinc-900 hover:border-zinc-700 rounded-xl p-4 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {disc.is_pinned && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-black">PINNED</span>
                    )}
                    {disc.episode && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 font-bold">
                        Ep {disc.episode}
                      </span>
                    )}
                    {disc.has_spoiler && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-black">SPOILER</span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-zinc-200 group-hover:text-white mt-1 line-clamp-1">{disc.title}</p>
                  <SpoilerPreview title={disc.title} body={disc.body} hasSpoiler={disc.has_spoiler} />
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-600">
                    <span>by <Link href={`/profile/${disc.user.username}`} onClick={(e) => e.stopPropagation()} className="text-zinc-400 font-semibold hover:text-purple-400 transition-colors">{disc.user.username}</Link></span>
                    <span>{disc.comment_count} comments</span>
                    <span>{disc.view_count} views</span>
                    <span>{new Date(disc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
