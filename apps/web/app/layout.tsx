import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CookieBanner from "@/components/layout/CookieBanner";
import NamiChatWidget from "@/components/layout/NamiChatWidget";
import PwaInstallPrompt from "@/components/layout/PwaInstallPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "NamiVerse — AI Anime Discovery, Media & Watchlist Platform",
    template: "%s | NamiVerse",
  },
  description:
    "NamiVerse is an AI-powered anime discovery platform. Browse a verified catalogue, watch official trailers, track your watchlist, and get personalized recommendations — all for free.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NamiVerse",
  },
  keywords: [
    "anime",
    "anime catalogue",
    "anime watchlist",
    "anime trailers",
    "official anime media",
    "anime recommendation",
    "NamiVerse",
    "PWA",
    "anime app",
  ],
  authors: [{ name: "NamiVerse Team" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://namiverse.app",
    siteName: "NamiVerse",
    title: "NamiVerse — Anime Discovery, Media & Watchlist Platform",
    description:
      "AI-powered anime discovery with official media, verified catalogues, progress tracking, and recommendations.",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/icon-192x192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  twitter: {
    card: "summary_large_image",
    title: "NamiVerse — Anime Discovery Platform",
    description: "Track, discover, and watch official anime media on NamiVerse.",
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
        <PwaInstallPrompt />
      </body>
    </html>
  );
}

