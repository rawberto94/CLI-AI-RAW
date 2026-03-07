/**
 * CSRF Constants (Client-safe)
 * 
 * Constants that can be safely imported in client components.
 */

export const CSRF_CONSTANTS = {
  TOKEN_NAME: 'csrf_token',
  HEADER_NAME: 'x-csrf-token',
} as const;
