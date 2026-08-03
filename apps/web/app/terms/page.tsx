"use client";

import React from "react";
import Header from "@/components/layout/Header";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden pb-20">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-16 relative z-10 space-y-10">
        <div className="border-b border-zinc-900 pb-6">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Terms of Service
          </h1>
          <p className="text-zinc-400 mt-2">Last Updated: August 3, 2026</p>
        </div>

        <section className="space-y-6 text-sm text-zinc-300 leading-relaxed">
          <div>
            <h2 className="text-lg font-bold text-zinc-200">1. Acceptable Use</h2>
            <p className="mt-2">
              AniVerse is an anime discovery and discussion forum. Users must refrain from uploading, commenting, or sharing content that:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-400 pl-4">
              <li>Infringes on intellectual property rights (we do not host or distribute copyrighted video files).</li>
              <li>Contains hate speech, harassment, abuse, or spam reviews.</li>
              <li>Leaks anime spoilers outside marked spoiler containers.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-zinc-200">2. Community Moderation</h2>
            <p className="mt-2">
              Moderators retain the right to hide spoilers, moderate comment boards, and suspend accounts violating community guidelines.
              Suspended users will have their access revoked.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-zinc-200">3. Disclaimers</h2>
            <p className="mt-2">
              Video embeds are provided directly via YouTube verified official channels. We are not responsible for content, modifications, or availability of YouTube publisher uploads.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
