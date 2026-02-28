import { z } from "zod";
import type { Plan } from "@/data/plan";

const PeriodSchema = z
  .object({
    id: z.string(),
    start: z.string(),
    end: z.string(),
  })
  .passthrough();

const TransactionSchema = z
  .object({
    id: z.string(),
    date: z.string(),
    amount: z.number(),
    type: z.string(),
  })
  .passthrough();

export const PlanSchema = z
  .object({
    periods: z.array(PeriodSchema).default([]),
    transactions: z.array(TransactionSchema).default([]),
    incomeRules: z.array(z.object({ id: z.string() }).passthrough()).default([]),
    outflowRules: z.array(z.object({ id: z.string() }).passthrough()).default([]),
    bills: z.array(z.object({ id: z.string() }).passthrough()).default([]),
  })
  .passthrough(); // allow any additional fields (goals, assets, version, etc.)

export type ValidatedPlan = z.infer<typeof PlanSchema>;

/**
 * Validates a plan body.
 * Returns `{ ok: true, plan }` or `{ ok: false, error: string }`.
 */
export function validatePlan(
  body: unknown,
): { ok: true; plan: Plan } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Plan must be a JSON object" };
  }
  const result = PlanSchema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues.map((i) => i.message).join("; "),
    };
  }
  return { ok: true, plan: result.data as unknown as Plan };
}
