import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.NODE_ENV,
  ignoreErrors: [
    // Ignore expected errors that don't need alerting
    "AbortError",
    "TypeError: Failed to fetch",
    "NetworkError",
  ],
});
