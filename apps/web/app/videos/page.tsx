"use client";

import React, { useState, useEffect, useCallback } from "react";
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

// ─── NAMI'S LOUNGE DATA ───────────────────────────────────────────────────────

const NAMI_NEWS = [
  {
    id: 1,
    type: "LORE",
    title: "Nami's Vivre Card Reveal",
    body: "The official Vivre Card databook confirms Nami's dream: to chart a complete map of the entire world — every island, every sea, every unknown horizon.",
    tag: "Character Lore",
  },
  {
    id: 2,
    type: "ARC",
    title: "Wano Arc: Nami's Role",
    body: "In Wano, Nami wields Zeus — the homie formerly loyal to Big Mom — as her signature weapon. Zeus now fights alongside the Straw Hats, amplifying Nami's Clima-Tact attacks to devastating effect.",
    tag: "Story Arc",
  },
  {
    id: 3,
    type: "POWER",
    title: "Clima-Tact Evolution",
    body: "From a simple weather staff gifted by Usopp, the Clima-Tact has evolved into the Sorcery Clima-Tact and now an Evolved version powered by Zeus's electricity, making Nami one of the crew's most versatile fighters.",
    tag: "Power-Up",
  },
  {
    id: 4,
    type: "FACT",
    title: "Navigator of the Straw Hats",
    body: "Nami is the official Navigator of the Straw Hat Grand Fleet. Without her log pose expertise, weather prediction, and navigation charts, the crew would be utterly lost on the Grand Line and New World.",
    tag: "Crew Role",
  },
  {
    id: 5,
    type: "TRIVIA",
    title: "Nami and Oranges",
    body: "Nami's village Cocoyasi was famous for its tangerine groves. She carries that symbolism everywhere — from her tattoo (originally the Arlong Pirates mark, replaced with a tangerine pinwheel) to her ship figurehead.",
    tag: "Fun Trivia",
  },
  {
    id: 6,
    type: "DESIGN",
    title: "Post-Timeskip Design",
    body: "After the 2-year timeskip, Nami's design reflects her growth: longer hair, a more mature outfit, and a new Clima-Tact. Oda stated her updated look was inspired by making her feel like a fully seasoned sailor.",
    tag: "Character Design",
  },
];

const NAMI_VIDEOS = [
  {
    id: "nami-1",
    ytId: "dhG-G1VTBpA",
    title: "Nami's Best Moments Compilation",
    desc: "Top Nami moments across the One Piece saga",
    tag: "Fan Edit",
  },
  {
    id: "nami-2",
    ytId: "0e3GPea1Tyg",
    title: "One Piece Official Trailer 2024",
    desc: "Latest official One Piece promotional trailer",
    tag: "Official Trailer",
  },
  {
    id: "nami-3",
    ytId: "FwEYmcz50Qo",
    title: "Nami vs Big Mom — Clima-Tact Unleashed",
    desc: "Nami's Zeus Clima-Tact vs Big Mom in Wano",
    tag: "Battle Clip",
  },
  {
    id: "nami-4",
    ytId: "XMaVW4G7h7Y",
    title: "One Piece Netflix Live Action — Nami Introduction",
    desc: "Emily Rudd as Nami in the Netflix adaptation",
    tag: "Live Action",
  },
  {
    id: "nami-5",
    ytId: "rBYM9pLiDFo",
    title: "One Piece Opening 25 — 'Raise'",
    desc: "The iconic Straw Hats feature in their latest opening",
    tag: "Opening",
  },
  {
    id: "nami-6",
    ytId: "MXoah07Ngas",
    title: "Nami Character Song — Dream",
    desc: "Nami's official character song from the One Piece soundtrack",
    tag: "Soundtrack",
  },
];

// ─── QUIZ GAME DATA ───────────────────────────────────────────────────────────

