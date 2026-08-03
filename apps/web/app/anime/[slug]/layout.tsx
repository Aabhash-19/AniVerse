import { Metadata } from "next";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  try {
    const res = await fetch(`${API_BASE}/anime/${slug}`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!res.ok) {
      return {
        title: "Anime | AniVerse",
        description: "Discover anime on AniVerse — the AI-powered anime platform.",
      };
    }

    const anime = await res.json();
    const title =
      anime.title?.english || anime.title?.romaji || anime.title_english || anime.title_romaji || "Anime";
    const description =
      anime.description
        ? anime.description.replace(/<[^>]+>/g, "").slice(0, 200) + "…"
        : `Discover ${title} on AniVerse. Watch official trailers, track your progress, and get personalized recommendations.`;
    const coverImage = anime.cover_large_url || anime.cover_medium_url || null;
    const genres: string[] = anime.genres || [];

    return {
      title: `${title} | AniVerse`,
      description,
      keywords: [title, "anime", "AniVerse", ...genres],
      openGraph: {
        type: "article",
        title: `${title} — AniVerse`,
        description,
        url: `https://aniverse.app/anime/${slug}`,
        siteName: "AniVerse",
        ...(coverImage && {
          images: [
            {
              url: coverImage,
              width: 460,
              height: 650,
              alt: `${title} cover art`,
            },
          ],
        }),
      },
      twitter: {
        card: "summary_large_image",
        title: `${title} — AniVerse`,
        description,
        ...(coverImage && { images: [coverImage] }),
      },
    };
  } catch {
    return {
      title: "Anime | AniVerse",
      description: "Discover anime on AniVerse.",
    };
  }
}

export default function AnimeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
