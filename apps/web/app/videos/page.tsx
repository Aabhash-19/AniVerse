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

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const fetchVideos = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(getApiUrl("/videos"));
      if (!res.ok) throw new Error("Failed to load official videos library.");
      const data = await res.json();
      setVideos(data);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />

      <Header />

      <main className="max-w-6xl mx-auto px-6 py-10 relative z-10">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Official Media Hub
          </h1>
          <p className="text-zinc-400 mt-2">Watch verified official trailers, opening themes, ending themes, and promotional clips.</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-400 text-sm font-medium">Scanning official media feeds...</p>
          </div>
        ) : error ? (
          <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-6 text-center text-red-400">
            <p className="font-semibold">Error occurred</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-16 text-center">
            <svg className="w-12 h-12 text-zinc-650 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 00-2 2z" />
            </svg>
            <p className="text-zinc-400 font-bold text-lg">No media synced yet</p>
            <p className="text-sm text-zinc-600 mt-1 max-w-sm mx-auto">
              The official media database is currently empty. Run candidate discovery and approve videos to see them appear here!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {videos.map((vid) => (
              <div
                key={vid.id}
                onClick={() => setActiveVideoId(vid.provider_video_id)}
                className="cursor-pointer group flex flex-col bg-zinc-900/30 border border-zinc-900 rounded-2xl overflow-hidden hover:border-zinc-850 transition-all duration-300 shadow-xl"
              >
                <div className="aspect-video w-full bg-zinc-950 relative overflow-hidden">
                  <img
                    src={vid.thumbnail_url || `https://img.youtube.com/vi/${vid.provider_video_id}/0.jpg`}
                    alt={vid.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Play button overlay */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-900/50">
                      <svg className="w-6 h-6 fill-current ml-0.5" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  <span className="absolute bottom-2.5 right-2.5 text-[9px] bg-black/75 px-2 py-0.5 rounded font-black tracking-wider uppercase text-zinc-300">
                    {vid.video_type}
                  </span>
                </div>
                <div className="p-4 flex flex-col gap-1.5">
                  <span className="text-sm font-bold text-zinc-200 line-clamp-1 group-hover:text-purple-400 transition-colors">
                    {vid.title}
                  </span>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    <span>YouTube Embed</span>
                    {vid.confidence_score && (
                      <span className="text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/10">
                        {vid.confidence_score}% Match
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Video Player */}
      {activeVideoId && (
        <div 
          onClick={() => setActiveVideoId(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl aspect-video bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl relative"
          >
            <button
              onClick={() => setActiveVideoId(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/60 hover:bg-zinc-800/80 text-zinc-300 hover:text-white flex items-center justify-center text-xl font-bold transition-all border border-zinc-800"
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
