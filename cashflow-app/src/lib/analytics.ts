import posthog from "posthog-js";

type EventName =
  | "onboarding_completed"
  | "onboarding_step_viewed"
  | "ai_chat_opened"
  | "ai_chat_message_sent"
  | "whatif_panel_opened"
  | "insights_export"
  | "goal_created"
  | "goal_updated"
  | "transaction_recategorized"
  | "plan_period_closed"
  | "settings_opened"
  | "page_visited";

export function track(event: EventName, properties?: Record<string, unknown>) {
  // No-op if posthog not initialized (env var not set)
  if (typeof window === "undefined") return;
  posthog.capture(event, properties);
}
