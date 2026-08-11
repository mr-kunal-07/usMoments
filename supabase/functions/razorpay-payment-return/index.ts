import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSafeReturnTo(raw: string | null): string {
  if (!raw) return "http://localhost:8080/payment-return";

  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    // ignore
  }

  return "http://localhost:8080/payment-return";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const reqUrl = new URL(req.url);
  const returnTo = getSafeReturnTo(reqUrl.searchParams.get("return_to"));
  const redirectUrl = new URL(returnTo);

  try {
    const plan = reqUrl.searchParams.get("plan");
    if (plan) redirectUrl.searchParams.set("plan", plan);

    if (req.method === "POST") {
      const form = await req.formData();
      for (const [key, value] of form.entries()) {
        redirectUrl.searchParams.set(key, String(value));
      }
    } else {
      for (const [key, value] of reqUrl.searchParams.entries()) {
        if (key !== "return_to") redirectUrl.searchParams.set(key, value);
      }
    }
  } catch {
    redirectUrl.searchParams.set("error_description", "Unable to process payment callback.");
  }

  return Response.redirect(redirectUrl.toString(), 303);
});
