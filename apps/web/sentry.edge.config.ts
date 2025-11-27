// Sentry Edge Configuration for Next.js
// This file configures error tracking for edge runtime

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Only enable in production
  enabled: process.env.NODE_ENV === "production" && !!process.env.SENTRY_DSN,
  
  // Set tracesSampleRate for performance monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Environment
  environment: process.env.NODE_ENV,
  
  // Filter out sensitive data
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
    }
    return event;
  },
});
