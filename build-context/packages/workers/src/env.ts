/**
 * Environment loader - must be imported FIRST before any other modules
 * This ensures DATABASE_URL and other env vars are available when other modules initialize
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load from workers package .env first, then fall back to root
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
