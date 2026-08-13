const DEFAULT_APP_ORIGINS = [
  "https://usmoments.in",
  "https://www.usmoments.in",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const ALLOWED_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
].join(", ");

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, "");
}

export function getAllowedOrigins(): Set<string> {
  const configuredOrigins = (Deno.env.get("APP_ORIGINS") ?? "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

  return new Set([...DEFAULT_APP_ORIGINS, ...configuredOrigins]);
}

export function isAllowedOrigin(origin: string | null): boolean {
  return !origin || getAllowedOrigins().has(normalizeOrigin(origin));
}

export function getCorsHeaders(req: Request, methods: string): HeadersInit {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": methods,
    "Vary": "Origin",
  };

  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = normalizeOrigin(origin);
  }

  return headers;
}
