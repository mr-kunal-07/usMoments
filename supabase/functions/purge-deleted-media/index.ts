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

  // Find all media items deleted more than 14 days ago
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: expiredMedia, error: fetchError } = await supabase
    .from("media")
    .select("id, file_path")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff);

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!expiredMedia || expiredMedia.length === 0) {
    return new Response(JSON.stringify({ purged: 0, cutoff }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ids = expiredMedia.map((m: { id: string }) => m.id);
  const filePaths = expiredMedia.map((m: { file_path: string }) => m.file_path);

  // Remove files from storage
  if (filePaths.length > 0) {
    await supabase.storage.from("media").remove(filePaths);
  }

  // Permanently delete database rows
  const { error: deleteError } = await supabase
    .from("media")
    .delete()
    .in("id", ids);

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`Purged ${ids.length} expired media items older than 14 days`);
  return new Response(
    JSON.stringify({ purged: ids.length, cutoff }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