const QUIZ_QUESTIONS = [
  {
    question: "What is Nami's dream?",
    options: [
      "To become King of the Pirates",
      "To draw a map of the entire world",
      "To find the All Blue",
      "To become the world's greatest swordsman",
    ],
    correct: 1,
    explanation: "Nami's lifelong dream is to chart a complete map of the entire world — every sea, every island, every uncharted horizon.",
  },
  {
    question: "What weapon does Nami use as her primary tool in battle?",
    options: ["Sword", "Cannon", "Clima-Tact", "Log Pose"],
    correct: 2,
    explanation: "Nami wields the Clima-Tact, a staff that harnesses atmospheric phenomena to generate weather-based attacks.",
  },
  {
    question: "Which homie now fights alongside Nami after Wano?",
    options: ["Prometheus", "Zeus", "Napoleon", "Hera"],
    correct: 1,
    explanation: "Zeus, formerly Big Mom's lightning cloud homie, now loyally serves Nami and powers her Evolved Clima-Tact.",
  },
  {
    question: "What village did Nami grow up in?",
    options: ["Foosha Village", "Cocoyasi Village", "Syrup Village", "Loguetown"],
    correct: 1,
    explanation: "Nami grew up in Cocoyasi Village — famous for its tangerine groves, which deeply influenced her identity and tattoo design.",
  },
  {
    question: "Who gave Nami her original Clima-Tact weapon?",
    options: ["Luffy", "Zoro", "Usopp", "Nami built it herself"],
    correct: 2,
    explanation: "Usopp built and gifted Nami the original Clima-Tact before the Alabasta arc, starting her iconic weapon's legacy.",
  },
  {
    question: "What role does Nami hold on the Straw Hat crew?",
    options: ["Doctor", "Cook", "Navigator", "Archaeologist"],
    correct: 2,
    explanation: "Nami is the Navigator of the Straw Hat Pirates — the most important position for sailing the Grand Line.",
  },
];

