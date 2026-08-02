import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">{children}</body>
    </html>
  );
}
