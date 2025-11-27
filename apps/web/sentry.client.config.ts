// Sentry Configuration for Next.js
// This file configures error tracking in production

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Only enable in production
  enabled: process.env.NODE_ENV === "production" && !!process.env.SENTRY_DSN,
  
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production, or using tracesSampler
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Enable debug mode in development
  debug: process.env.NODE_ENV === "development",
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  environment: process.env.NODE_ENV,
  
  // Capture Replay for 10% of all sessions
  replaysSessionSampleRate: 0.1,
  
  // Capture Replay for 100% of sessions with an error
  replaysOnErrorSampleRate: 1.0,
  
  // Filter out sensitive data
  beforeSend(event) {
    // Scrub sensitive headers
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
      delete event.request.headers["x-api-key"];
    }
    
    // Scrub sensitive query params
    if (event.request?.query_string) {
      const params = new URLSearchParams(event.request.query_string);
      params.delete("token");
      params.delete("key");
      params.delete("password");
      event.request.query_string = params.toString();
    }
    
    return event;
  },
  
  // Ignore common non-critical errors
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
    /Loading chunk \d+ failed/,
    /Network request failed/,
  ],
});
