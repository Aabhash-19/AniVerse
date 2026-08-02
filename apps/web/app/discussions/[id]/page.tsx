"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { fetchWithCredentials, getApiUrl } from "@/lib/auth";

interface CommentUser {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

interface Comment {
  id: string;
  discussion_id: string;
  parent_id?: string | null;
  body: string;
  has_spoiler: boolean;
  status: string;
  like_count: number;
  created_at: string;
  reply_count: number;
  user: CommentUser;
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
  user: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
}

function CommentItem({
  comment,
  currentUser,
  onReplyAdded,
  onCommentLiked,
  onCommentDeleted,
  onCommentReported,
}: {
  comment: Comment;
  currentUser: any;
  onReplyAdded: () => void;
  onCommentLiked: (commentId: string) => void;
  onCommentDeleted: (commentId: string) => void;
  onCommentReported: (commentId: string) => void;
}) {
  const [replies, setReplies] = useState<Comment[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyHasSpoiler, setReplyHasSpoiler] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);

  const fetchReplies = async () => {
    setLoadingReplies(true);
    try {
      const res = await fetch(getApiUrl(`/comments/${comment.id}/replies`));
      if (res.ok) {
        const data = await res.json();
        setReplies(data);
      }
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleToggleReplies = () => {
    const nextState = !showReplies;
    setShowReplies(nextState);
    if (nextState && replies.length === 0) {
      fetchReplies();
    }
  };

  const handleCreateReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSubmittingReply(true);
    try {
      const res = await fetchWithCredentials(
        getApiUrl(`/discussions/${comment.discussion_id}/comments`),
        {
          method: "POST",
          body: JSON.stringify({
            body: replyBody.trim(),
            has_spoiler: replyHasSpoiler,
            parent_id: comment.id,
          }),
        }
      );
      if (res.ok) {
        setReplyBody("");
        setReplyHasSpoiler(false);
        setShowReplyForm(false);
        fetchReplies();
        onReplyAdded();
        setShowReplies(true);
      }
    } finally {
      setSubmittingReply(false);
    }
  };

  const isAuthor = currentUser?.id === comment.user.id;
  const isSpoiler = comment.has_spoiler && !spoilerRevealed;

  return (
    <div className="border-l-2 border-zinc-800/80 pl-4 py-1 space-y-3">
      <div className="bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-4 space-y-2">
        {/* Author / Timestamp */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-400 overflow-hidden flex-shrink-0">
              {comment.user.avatar_url ? (
                <img src={comment.user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                comment.user.username[0].toUpperCase()
              )}
            </div>
            <span className="text-xs font-bold text-zinc-300">
              {comment.user.display_name || comment.user.username}
            </span>
            <span className="text-[10px] text-zinc-600">
              {new Date(comment.created_at).toLocaleDateString()}
            </span>
          </div>
          {comment.has_spoiler && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-bold uppercase tracking-wider">
              Spoiler
            </span>
          )}
        </div>

        {/* Comment Body */}
        {comment.status === "HIDDEN" ? (
          <p className="text-xs italic text-zinc-600">[Content hidden by moderator]</p>
        ) : isSpoiler ? (
          <div className="bg-zinc-950/40 rounded-xl p-3 border border-zinc-900/80 flex items-center justify-between gap-4">
            <span className="text-xs text-zinc-500 font-medium">⚠️ This comment contains spoilers</span>
            <button
              onClick={() => setSpoilerRevealed(true)}
              className="text-xs text-yellow-500 hover:text-yellow-400 font-bold underline"
            >
              Reveal
            </button>
          </div>
        ) : (
          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{comment.body}</p>
        )}

        {/* Comment Interactions */}
        <div className="flex items-center justify-between pt-1 border-t border-zinc-900/20 text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onCommentLiked(comment.id)}
              disabled={!currentUser}
              className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 font-medium"
            >
              ❤️ <span className="font-bold">{comment.like_count}</span>
            </button>
            <button
              onClick={() => handleToggleReplies()}
              className="text-zinc-500 hover:text-zinc-300 font-medium"
            >
              💬 {comment.reply_count || replies.length} {comment.reply_count === 1 ? "Reply" : "Replies"}
            </button>
            {currentUser && !isAuthor && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="text-zinc-500 hover:text-purple-400 font-medium"
              >
                Reply
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentUser && !isAuthor && (
              <button
                onClick={() => onCommentReported(comment.id)}
                className="text-[10px] text-zinc-600 hover:text-red-400 font-medium"
              >
                Report
              </button>
            )}
            {currentUser && (isAuthor || currentUser.role === "MODERATOR" || currentUser.role === "ADMIN") && (
              <button
                onClick={() => onCommentDeleted(comment.id)}
                className="text-[10px] text-zinc-600 hover:text-red-400 font-medium"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reply creation form */}
      {showReplyForm && (
        <form onSubmit={handleCreateReply} className="pl-4 space-y-2">
          <textarea
            placeholder="Type your reply..."
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            rows={2}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 text-zinc-200 resize-none"
          />
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`spoiler-reply-${comment.id}`}
                checked={replyHasSpoiler}
                onChange={(e) => setReplyHasSpoiler(e.target.checked)}
                className="accent-purple-500"
              />
              <label htmlFor={`spoiler-reply-${comment.id}`} className="text-xs text-zinc-500 select-none">
                Contains spoilers
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submittingReply || !replyBody.trim()}
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all"
              >
                {submittingReply ? "Posting..." : "Reply"}
              </button>
              <button
                type="button"
                onClick={() => setShowReplyForm(false)}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Nested Replies tree rendering */}
      {showReplies && (
        <div className="pl-4 space-y-3 border-l border-zinc-800/40">
          {loadingReplies ? (
            <div className="py-2 text-xs text-zinc-500">Loading replies...</div>
          ) : replies.length === 0 ? (
            <div className="py-2 text-xs text-zinc-500 italic">No replies yet.</div>
          ) : (
            replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUser={currentUser}
                onReplyAdded={fetchReplies}
                onCommentLiked={onCommentLiked}
                onCommentDeleted={onCommentDeleted}
                onCommentReported={onCommentReported}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function DiscussionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: discussionId } = use(params);

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // New comment input form
  const [commentBody, setCommentBody] = useState("");
  const [commentHasSpoiler, setCommentHasSpoiler] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [formError, setFormError] = useState("");
  const [bodySpoilerRevealed, setBodySpoilerRevealed] = useState(false);

  const checkUser = async () => {
    try {
      const res = await fetchWithCredentials(getApiUrl("/auth/me"));
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
      }
    } catch (e) {
      console.log("Viewer is guest user.");
    }
  };

  const fetchDiscussion = async () => {
    try {
      const res = await fetch(getApiUrl(`/discussions/${discussionId}`));
      if (res.ok) {
        const data = await res.json();
        setDiscussion(data);
      } else {
        router.push("/discover");
      }
    } catch (e) {
      router.push("/discover");
    }
  };

  const fetchComments = async () => {
    try {
      const res = await fetch(getApiUrl(`/discussions/${discussionId}/comments?per_page=50`));
      if (res.ok) {
        const data = await res.json();
        setComments(data.items);
      }
    } finally {
      setLoading(false);
    }
  };

  const initData = async () => {
    setLoading(true);
    await checkUser();
    await fetchDiscussion();
    await fetchComments();
  };

  useEffect(() => {
    initData();
  }, [discussionId]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setSubmittingComment(true);
    setFormError("");
    try {
      const res = await fetchWithCredentials(getApiUrl(`/discussions/${discussionId}/comments`), {
        method: "POST",
        body: JSON.stringify({
          body: commentBody.trim(),
          has_spoiler: commentHasSpoiler,
        }),
      });
      if (res.ok) {
        setCommentBody("");
        setCommentHasSpoiler(false);
        fetchComments();
        // Update local discussion comment count locally
        if (discussion) {
          setDiscussion({ ...discussion, comment_count: discussion.comment_count + 1 });
        }
      } else {
        const err = await res.json();
        setFormError(err.detail || "Failed to post comment.");
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCommentLiked = async (commentId: string) => {
    try {
      const res = await fetchWithCredentials(getApiUrl(`/comments/${commentId}/like`), {
        method: "PUT",
      });
      if (res.ok) {
        const data = await res.json();
        setComments(prev =>
          prev.map(c => c.id === commentId ? { ...c, like_count: data.like_count } : c)
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCommentDeleted = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    try {
      const res = await fetchWithCredentials(getApiUrl(`/comments/${commentId}`), {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        setComments(prev => prev.filter(c => c.id !== commentId));
        if (discussion) {
          setDiscussion({ ...discussion, comment_count: Math.max(0, discussion.comment_count - 1) });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCommentReported = async (commentId: string) => {
    const reason = prompt("Report reason?\n1. SPAM\n2. HARASSMENT\n3. SPOILER\n4. INAPPROPRIATE\n5. OTHER\n\nEnter code (1-5):");
    if (!reason) return;
    const reasonMap: Record<string, string> = { "1": "SPAM", "2": "HARASSMENT", "3": "SPOILER", "4": "INAPPROPRIATE", "5": "OTHER" };
    const mappedReason = reasonMap[reason] || "OTHER";

    try {
      const res = await fetchWithCredentials(getApiUrl("/reports"), {
        method: "POST",
        body: JSON.stringify({
          target_type: "comment",
          target_id: commentId,
          reason: mappedReason,
        }),
      });
      if (res.ok) {
        alert("Thank you. The comment has been reported.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReportDiscussion = async () => {
    if (!discussion) return;
    const reason = prompt("Report reason?\n1. SPAM\n2. HARASSMENT\n3. SPOILER\n4. INAPPROPRIATE\n5. OTHER\n\nEnter code (1-5):");
    if (!reason) return;
    const reasonMap: Record<string, string> = { "1": "SPAM", "2": "HARASSMENT", "3": "SPOILER", "4": "INAPPROPRIATE", "5": "OTHER" };
    const mappedReason = reasonMap[reason] || "OTHER";

    try {
      const res = await fetchWithCredentials(getApiUrl("/reports"), {
        method: "POST",
        body: JSON.stringify({
          target_type: "discussion",
          target_id: discussion.id,
          reason: mappedReason,
        }),
      });
      if (res.ok) {
        alert("This thread has been reported. Moderators will review it shortly.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteDiscussion = async () => {
    if (!discussion || !confirm("Are you sure you want to delete this discussion thread?")) return;
    try {
      const res = await fetchWithCredentials(getApiUrl(`/discussions/${discussion.id}`), {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        router.push("/discover");
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading && !discussion) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-500 text-sm font-medium">Loading thread details...</p>
      </div>
    );
  }

  if (!discussion) return null;

  const isThreadOwner = currentUser?.id === discussion.user.id;
  const isSpoilerBody = discussion.has_spoiler && !bodySpoilerRevealed;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden pb-20">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-10 relative z-10 space-y-6">
        {/* Navigation back */}
        <div>
          <Link
            href="/discover"
            className="text-xs text-zinc-500 hover:text-zinc-300 font-bold transition-all"
          >
            ← Back to Discovery
          </Link>
        </div>

        {/* Main Thread Card */}
        <article className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {discussion.is_pinned && (
              <span className="text-[9px] px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/30 text-purple-400 font-black">
                📌 PINNED
              </span>
            )}
            {discussion.episode && (
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-zinc-850 border border-zinc-800 text-zinc-400 font-bold">
                Episode {discussion.episode}
              </span>
            )}
            {discussion.has_spoiler && (
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-black">
                ⚠️ SPOILERS
              </span>
            )}
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-100">
            {discussion.title}
          </h1>

          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="font-semibold text-zinc-400">
              by @{discussion.user.username}
            </span>
            <span>•</span>
            <span>👁️ {discussion.view_count} views</span>
            <span>•</span>
            <span>{new Date(discussion.created_at).toLocaleDateString()}</span>
          </div>

          {/* Description Body */}
          <div className="pt-2 border-t border-zinc-800/60">
            {discussion.status === "HIDDEN" ? (
              <p className="text-sm italic text-zinc-600">[Discussion content hidden by moderator]</p>
            ) : isSpoilerBody ? (
              <div className="bg-zinc-950/60 rounded-xl p-5 border border-zinc-900/80 flex flex-col items-center justify-center gap-3">
                <span className="text-sm text-zinc-400 font-medium">⚠️ This thread description contains spoilers</span>
                <button
                  onClick={() => setBodySpoilerRevealed(true)}
                  className="text-xs px-4 py-1.5 rounded-lg bg-yellow-600/10 border border-yellow-500/20 text-yellow-400 font-bold hover:bg-yellow-600 hover:text-white transition-all"
                >
                  Reveal Content
                </button>
              </div>
            ) : (
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{discussion.body}</p>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-850/40 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-zinc-500 font-bold uppercase tracking-wider">
                💬 {discussion.comment_count} Comments
              </span>
            </div>
            <div className="flex items-center gap-3">
              {currentUser && !isThreadOwner && (
                <button
                  onClick={handleReportDiscussion}
                  className="text-zinc-500 hover:text-red-400 font-semibold"
                >
                  Report Thread
                </button>
              )}
              {currentUser && (isThreadOwner || currentUser.role === "MODERATOR" || currentUser.role === "ADMIN") && (
                <button
                  onClick={handleDeleteDiscussion}
                  className="text-zinc-500 hover:text-red-400 font-semibold"
                >
                  Delete Thread
                </button>
              )}
            </div>
          </div>
        </article>

        {/* Comment form */}
        {currentUser ? (
          <form onSubmit={handlePostComment} className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-zinc-200">Post Comment</h3>
            <textarea
              placeholder="Add to the conversation..."
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={4}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 text-zinc-200 resize-none"
            />
            {formError && <p className="text-xs text-red-400 font-medium">{formError}</p>}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="main-comment-spoiler"
                  checked={commentHasSpoiler}
                  onChange={(e) => setCommentHasSpoiler(e.target.checked)}
                  className="accent-purple-500"
                />
                <label htmlFor="main-comment-spoiler" className="text-xs text-zinc-400 select-none">
                  My comment contains spoilers
                </label>
              </div>
              <button
                type="submit"
                disabled={submittingComment || !commentBody.trim()}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all"
              >
                {submittingComment ? "Posting..." : "Post Comment"}
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-2xl p-6 text-center text-zinc-500 text-sm">
            Please <Link href="/login" className="text-purple-400 hover:underline">log in</Link> to post comments or replies.
          </div>
        )}

        {/* Comments section */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-zinc-200">Conversation</h2>
          {comments.length === 0 ? (
            <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-8 text-center text-zinc-500 text-sm">
              No comments yet. Start the discussion!
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUser={currentUser}
                  onReplyAdded={fetchComments}
                  onCommentLiked={handleCommentLiked}
                  onCommentDeleted={handleCommentDeleted}
                  onCommentReported={handleCommentReported}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
