// Client-side authentication helpers

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function fetchWithCredentials(url: string, options: RequestInit = {}) {
  // Always include credentials to send/receive HTTP cookies
  options.credentials = "include";
  options.headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  
  try {
    const response = await fetch(url, options);
    return response;
  } catch (err: any) {
    // Catch browser network errors (CORS, offline, blips) cleanly without throwing TypeError: Load failed
    return new Response(JSON.stringify({ detail: "Backend connection error." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export function getApiUrl(path: string) {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return `${process.env.NEXT_PUBLIC_API_URL}${path}`;
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return `http://${host}:8000/api/v1${path}`;
    }
  }
  return `${API_BASE}${path}`;
}

