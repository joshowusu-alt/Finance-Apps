"use client";

import { useState, useEffect } from "react";

export interface SubscriptionState {
  isPro: boolean;
  status: "free" | "pro" | "trialing" | "past_due" | "canceled" | null;
  isLoading: boolean;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

/**
 * REVIEW_MODE — set to true during the review/beta phase to grant all users
 * full Pro access without a Stripe subscription.
 * Set to false when billing goes live.
 */
const REVIEW_MODE = true;

export function useSubscription(): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>({
    isPro: REVIEW_MODE,
    status: REVIEW_MODE ? "pro" : null,
    isLoading: !REVIEW_MODE,
  });

  useEffect(() => {
    // Skip the API call entirely in review mode
    if (REVIEW_MODE) return;

    fetch("/api/subscription")
      .then((r) => (r.ok ? r.json() : Promise.resolve({ isPro: false, status: "free" })))
      .then((d) => {
        setState({
          isPro: d.isPro ?? false,
          status: d.status ?? "free",
          isLoading: false,
          currentPeriodEnd: d.currentPeriodEnd,
          cancelAtPeriodEnd: d.cancelAtPeriodEnd,
        });
      })
      .catch(() => {
        setState({ isPro: false, status: "free", isLoading: false });
      });
  }, []);

  return state;
}
