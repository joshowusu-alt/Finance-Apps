import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.NODE_ENV,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 0.5,
  integrations: [],
  ignoreErrors: [
    "AbortError",
    "ResizeObserver loop limit exceeded",
    "ChunkLoadError",
  ],
});
