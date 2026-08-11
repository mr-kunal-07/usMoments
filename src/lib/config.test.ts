import { describe, expect, it } from "vitest";
import { createPublicAppConfig } from "./config";

const baseEnv = {
  VITE_SUPABASE_URL: "https://example.supabase.co/",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
};

describe("createPublicAppConfig", () => {
  it("normalises the Supabase URL and derives the functions endpoint", () => {
    const config = createPublicAppConfig(baseEnv);

    expect(config.supabaseUrl).toBe("https://example.supabase.co");
    expect(config.functionsUrl).toBe("https://example.supabase.co/functions/v1");
    expect(config.googleAuthEnabled).toBe(false);
  });

  it("enables Google OAuth only when explicitly configured", () => {
    const config = createPublicAppConfig({
      ...baseEnv,
      VITE_ENABLE_GOOGLE_AUTH: "true",
    });

    expect(config.googleAuthEnabled).toBe(true);
  });

  it("rejects missing or insecure production configuration", () => {
    expect(() => createPublicAppConfig({ ...baseEnv, VITE_SUPABASE_URL: "" }))
      .toThrow("VITE_SUPABASE_URL");
    expect(() => createPublicAppConfig({ ...baseEnv, VITE_SUPABASE_URL: "http://example.com" }))
      .toThrow("must use HTTPS");
    expect(() => createPublicAppConfig({ ...baseEnv, VITE_SUPABASE_PUBLISHABLE_KEY: "bad key" }))
      .toThrow("must not contain whitespace");
  });
});
