"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getApiUrl } from "@/lib/auth";

interface RecommendedAnime {
  id: number;
  slug: string;
  title: string;
  cover_url?: string;
  score?: number;
  genres: string[];
}

interface Message {
  id: string;
  sender: "user" | "nami";
  text: string;
  anime_recommendations?: RecommendedAnime[];
  timestamp: string;
}

export default function NamiChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(true);

  // Cute post-timeskip Wano Nami avatar image provided by user
  const NAMI_AVATAR = "/nami-wano-avatar.jpg";




  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      sender: "nami",
      text: "Yosh! I'm Nami, your official AniVerse Navigator! Looking for your next 10/10 anime adventure or a top-tier recommendation?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: "nami",
        text: "Yosh! I'm Nami, your official AniVerse Navigator! Looking for your next 10/10 anime adventure or a top-tier recommendation?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || input).trim();
    if (!textToSend || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInput("");
    setLoading(true);

    try {
      const history = messages.map((m) => ({ sender: m.sender, text: m.text }));
      const res = await fetch(getApiUrl("/chat/nami"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend, history })
      });

      if (!res.ok) throw new Error("Could not reach Nami");
      const data = await res.json();

      const namiMsg: Message = {
        id: `nami-${Date.now()}`,
        sender: "nami",
        text: data.reply || "Let's chart a new course! Ask me another question!",
        anime_recommendations: data.anime_recommendations || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, namiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "nami",
          text: "Oops! Looks like some stormy weather hit the line. Try asking me again in a moment!",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 font-sans">
      {/* Proactive Speech Bubble Hint */}
      {!isOpen && showHint && (
        <div className="absolute -top-10 right-0 bg-gradient-to-r from-zinc-900 via-purple-950 to-zinc-900 border border-purple-500/40 text-purple-200 text-[11px] font-bold px-3 py-1.5 rounded-2xl shadow-xl whitespace-nowrap flex items-center gap-2 animate-bounce">
          <span>Need recommendations? Ask Nami!</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowHint(false);
            }}
            className="text-zinc-400 hover:text-white text-xs font-bold"
          >
            
          </button>
        </div>
      )}

      {/* Floating Toggle Button anchored at Bottom-Right */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setShowHint(false);
          }}
          className="group flex items-center gap-3 bg-zinc-900/95 hover:bg-zinc-850 border-2 border-purple-500/60 hover:border-purple-400 text-white p-2.5 pr-4 rounded-full shadow-2xl backdrop-blur-xl transition-all duration-300 hover:scale-105"
        >

          <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-amber-500 shadow-lg bg-purple-950">
            <img
              src={NAMI_AVATAR}
              alt="Nami — One Piece Navigator"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-zinc-950 rounded-full" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-black text-purple-300 tracking-wide flex items-center gap-1">
              Ask Nami
            </div>
            <div className="text-[10px] text-zinc-400 font-semibold">Straw Hat Navigator</div>
          </div>
        </button>
      )}

      {/* Floating Chat Modal anchored at Bottom-Right */}
      {isOpen && (
        <div className="w-[calc(100vw-32px)] sm:w-[420px] max-w-[420px] h-[500px] sm:h-[580px] max-h-[85vh] bg-zinc-950/95 border border-purple-500/40 backdrop-blur-2xl rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-zinc-900 via-purple-950/50 to-zinc-900 p-4 border-b border-zinc-850 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-amber-500 shadow-md bg-purple-950">
                <img
                  src={NAMI_AVATAR}
                  alt="Nami"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-zinc-950 rounded-full" />
              </div>
              <div>
                <h3 className="text-sm font-black text-zinc-100 flex items-center gap-1.5">
                  Nami <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Navigator</span>
                </h3>
                <p className="text-[10px] text-zinc-400 font-medium">Straw Hat Pirate & Anime Specialist</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClearChat}
                title="Clear Chat"
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-[11px] font-bold transition-all border border-zinc-800 flex items-center gap-1"
              >
                Clear Chat
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-xs transition-all border border-zinc-800"
              >
                
              </button>
            </div>
          </div>

          {/* Quick Suggestion Chips */}
          <div className="px-4 py-2.5 bg-zinc-900/40 border-b border-zinc-900 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none text-[11px]">
            {[
              "Top Adventure Anime",
              "10/10 Masterpieces",
              "Dark Fantasy Shows",
              "Airing Season Hits"
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                disabled={loading}
                className="bg-zinc-900 hover:bg-purple-950/50 border border-zinc-800 hover:border-purple-500/40 text-zinc-300 hover:text-purple-300 px-3 py-1 rounded-full font-semibold transition-all flex-shrink-0"
              >
                {chip}
              </button>
            ))}
          </div>


          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "nami" && (
                  <img
                    src={NAMI_AVATAR}
                    alt="Nami"
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover border border-amber-500/80 flex-shrink-0 mt-1 bg-purple-950"
                  />
                )}


                <div className={`max-w-[82%] space-y-2 ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`p-3.5 rounded-2xl leading-relaxed whitespace-pre-line shadow-md ${
                      msg.sender === "user"
                        ? "bg-purple-600 text-white rounded-br-none font-medium"
                        : "bg-zinc-900/90 border border-zinc-800 text-zinc-200 rounded-bl-none"
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Anime Recommendation Cards */}
                  {msg.anime_recommendations && msg.anime_recommendations.length > 0 && (
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      {msg.anime_recommendations.map((anime) => (
                        <Link
                          key={anime.id}
                          href={`/anime/${anime.slug}-${anime.id}`}
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-3 bg-zinc-950 border border-zinc-850 hover:border-purple-500/60 p-2 rounded-xl group transition-all"
                        >
                          {anime.cover_url ? (
                            <img src={anime.cover_url} alt={anime.title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0 group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="w-10 h-14 bg-zinc-900 rounded-lg flex items-center justify-center text-[10px] text-zinc-600">No Cover</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-zinc-200 group-hover:text-purple-400 truncate">{anime.title}</div>
                            <div className="flex items-center gap-2 mt-1">
                              {anime.score && (
                                <span className="text-[10px] font-extrabold text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">
                                  ⭐ {anime.score}%
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-500 truncate">{anime.genres.join(", ")}</span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className={`text-[9px] text-zinc-600 font-mono ${msg.sender === "user" ? "text-right" : "text-left"}`}>
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-zinc-400 text-xs py-2">
                <img src={NAMI_AVATAR} alt="Nami" className="w-6 h-6 rounded-full object-cover border border-purple-500/60 animate-pulse" />
                <span className="italic font-medium text-purple-300">Nami is checking her log pose...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className="p-3 bg-zinc-900/60 border-t border-zinc-900">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-2 items-center"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Nami anything about anime..."
                disabled={loading}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md flex items-center justify-center"
              >
                Send
              </button>
            </form>
          </div>

        </div>
      )}
    </div>
  );
}
