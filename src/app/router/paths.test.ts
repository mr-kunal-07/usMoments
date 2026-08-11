import { describe, expect, it } from "vitest";
import {
  APP_PATHS,
  authPath,
  dashboardRouteRedirect,
  dashboardPath,
  folderPath,
  isDashboardView,
  isFolderId,
  sanitiseRedirect,
} from "./paths";

describe("application paths", () => {
  it("builds canonical dashboard routes", () => {
    expect(dashboardPath()).toBe(APP_PATHS.dashboard);
    expect(dashboardPath("all")).toBe(APP_PATHS.dashboard);
    expect(dashboardPath("chat")).toBe("/dashboard/chat");
  });

  it("accepts only declared dashboard views", () => {
    expect(isDashboardView("billing")).toBe(true);
    expect(isDashboardView("unknown")).toBe(false);
    expect(isDashboardView(undefined)).toBe(false);
  });

  it("canonicalises and rejects invalid dashboard route parameters", () => {
    expect(dashboardRouteRedirect("all")).toBe(APP_PATHS.dashboard);
    expect(dashboardRouteRedirect("chat")).toBeNull();
    expect(dashboardRouteRedirect("unknown")).toBe(APP_PATHS.notFound);
    expect(dashboardRouteRedirect(undefined, "not-a-uuid")).toBe(APP_PATHS.notFound);
  });

  it("validates and builds folder routes", () => {
    const folderId = "123e4567-e89b-42d3-a456-426614174000";
    expect(isFolderId(folderId)).toBe(true);
    expect(folderPath(folderId)).toBe(`/dashboard/folder/${folderId}`);
    expect(isFolderId("../../admin")).toBe(false);
  });

  it("encodes post-login destinations", () => {
    expect(authPath("/dashboard/chat?thread=1"))
      .toBe("/auth?redirect=%2Fdashboard%2Fchat%3Fthread%3D1");
  });

  it("accepts internal post-login destinations and preserves URL state", () => {
    expect(sanitiseRedirect("/dashboard/chat?thread=1#latest", "https://usmoments.app"))
      .toBe("/dashboard/chat?thread=1#latest");
    expect(sanitiseRedirect("/payment-return?payment_id=123", "https://usmoments.app"))
      .toBe("/payment-return?payment_id=123");
  });

  it("rejects external and undeclared post-login destinations", () => {
    expect(sanitiseRedirect("https://attacker.example/dashboard", "https://usmoments.app")).toBeNull();
    expect(sanitiseRedirect("//attacker.example/dashboard", "https://usmoments.app")).toBeNull();
    expect(sanitiseRedirect("/not-found", "https://usmoments.app")).toBeNull();
  });
});
