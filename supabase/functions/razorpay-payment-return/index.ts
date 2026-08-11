import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getAllowedOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("APP_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean),
  );
}

function getSafeReturnTo(raw: string | null): URL | null {
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (getAllowedOrigins().has(url.origin) && url.pathname === "/payment-return") {
      url.search = "";
      url.hash = "";
      return url;
    }
  } catch {
    // Invalid URLs are rejected below.
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const requestUrl = new URL(req.url);
  const redirectUrl = getSafeReturnTo(requestUrl.searchParams.get("return_to"));
  if (!redirectUrl) {
    return new Response("Invalid payment return URL", {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    if (req.method === "POST") {
      const form = await req.formData();
      for (const [key, value] of form.entries()) redirectUrl.searchParams.set(key, String(value));
    } else {
      for (const [key, value] of requestUrl.searchParams.entries()) {
        if (key !== "return_to") redirectUrl.searchParams.set(key, value);
      }
    }
  } catch {
    redirectUrl.searchParams.set("error_description", "Unable to process payment callback.");
  }

  return Response.redirect(redirectUrl.toString(), 303);
});
