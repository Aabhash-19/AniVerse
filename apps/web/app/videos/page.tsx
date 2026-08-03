"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import { getApiUrl } from "@/lib/auth";

interface Video {
  id: number;
  anime_id: number;
  provider: string;
  provider_video_id: string;
  video_type: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  language: string;
  confidence_score?: number;
}

interface SocialPost {
  id: string;
  content: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  embed?: {
    url?: string;
    title?: string;
    description?: string;
    site?: { name?: string };
    image?: { url?: string };
    video?: { url?: string };
  };
  user: {
    name: string;
    avatar?: string;
  };
  media?: {
    title?: string;
    poster?: string;
    slug?: string;
    youtube_video_id?: string;
  };
}

export default function VideosPage() {
  const [activeTab, setActiveTab] = useState<"videos" | "social">("videos");

  // Official Videos State
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [errorVideos, setErrorVideos] = useState("");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  // Kitsu Social Feed State
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [errorPosts, setErrorPosts] = useState("");

  const fetchVideos = async () => {
    setLoadingVideos(true);
    setErrorVideos("");
    try {
      const res = await fetch(getApiUrl("/videos"));
      if (!res.ok) throw new Error("Failed to load official videos library.");
      const data = await res.json();
      setVideos(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setErrorVideos(err.message || "An error occurred.");
    } finally {
      setLoadingVideos(false);
    }
  };

  const fetchSocialFeed = async () => {
    if (posts.length > 0) return;
    setLoadingPosts(true);
    setErrorPosts("");
    try {
      const res = await fetch(getApiUrl("/media/social-feed?page_limit=25"));
      if (!res.ok) throw new Error("Failed to load social feed.");
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setErrorPosts(err.message || "An error occurred fetching social feed.");
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    if (activeTab === "social") {
      fetchSocialFeed();
    }
  }, [activeTab]);

  // Helper to format relative time
  const formatTimeAgo = (dateStr: string) => {
    try {
      const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
      if (diff < 60) return "Just now";
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    } catch {
      return "";
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />

      <Header />

      <main className="max-w-6xl mx-auto px-6 py-10 relative z-10">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-zinc-900 pb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Official Media & Community Hub
            </h1>
            <p className="text-zinc-400 text-sm mt-2">
              Explore official anime trailers, promotional clips, and live community discussions.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 bg-zinc-900/60 p-1.5 rounded-2xl border border-zinc-850 self-start md:self-auto">
            <button
              onClick={() => setActiveTab("videos")}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "videos"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50"
              }`}
            >
              Official Trailers ({videos.length})
            </button>
            <button
              onClick={() => setActiveTab("social")}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "social"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50"
              }`}
            >
              Community Feed
            </button>
          </div>
        </div>

        {/* ── TAB 1: OFFICIAL VIDEOS ────────────────────────────────────────── */}

        {activeTab === "videos" && (
          <div>
            {loadingVideos ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-400 text-sm font-medium">Loading official trailers...</p>
              </div>
            ) : errorVideos ? (
              <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-6 text-center text-red-400">
                <p className="font-semibold">Error loading videos</p>
                <p className="text-sm mt-1">{errorVideos}</p>
              </div>
            ) : videos.length === 0 ? (
              <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-16 text-center text-zinc-500">
                <p className="text-zinc-300 font-bold text-lg">No official trailers found</p>
                <p className="text-xs text-zinc-500 mt-1">Trailers will automatically sync when catalogue updates.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {videos.map((vid) => {
                  const thumb = vid.thumbnail_url || `https://i.ytimg.com/vi/${vid.provider_video_id}/hqdefault.jpg`;
                  return (
                    <div
                      key={vid.id}
                      onClick={() => setActiveVideoId(vid.provider_video_id)}
                      className="cursor-pointer group flex flex-col bg-zinc-900/30 border border-zinc-900 hover:border-purple-500/40 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-2xl transition-all duration-300"
                    >
                      <div className="aspect-video w-full bg-zinc-950 relative overflow-hidden">
                        <img
                          src={thumb}
                          alt={vid.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            // Fallback if image fails
                            (e.target as HTMLElement).style.display = "none";
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {/* Play button overlay */}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-xl shadow-purple-900/50 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 fill-current ml-0.5" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                        <span className="absolute bottom-2.5 right-2.5 text-[9px] bg-black/80 px-2 py-0.5 rounded font-black tracking-wider uppercase text-zinc-300">
                          {vid.video_type || "TRAILER"}
                        </span>
                      </div>
                      <div className="p-4 flex flex-col gap-1.5">
                        <span className="text-sm font-bold text-zinc-200 line-clamp-1 group-hover:text-purple-400 transition-colors">
                          {vid.title}
                        </span>
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                          <span>YouTube Official</span>
                          {vid.confidence_score && (
                            <span className="text-purple-400 font-bold">
                              Verified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: COMMUNITY SOCIAL FEED (KITSU) ─────────────────────────── */}
        {activeTab === "social" && (
          <div className="max-w-3xl mx-auto space-y-6">
            {loadingPosts ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-400 text-sm font-medium">Syncing live community posts from Kitsu...</p>
              </div>
            ) : errorPosts ? (
              <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-6 text-center text-red-400">
                <p className="font-semibold">Error loading social feed</p>
                <p className="text-sm mt-1">{errorPosts}</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-16 text-center text-zinc-500">
                <p className="text-zinc-300 font-bold text-lg">No posts available right now</p>
              </div>
            ) : (
              posts.map((post) => (
                <div
                  key={post.id}
                  className="bg-zinc-900/30 border border-zinc-900/80 hover:border-zinc-800 rounded-2xl p-5 md:p-6 transition-all duration-300 flex flex-col gap-4 shadow-lg"
                >
                  {/* User Header & Tagged Anime */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {post.user.avatar ? (
                        <img
                          src={post.user.avatar}
                          alt={post.user.name}
                          className="w-10 h-10 rounded-full object-cover border border-zinc-800"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-300 font-bold text-sm">
                          {post.user.name[0] || "?"}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-bold text-zinc-200">{post.user.name}</div>
                        <div className="text-[11px] text-zinc-500 font-medium">
                          {formatTimeAgo(post.created_at)}
                        </div>
                      </div>
                    </div>

                    {/* Tagged Anime Badge */}
                    {post.media && (
                      <div className="flex items-center gap-2 bg-zinc-950/80 border border-zinc-850 px-3 py-1.5 rounded-xl max-w-[200px] sm:max-w-xs">
                        {post.media.poster && (
                          <img
                            src={post.media.poster}
                            alt={post.media.title || "Anime"}
                            className="w-5 h-7 rounded object-cover flex-shrink-0"
                          />
                        )}
                        <span className="text-xs font-bold text-purple-400 truncate">
                          {post.media.title}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Post Content */}
                  <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line font-normal">
                    {post.content}
                  </div>

                  {/* Media Embed / Image preview if present */}
                  {post.embed && (
                    <div className="mt-1 rounded-xl overflow-hidden border border-zinc-850 bg-zinc-950/60 p-3 flex flex-col gap-2">
                      {post.embed.image?.url && (
                        <img
                          src={post.embed.image.url}
                          alt={post.embed.title || "Embedded Media"}
                          className="w-full max-h-80 object-cover rounded-lg"
                        />
                      )}
                      {post.embed.title && (
                        <span className="text-xs font-bold text-zinc-200">{post.embed.title}</span>
                      )}
                      {post.embed.description && (
                        <span className="text-[11px] text-zinc-500 line-clamp-2">{post.embed.description}</span>
                      )}
                      {post.embed.video?.url && (
                        <button
                          onClick={() => {
                            const ytMatch = post.embed?.url?.match(/(?:v=|\/)([\w-]{11})/);
                            if (ytMatch && ytMatch[1]) setActiveVideoId(ytMatch[1]);
                          }}
                          className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/40 rounded-lg text-xs font-bold text-purple-300 w-fit transition-all"
                        >
                          ▶ Watch Embedded Video
                        </button>
                      )}
                    </div>
                  )}

                  {/* Interaction Footer */}
                  <div className="flex items-center gap-6 pt-3 border-t border-zinc-900/60 text-xs font-semibold text-zinc-500">
                    <div className="flex items-center gap-1.5 hover:text-zinc-300 transition-colors">
                      <span></span>
                      <span>{post.comments_count} Comments</span>
                    </div>
                    <div className="flex items-center gap-1.5 hover:text-purple-400 transition-colors">
                      <span>️</span>
                      <span>{post.likes_count} Likes</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Modal Video Player */}
      {activeVideoId && (
        <div
          onClick={() => setActiveVideoId(null)}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 md:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative"
          >
            <button
              onClick={() => setActiveVideoId(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/80 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center text-lg font-bold transition-all"
            >
              ×
            </button>
            <iframe
              src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1&enablejsapi=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
