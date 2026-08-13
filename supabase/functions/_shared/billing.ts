export const PLAN_CONFIG = {
  dating: {
    amount: 100,
    currency: "INR",
    description: "usMoments Dating - INR 1/month",
  },
  soulmate: {
    amount: 9_900,
    currency: "INR",
    description: "usMoments Soulmate - INR 99/month",
  },
} as const;

export type BillingPlan = keyof typeof PLAN_CONFIG;

export function isBillingPlan(value: unknown): value is BillingPlan {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PLAN_CONFIG, value);
}