export default function VideosPage() {
  const [activeTab, setActiveTab] = useState<"videos" | "social" | "nami">("videos");

  // Official Videos State
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [errorVideos, setErrorVideos] = useState("");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  // Kitsu Social Feed State
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [errorPosts, setErrorPosts] = useState("");

  // Quiz State
  const [quizActive, setQuizActive] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizFinished, setQuizFinished] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

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
    if (activeTab === "social") fetchSocialFeed();
  }, [activeTab]);

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

  // ── Quiz Handlers ──────────────────────────────────────────────────────────
  const startQuiz = () => {
    setQuizActive(true);
    setQuizIndex(0);
    setQuizScore(0);
    setSelectedAnswer(null);
    setQuizFinished(false);
    setShowExplanation(false);
  };

  const handleAnswer = (idx: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx);
    setShowExplanation(true);
    if (idx === QUIZ_QUESTIONS[quizIndex].correct) setQuizScore((s) => s + 1);
  };

  const nextQuestion = () => {
    if (quizIndex + 1 >= QUIZ_QUESTIONS.length) {
      setQuizFinished(true);
    } else {
      setQuizIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  const newsTagColor: Record<string, string> = {
    "Character Lore": "bg-purple-500/20 border-purple-500/40 text-purple-300",
    "Story Arc": "bg-blue-500/20 border-blue-500/40 text-blue-300",
    "Power-Up": "bg-amber-500/20 border-amber-500/40 text-amber-300",
    "Crew Role": "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
    "Fun Trivia": "bg-pink-500/20 border-pink-500/40 text-pink-300",
    "Character Design": "bg-cyan-500/20 border-cyan-500/40 text-cyan-300",
  };

  const videoTagColor: Record<string, string> = {
    "Fan Edit": "bg-purple-500/20 text-purple-300",
    "Official Trailer": "bg-amber-500/20 text-amber-300",
    "Battle Clip": "bg-red-500/20 text-red-300",
    "Live Action": "bg-emerald-500/20 text-emerald-300",
    Opening: "bg-blue-500/20 text-blue-300",
    Soundtrack: "bg-pink-500/20 text-pink-300",
  };

  const scoreMessage = () => {
    const pct = quizScore / QUIZ_QUESTIONS.length;
    if (pct === 1) return "Perfect! You know Nami better than she knows herself!";
    if (pct >= 0.8) return "Outstanding! Nami would trust you as her co-navigator.";
    if (pct >= 0.6) return "Good job! You've clearly sailed the Grand Line before.";
    if (pct >= 0.4) return "Not bad — time for a deeper dive into the One Piece archives!";
    return "Keep watching! Nami's story is worth every episode.";
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-900/5 rounded-full blur-[120px] pointer-events-none" />

      <Header />

      <main className="max-w-6xl mx-auto px-6 py-10 relative z-10">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-zinc-900 pb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Official Media &amp; Community Hub
            </h1>
            <p className="text-zinc-400 text-sm mt-2">
              Explore official anime trailers, promotional clips, and live community discussions.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 bg-zinc-900/60 p-1.5 rounded-2xl border border-zinc-850 self-start md:self-auto flex-wrap">
            <button
              onClick={() => setActiveTab("videos")}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "videos"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              Official Trailers ({videos.length})
            </button>
            <button
              onClick={() => setActiveTab("social")}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "social"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              Community Feed
            </button>
            <button
              onClick={() => setActiveTab("nami")}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "nami"
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-900/40"
                  : "text-amber-400 hover:text-amber-300 hover:bg-amber-950/30 border border-amber-500/30"
              }`}
            >
              <div className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0 border border-amber-400/60">
                <img src="/nami-wano-avatar.jpg" alt="Nami" className="w-full h-full object-cover scale-125" />
              </div>
              Nami's Lounge
            </button>
          </div>
        </div>

        {/* ── TAB 1: OFFICIAL VIDEOS ─────────────────────────────────────────── */}
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
              <div className="bg-zinc-900/20 border border-zinc-800 rounded-2xl p-16 text-center text-zinc-500">
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
                          onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-xl shadow-purple-900/50 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                          </div>
                        </div>
                        <span className="absolute bottom-2.5 right-2.5 text-[9px] bg-black/80 px-2 py-0.5 rounded font-black tracking-wider uppercase text-zinc-300">
                          {vid.video_type || "TRAILER"}
                        </span>
                      </div>
                      <div className="p-4 flex flex-col gap-1.5">
                        <span className="text-sm font-bold text-zinc-200 line-clamp-1 group-hover:text-purple-400 transition-colors">{vid.title}</span>
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                          <span>YouTube Official</span>
                          {vid.confidence_score && <span className="text-purple-400 font-bold">Verified</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: COMMUNITY SOCIAL FEED ──────────────────────────────────── */}
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
              <div className="bg-zinc-900/20 border border-zinc-800 rounded-2xl p-16 text-center text-zinc-500">
                <p className="text-zinc-300 font-bold text-lg">No posts available right now</p>
              </div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="bg-zinc-900/30 border border-zinc-900/80 hover:border-zinc-800 rounded-2xl p-5 md:p-6 transition-all duration-300 flex flex-col gap-4 shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {post.user.avatar ? (
                        <img src={post.user.avatar} alt={post.user.name} className="w-10 h-10 rounded-full object-cover border border-zinc-800" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-300 font-bold text-sm">
                          {post.user.name[0] || "?"}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-bold text-zinc-200">{post.user.name}</div>
                        <div className="text-[11px] text-zinc-500 font-medium">{formatTimeAgo(post.created_at)}</div>
                      </div>
                    </div>
                    {post.media && (
                      <div className="flex items-center gap-2 bg-zinc-950/80 border border-zinc-800 px-3 py-1.5 rounded-xl max-w-[200px] sm:max-w-xs">
                        {post.media.poster && <img src={post.media.poster} alt={post.media.title || "Anime"} className="w-5 h-7 rounded object-cover flex-shrink-0" />}
                        <span className="text-xs font-bold text-purple-400 truncate">{post.media.title}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line font-normal">{post.content}</div>
                  {post.embed && (
                    <div className="mt-1 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950/60 p-3 flex flex-col gap-2">
                      {post.embed.image?.url && <img src={post.embed.image.url} alt={post.embed.title || "Embedded Media"} className="w-full max-h-80 object-cover rounded-lg" />}
                      {post.embed.title && <span className="text-xs font-bold text-zinc-200">{post.embed.title}</span>}
                      {post.embed.description && <span className="text-[11px] text-zinc-500 line-clamp-2">{post.embed.description}</span>}
                      {post.embed.video?.url && (
                        <button
                          onClick={() => {
                            const ytMatch = post.embed?.url?.match(/(?:v=|\/)([\\w-]{11})/);
                            if (ytMatch && ytMatch[1]) setActiveVideoId(ytMatch[1]);
                          }}
                          className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/40 rounded-lg text-xs font-bold text-purple-300 w-fit transition-all"
                        >
                          Watch Embedded Video
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-6 pt-3 border-t border-zinc-900/60 text-xs font-semibold text-zinc-500">
                    <div className="flex items-center gap-1.5 hover:text-zinc-300 transition-colors">
                      <span>{post.comments_count} Comments</span>
                    </div>
                    <div className="flex items-center gap-1.5 hover:text-purple-400 transition-colors">
                      <span>{post.likes_count} Likes</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── TAB 3: NAMI'S LOUNGE ──────────────────────────────────────────── */}
        {activeTab === "nami" && (
          <div className="space-y-12">

            {/* ─── LOUNGE HERO BANNER ─────────────────────────────────────── */}
            <div className="relative rounded-3xl overflow-hidden border border-amber-500/30 bg-gradient-to-br from-zinc-950 via-amber-950/20 to-zinc-950 p-8 md:p-10 flex flex-col md:flex-row items-center gap-8 shadow-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-800/10 via-transparent to-transparent pointer-events-none" />
              <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-4 border-amber-500 shadow-2xl shadow-amber-900/40 flex-shrink-0">
                <img src="/nami-wano-avatar.jpg" alt="Nami Mascot" className="w-full h-full object-cover scale-110" />
              </div>
              <div className="relative z-10 text-center md:text-left">
                <div className="text-[11px] font-black text-amber-400 uppercase tracking-[0.2em] mb-1">AniVerse Official Mascot</div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-white">Nami's Lounge</h2>
                <p className="text-zinc-400 text-sm mt-2 max-w-xl leading-relaxed">
                  Your dedicated corner of the Grand Line. Navigate through Nami's lore, watch the best One Piece clips,
                  and test your navigator knowledge in the quiz below.
                </p>
                <div className="flex flex-wrap gap-2 mt-4 justify-center md:justify-start">
                  {["Navigator", "Clima-Tact", "Grand Line", "Straw Hat Pirates", "Wano"].map((tag) => (
                    <span key={tag} className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── NEWS & LORE CARDS ──────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-1 h-6 rounded-full bg-amber-500" />
                <h3 className="text-lg font-extrabold text-white">Nami &amp; One Piece — News &amp; Lore</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {NAMI_NEWS.map((item) => (
                  <div
                    key={item.id}
                    className="bg-zinc-900/40 border border-zinc-800 hover:border-amber-500/40 rounded-2xl p-5 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-900/10 group"
                  >
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border w-fit ${newsTagColor[item.tag] ?? "bg-zinc-800 text-zinc-400"}`}>
                      {item.tag}
                    </span>
                    <h4 className="text-sm font-extrabold text-zinc-100 group-hover:text-amber-300 transition-colors leading-snug">{item.title}</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">{item.body}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ─── ONE PIECE VIDEO GALLERY ────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-1 h-6 rounded-full bg-amber-500" />
                <h3 className="text-lg font-extrabold text-white">Nami &amp; One Piece — Clips &amp; Trailers</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {NAMI_VIDEOS.map((vid) => (
                  <div
                    key={vid.id}
                    onClick={() => setActiveVideoId(vid.ytId)}
                    className="cursor-pointer group flex flex-col bg-zinc-900/30 border border-zinc-800 hover:border-amber-500/40 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-900/10 transition-all duration-300"
                  >
                    <div className="aspect-video w-full bg-zinc-950 relative overflow-hidden">
                      <img
                        src={`https://i.ytimg.com/vi/${vid.ytId}/hqdefault.jpg`}
                        alt={vid.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-white shadow-xl shadow-amber-900/50 group-hover:scale-110 transition-transform">
                          <svg className="w-6 h-6 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                      </div>
                      <span className={`absolute bottom-2.5 right-2.5 text-[9px] px-2 py-0.5 rounded font-black tracking-wider uppercase ${videoTagColor[vid.tag] ?? "bg-zinc-800/80 text-zinc-300"}`}>
                        {vid.tag}
                      </span>
                    </div>
                    <div className="p-4 flex flex-col gap-1">
                      <span className="text-sm font-bold text-zinc-200 line-clamp-1 group-hover:text-amber-400 transition-colors">{vid.title}</span>
                      <span className="text-[10px] text-zinc-500">{vid.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ─── NAMI NAVIGATOR QUIZ ────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-1 h-6 rounded-full bg-amber-500" />
                <h3 className="text-lg font-extrabold text-white">Nami Navigator Quiz — How well do you know her?</h3>
              </div>

              {!quizActive ? (
                /* Quiz Start Card */
                <div className="bg-gradient-to-br from-zinc-900 via-amber-950/10 to-zinc-900 border border-amber-500/30 rounded-3xl p-10 flex flex-col items-center gap-6 text-center shadow-2xl">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-amber-500 shadow-xl">
                    <img src="/nami-wano-avatar.jpg" alt="Nami" className="w-full h-full object-cover scale-110" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-extrabold text-white">Navigator's Knowledge Test</h4>
                    <p className="text-zinc-400 text-sm mt-2 max-w-sm">
                      Think you know everything about Nami? Prove your worth as a Straw Hat crew member with {QUIZ_QUESTIONS.length} questions about AniVerse's mascot.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center text-xs text-zinc-400">
                    <span className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700">{QUIZ_QUESTIONS.length} Questions</span>
                    <span className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700">One Piece Lore</span>
                    <span className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700">Instant Feedback</span>
                  </div>
                  <button
                    onClick={startQuiz}
                    className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-extrabold rounded-2xl shadow-lg shadow-amber-900/40 hover:scale-105 active:scale-95 transition-all text-sm"
                  >
                    Set Sail — Start the Quiz
                  </button>
                </div>
              ) : quizFinished ? (
                /* Quiz Results Card */
                <div className="bg-gradient-to-br from-zinc-900 via-amber-950/10 to-zinc-900 border border-amber-500/30 rounded-3xl p-10 flex flex-col items-center gap-6 text-center shadow-2xl">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-amber-500 shadow-xl">
                    <img src="/nami-wano-avatar.jpg" alt="Nami" className="w-full h-full object-cover scale-110" />
                  </div>
                  <div>
                    <div className="text-[11px] text-amber-400 font-black uppercase tracking-widest mb-1">Quiz Complete</div>
                    <h4 className="text-3xl font-extrabold text-white">{quizScore} / {QUIZ_QUESTIONS.length}</h4>
                    <p className="text-zinc-300 text-sm mt-2 max-w-sm font-medium">{scoreMessage()}</p>
                  </div>
                  <div className="w-full max-w-xs bg-zinc-800/60 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-700"
                      style={{ width: `${(quizScore / QUIZ_QUESTIONS.length) * 100}%` }}
                    />
                  </div>
                  <button
                    onClick={startQuiz}
                    className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-extrabold rounded-2xl shadow-lg shadow-amber-900/40 hover:scale-105 active:scale-95 transition-all text-sm"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                /* Active Quiz Question */
                <div className="bg-zinc-900/50 border border-amber-500/20 rounded-3xl p-6 md:p-10 flex flex-col gap-6 shadow-2xl">
                  {/* Progress Bar */}
                  <div className="flex items-center justify-between text-xs text-zinc-500 font-bold">
                    <span>Question {quizIndex + 1} of {QUIZ_QUESTIONS.length}</span>
                    <span className="text-amber-400">{quizScore} correct so far</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-300"
                      style={{ width: `${((quizIndex) / QUIZ_QUESTIONS.length) * 100}%` }}
                    />
                  </div>

                  {/* Question */}
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-amber-500 flex-shrink-0">
                      <img src="/nami-wano-avatar.jpg" alt="Nami" className="w-full h-full object-cover scale-110" />
                    </div>
                    <div className="bg-zinc-800/50 rounded-2xl rounded-tl-none px-5 py-4 flex-1">
                      <p className="text-sm font-bold text-zinc-100 leading-relaxed">{QUIZ_QUESTIONS[quizIndex].question}</p>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {QUIZ_QUESTIONS[quizIndex].options.map((opt, idx) => {
                      const isCorrect = idx === QUIZ_QUESTIONS[quizIndex].correct;
                      const isSelected = idx === selectedAnswer;
                      let cls = "border border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-amber-500/40 hover:text-zinc-100";
                      if (selectedAnswer !== null) {
                        if (isCorrect) cls = "border border-emerald-500 bg-emerald-500/10 text-emerald-300";
                        else if (isSelected) cls = "border border-red-500 bg-red-500/10 text-red-300";
                        else cls = "border border-zinc-800 bg-zinc-900/30 text-zinc-600 opacity-60";
                      }
                      return (
                        <button
                          key={idx}
                          onClick={() => handleAnswer(idx)}
                          disabled={selectedAnswer !== null}
                          className={`px-4 py-3 rounded-xl text-xs font-bold text-left transition-all ${cls} disabled:cursor-default`}
                        >
                          <span className="font-black text-zinc-500 mr-2">{String.fromCharCode(65 + idx)}.</span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  {showExplanation && (
                    <div className="bg-zinc-800/40 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-500 flex-shrink-0">
                        <img src="/nami-wano-avatar.jpg" alt="Nami" className="w-full h-full object-cover scale-110" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-amber-400 uppercase tracking-wider mb-1">Nami explains:</p>
                        <p className="text-xs text-zinc-300 leading-relaxed">{QUIZ_QUESTIONS[quizIndex].explanation}</p>
                      </div>
                    </div>
                  )}

                  {selectedAnswer !== null && (
                    <div className="flex justify-end">
                      <button
                        onClick={nextQuestion}
                        className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold rounded-xl text-xs hover:from-amber-400 hover:to-orange-400 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-900/30"
                      >
                        {quizIndex + 1 >= QUIZ_QUESTIONS.length ? "See Results" : "Next Question"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
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
