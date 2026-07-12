import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// crypto.randomUUID() requires a secure context (HTTPS or localhost).
// This fallback works on plain HTTP deployments.
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return '<1s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Maps raw server/technical error strings to short user-facing language.
 * The raw message is returned as `detail` for a "details" expander / support.
 */
export function humanizeUploadError(raw?: string | null): { message: string; detail?: string } {
  const text = (raw ?? '').trim();
  const lower = text.toLowerCase();
  const fallback = { message: 'Processing failed — retry', detail: text || undefined };

  if (!text) return { message: 'Processing failed — retry' };

  if (/queue call timed out|queue.*timeout|processing.*timed out/.test(lower)) {
    return { message: "Processing couldn't start — retry", detail: text };
  }
  if (/timed out|timeout|etimedout/.test(lower)) {
    return { message: 'The upload timed out — check your connection and retry', detail: text };
  }
  if (/network error|failed to fetch|econnreset|econnrefused|socket hang up/.test(lower)) {
    return { message: 'Connection lost during upload — retry', detail: text };
  }
  if (/413|payload too large|file too large|exceeds.*size limit/.test(lower)) {
    return { message: 'File is too large — the limit is 100 MB', detail: text };
  }
  if (/unsupported|mime|invalid file type/.test(lower)) {
    return { message: "This file type isn't supported", detail: text };
  }
  if (/cancelled|canceled|aborted/.test(lower)) {
    return { message: 'Upload was cancelled', detail: text };
  }
  if (/401|403|unauthorized|forbidden|csrf/.test(lower)) {
    return { message: 'Your session expired — refresh the page and retry', detail: text };
  }
  if (/429|rate limit|too many requests/.test(lower)) {
    return { message: 'Too many uploads at once — wait a moment and retry', detail: text };
  }
  if (/prisma|invocation|constraint|unique|foreign key|deadlock/.test(lower)) {
    return { message: 'Something went wrong on our side — retry', detail: text };
  }
  if (/5\d\d|internal server error|bad gateway|service unavailable/.test(lower)) {
    return { message: 'The server had a problem — retry in a moment', detail: text };
  }
  if (/corrupt|unreadable|couldn.?t be read|parse|invalid pdf|encrypted/.test(lower)) {
    return { message: "File couldn't be read — check it and retry", detail: text };
  }

  return fallback;
}
