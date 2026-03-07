// Sentry Server Configuration for Next.js
// This file configures error tracking for server-side code

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Only enable in production
  enabled: process.env.NODE_ENV === "production" && !!process.env.SENTRY_DSN,
  
  // Set tracesSampleRate for performance monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Enable debug mode in development
  debug: false,
  
  // Environment
  environment: process.env.NODE_ENV,
  
  // Filter out sensitive data
  beforeSend(event) {
    // Scrub sensitive headers
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
      delete event.request.headers["x-api-key"];
    }
    
    // Scrub user data
    if (event.user) {
      delete event.user.ip_address;
    }
    
    return event;
  },
  
  // Ignore common non-critical errors
  ignoreErrors: [
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
    // NOTE: Do NOT ignore Prisma connection errors — DB outages must trigger alerts
  ],
});
