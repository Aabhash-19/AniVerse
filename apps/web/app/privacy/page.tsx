"use client";

import React from "react";
import Header from "@/components/layout/Header";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden pb-20">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-16 relative z-10 space-y-10">
        <div className="border-b border-zinc-900 pb-6">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Privacy Policy
          </h1>
          <p className="text-zinc-400 mt-2">Last Updated: August 3, 2026</p>
        </div>

        <section className="space-y-6 text-sm text-zinc-300 leading-relaxed">
          <div>
            <h2 className="text-lg font-bold text-zinc-200">1. Data Collected</h2>
            <p className="mt-2">
              We collect minimal personal data necessary to provide watchlists, recommendations, and social features:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-400 pl-4">
              <li>Email address (for account identification and optionally requested alerts)</li>
              <li>Username and display name (public facing identification)</li>
              <li>Watchlist, rating scores, completed progress, and custom lists</li>
              <li>Follow logs, comments, and discussions replies</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-zinc-200">2. Cookies Usage</h2>
            <p className="mt-2">
              We set secure, HttpOnly session cookies (`access_token`, `refresh_token`) to maintain authentication states. 
              We do not share cookie identifiers with any third-party ads networks or trackers.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-zinc-200">3. Third Party Caching</h2>
            <p className="mt-2">
              Metadata, titles, images, and catalog information are synced from the AniList GraphQL API. 
              Official trailers and promotional clips are loaded using the YouTube IFrame API which may set YouTube cookies on playback interaction.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-zinc-200">4. User Rights (GDPR / CCPA)</h2>
            <p className="mt-2">
              You retain full ownership of your data. You can request a complete machine-readable download of your profile data or request permanent deletion of your account.
              These actions can be triggered instantly from your Settings page.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
