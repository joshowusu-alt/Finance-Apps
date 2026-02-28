"use client";

import { useState, useEffect } from "react";

export interface SubscriptionState {
  isPro: boolean;
  status: "free" | "pro" | "trialing" | "past_due" | "canceled" | null;
  isLoading: boolean;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

export function useSubscription(): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>({
    isPro: false,
    status: null,
    isLoading: true,
  });

  useEffect(() => {
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
