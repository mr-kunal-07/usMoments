import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // First, delete reactions on messages older than 24h (FK constraint)
  const { data: oldMessages } = await supabase
    .from("messages")
    .select("id")
    .lt("created_at", cutoff);

  if (oldMessages && oldMessages.length > 0) {
    const ids = oldMessages.map((m: { id: string }) => m.id);

    // Delete reactions first
    await supabase
      .from("message_reactions")
      .delete()
      .in("message_id", ids);

    // Delete audio files from storage for voice messages
    const { data: voiceMessages } = await supabase
      .from("messages")
      .select("audio_url")
      .in("id", ids)
      .not("audio_url", "is", null);

    if (voiceMessages && voiceMessages.length > 0) {
      const paths = voiceMessages
        .map((m: { audio_url: string | null }) => {
          if (!m.audio_url) return null;
          const url = new URL(m.audio_url);
          const parts = url.pathname.split("/object/public/audio/");
          return parts[1] ?? null;
        })
        .filter(Boolean) as string[];

      if (paths.length > 0) {
        await supabase.storage.from("audio").remove(paths);
      }
    }

    // Delete the messages
    const { error } = await supabase
      .from("messages")
      .delete()
      .in("id", ids);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Purged ${ids.length} messages older than 24h`);
    return new Response(
      JSON.stringify({ purged: ids.length, cutoff }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ purged: 0, cutoff }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
