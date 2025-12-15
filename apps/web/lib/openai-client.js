"use strict";
/**
 * OpenAI Client for web app
 * Re-exports the OpenAI client from packages
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIClient = exports.openai = void 0;
const clients_openai_1 = require("clients-openai");
Object.defineProperty(exports, "OpenAIClient", { enumerable: true, get: function () { return clients_openai_1.OpenAIClient; } });
// Initialize OpenAI client with API key from environment
const apiKey = process.env.OPENAI_API_KEY || '';
if (!apiKey) {
    console.warn('Warning: OPENAI_API_KEY not set. OpenAI features will be disabled.');
}
exports.openai = apiKey ? new clients_openai_1.OpenAIClient(apiKey) : null;
