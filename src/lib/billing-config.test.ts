import { describe, expect, it } from "vitest";
import { isBillingPlan, PLAN_CONFIG } from "../../supabase/functions/_shared/billing";

describe("billing plan configuration", () => {
  it("stores INR prices in paise", () => {
    expect(PLAN_CONFIG.dating.amount).toBe(2_900);
    expect(PLAN_CONFIG.soulmate.amount).toBe(9_900);
    expect(PLAN_CONFIG.dating.currency).toBe("INR");
  });

  it("accepts only supported server-side plan names", () => {
    expect(isBillingPlan("dating")).toBe(true);
    expect(isBillingPlan("soulmate")).toBe(true);
    expect(isBillingPlan("admin")).toBe(false);
    expect(isBillingPlan(null)).toBe(false);
  });
});
