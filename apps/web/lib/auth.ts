// Client-side authentication helpers

const DEFAULT_PROD_API = "https://namiverse-api.onrender.com/api/v1";
const DEFAULT_LOCAL_API = "http://localhost:8000/api/v1";

export function getApiUrl(path: string) {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return `${process.env.NEXT_PUBLIC_API_URL}${path}`;
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return `${DEFAULT_LOCAL_API}${path}`;
    }
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) {
      return `http://${host}:8000/api/v1${path}`;
    }
    return `${DEFAULT_PROD_API}${path}`;
  }
  return `${DEFAULT_PROD_API}${path}`;
}

export async function fetchWithCredentials(url: string, options: RequestInit = {}) {
  // Always include credentials to send/receive HTTP cookies
  options.credentials = "include";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("namiverse_token");
    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  options.headers = headers;

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


