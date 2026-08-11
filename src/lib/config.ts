export interface PublicAppConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
  functionsUrl: string;
  googleAuthEnabled: boolean;
  appVersion: string;
}

type PublicEnvironment = Partial<Record<
  | "VITE_SUPABASE_URL"
  | "VITE_SUPABASE_PUBLISHABLE_KEY"
  | "VITE_ENABLE_GOOGLE_AUTH"
  | "VITE_APP_VERSION",
  string
>>;

function required(env: PublicEnvironment, name: keyof PublicEnvironment): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normaliseSupabaseUrl(rawUrl: string): string {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("VITE_SUPABASE_URL must be a valid absolute URL");
  }

  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    throw new Error("VITE_SUPABASE_URL must use HTTPS outside local development");
  }

  return url.toString().replace(/\/$/, "");
}

export function createPublicAppConfig(env: PublicEnvironment): PublicAppConfig {
  const supabaseUrl = normaliseSupabaseUrl(required(env, "VITE_SUPABASE_URL"));
  const supabasePublishableKey = required(env, "VITE_SUPABASE_PUBLISHABLE_KEY");

  if (/\s/.test(supabasePublishableKey)) {
    throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY must not contain whitespace");
  }

  return {
    supabaseUrl,
    supabasePublishableKey,
    functionsUrl: `${supabaseUrl}/functions/v1`,
    googleAuthEnabled: env.VITE_ENABLE_GOOGLE_AUTH?.trim().toLowerCase() === "true",
    appVersion: env.VITE_APP_VERSION?.trim() || "dev",
  };
}

export const appConfig = createPublicAppConfig(import.meta.env);
