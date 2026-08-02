"use client";

import React, { useState, useEffect, useRef } from "react";
import { fetchWithCredentials, getApiUrl } from "@/lib/auth";
import Link from "next/link";

interface ReviewUser {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

interface Review {
  id: string;
  anime_id: number;
  score?: number;
  body: string;
  has_spoiler: boolean;
  status: string;
  helpful_count: number;
  created_at: string;
  user: ReviewUser;
  reaction_counts: Record<string, number>;
  user_reaction?: string;
}

interface ReviewsSectionProps {
  animeId: number;
  currentUser: any;
}

const REACTION_EMOJIS: Record<string, string> = {
  LIKE: "👍",
  LOVE: "❤️",
  INSIGHTFUL: "💡",
  FUNNY: "😂",
};

function SpoilerBlock({ body }: { body: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="relative">
      <div className={`transition-all duration-300 ${!revealed ? "blur-sm select-none pointer-events-none" : ""}`}>
        <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{body}</p>
      </div>
      {!revealed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span className="text-xs font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full">⚠️ Spoiler</span>
          <button
            onClick={() => setRevealed(true)}
            className="text-xs text-zinc-400 hover:text-zinc-200 font-semibold underline"
          >
            Click to reveal
          </button>
        </div>
      )}
    </div>
  );
}

export default function ReviewsSection({ animeId, currentUser }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reportingId, setReportingId] = useState<string | null>(null);
  
  // Form state
  const [score, setScore] = useState<string>("");
  const [body, setBody] = useState("");
  const [hasSpoiler, setHasSpoiler] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/anime/${animeId}/reviews?per_page=10`));
      if (res.ok) {
        const data = await res.json();
        setReviews(data.items);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [animeId]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (body.trim().length < 20) {
      setFormError("Review must be at least 20 characters.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetchWithCredentials(getApiUrl(`/anime/${animeId}/reviews`), {
        method: "POST",
        body: JSON.stringify({
          body: body.trim(),
          score: score ? parseInt(score) : null,
          has_spoiler: hasSpoiler,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setBody("");
        setScore("");
        setHasSpoiler(false);
        fetchReviews();
      } else {
        const err = await res.json();
        setFormError(err.detail || "Failed to submit review.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReact = async (reviewId: string, reaction: string) => {
    if (!currentUser) return;
    await fetchWithCredentials(getApiUrl(`/reviews/${reviewId}/react/${reaction}`), {
      method: "PUT",
    });
    fetchReviews();
  };

  const handleReport = async (reviewId: string) => {
    if (!currentUser) { alert("Please log in to report content."); return; }
    const reason = prompt("Report reason?\n1. SPAM\n2. HARASSMENT\n3. SPOILER\n4. INAPPROPRIATE\n5. OTHER\n\nEnter reason:");
    if (!reason) return;
    const reasonMap: Record<string, string> = { "1": "SPAM", "2": "HARASSMENT", "3": "SPOILER", "4": "INAPPROPRIATE", "5": "OTHER" };
    const mappedReason = reasonMap[reason] || reason.toUpperCase();
    const res = await fetchWithCredentials(getApiUrl("/reports"), {
      method: "POST",
      body: JSON.stringify({ target_type: "review", target_id: reviewId, reason: mappedReason }),
    });
    if (res.ok) alert("Report submitted. Thank you!");
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm("Delete this review?")) return;
    await fetchWithCredentials(getApiUrl(`/reviews/${reviewId}`), { method: "DELETE" });
    fetchReviews();
  };

  const scoreColor = (s?: number) => {
    if (!s) return "text-zinc-500";
    if (s >= 75) return "text-green-400";
    if (s >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-zinc-200">
          Reviews
          <span className="ml-2 text-sm font-normal text-zinc-500">({total})</span>
        </h2>
        {currentUser && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all"
          >
            Write Review
          </button>
        )}
      </div>

      {/* Review Form */}
      {showForm && (
        <form
          onSubmit={handleSubmitReview}
          className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 space-y-4"
        >
          <h3 className="text-sm font-bold text-zinc-200">Your Review</h3>

          <div className="flex items-center gap-3">
            <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider w-16">Score</label>
            <input
              type="number"
              min={1}
              max={100}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="1–100 (optional)"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-purple-500"
            />
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your review... (min 20 characters)"
            rows={5}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-purple-500 resize-none"
          />

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="spoiler-flag"
              checked={hasSpoiler}
              onChange={(e) => setHasSpoiler(e.target.checked)}
              className="rounded accent-purple-500"
            />
            <label htmlFor="spoiler-flag" className="text-xs text-zinc-400 font-medium">
              This review contains spoilers
            </label>
          </div>

          {formError && <p className="text-xs text-red-400 font-medium">{formError}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all"
            >
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(""); }}
              className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Review List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-8 text-center">
          <p className="text-zinc-500 text-sm">No reviews yet. Be the first to review this anime!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-zinc-900/30 border border-zinc-900 hover:border-zinc-800 rounded-2xl p-5 transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-black text-zinc-400 overflow-hidden flex-shrink-0">
                    {review.user.avatar_url ? (
                      <img src={review.user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      review.user.username[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-300">{review.user.display_name || review.user.username}</p>
                    <p className="text-[10px] text-zinc-600">{new Date(review.created_at).toLocaleDateString()}</p>
                  </div>
                  {review.score && (
                    <span className={`text-sm font-black ml-1 ${scoreColor(review.score)}`}>
                      {review.score}<span className="text-xs font-normal text-zinc-500">/100</span>
                    </span>
                  )}
                </div>
                {review.has_spoiler && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-black uppercase tracking-wider flex-shrink-0">
                    Spoiler
                  </span>
                )}
              </div>

              {review.has_spoiler ? (
                <SpoilerBlock body={review.body} />
              ) : (
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{review.body}</p>
              )}

              {/* Reactions & Actions */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {Object.entries(REACTION_EMOJIS).map(([key, emoji]) => (
                    <button
                      key={key}
                      onClick={() => handleReact(review.id, key)}
                      disabled={!currentUser}
                      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-all ${
                        review.user_reaction === key
                          ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                          : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                      } disabled:cursor-default`}
                    >
                      <span>{emoji}</span>
                      {review.reaction_counts[key] ? (
                        <span className="font-bold">{review.reaction_counts[key]}</span>
                      ) : null}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {currentUser && currentUser.id !== review.user.id && (
                    <button
                      onClick={() => handleReport(review.id)}
                      className="text-[10px] text-zinc-600 hover:text-red-400 transition-all font-medium"
                    >
                      Report
                    </button>
                  )}
                  {currentUser && currentUser.id === review.user.id && (
                    <button
                      onClick={() => handleDelete(review.id)}
                      className="text-[10px] text-zinc-600 hover:text-red-400 transition-all font-medium"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
