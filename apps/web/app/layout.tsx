import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CookieBanner from "@/components/layout/CookieBanner";
import NamiChatWidget from "@/components/layout/NamiChatWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AniVerse — Anime Discovery, Media & Watchlist Platform",
    template: "%s | AniVerse",
  },
  description:
    "AniVerse is an AI-powered anime discovery platform. Browse a verified catalogue, watch official trailers, track your watchlist, and get personalized recommendations — all for free.",
  keywords: [
    "anime",
    "anime catalogue",
    "anime watchlist",
    "anime trailers",
    "official anime media",
    "anime recommendation",
    "AniVerse",
  ],
  authors: [{ name: "AniVerse Team" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://aniverse.app",
    siteName: "AniVerse",
    title: "AniVerse — Anime Discovery, Media & Watchlist Platform",
    description:
      "AI-powered anime discovery with official media, verified catalogues, progress tracking, and recommendations.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AniVerse — Anime Discovery Platform",
    description: "Track, discover, and watch official anime media on AniVerse.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        {/* Skip to main content — screen reader & keyboard accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-purple-600 focus:text-white focus:font-bold focus:text-sm"
        >
          Skip to main content
        </a>
        {children}
        <CookieBanner />
        <NamiChatWidget />
      </body>
    </html>
  );
}

