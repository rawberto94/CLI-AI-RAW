// Event System Index
// Centralized exports for all event-related functionality

export * from './event-bus';
export * from './intelligence-events';
export * from './analytical-events';

// Initialize analytical event handlers
import { analyticalEventHandler } from './analytical-events';

// Export the initialized handler
export { analyticalEventHandler };