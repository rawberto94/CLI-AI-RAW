/**
 * Chatbot Index
 * Main export for modular chatbot system
 */

export { detectIntent } from './intent-detector';
export { executeAction, detectUpdateIntent } from './action-handlers';
export { 
  handleUpdateActions, 
  getPendingAction, 
  createPendingAction,
  type PendingAction,
  type UpdateIntent
} from './action-handlers/update-actions';
export * from './types';
export * from './constants';
