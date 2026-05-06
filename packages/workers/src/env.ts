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

const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
	try {
		const parsed = new URL(redisUrl);

		if (!process.env.REDIS_HOST && parsed.hostname) {
			process.env.REDIS_HOST = parsed.hostname;
		}

		if (!process.env.REDIS_PORT) {
			process.env.REDIS_PORT = parsed.port || '6379';
		}

		if (!process.env.REDIS_PASSWORD && parsed.password) {
			process.env.REDIS_PASSWORD = decodeURIComponent(parsed.password);
		}

		if (!process.env.REDIS_TLS && parsed.protocol === 'rediss:') {
			process.env.REDIS_TLS = 'true';
		}
	} catch {
		// Ignore malformed REDIS_URL and let downstream config fail explicitly.
	}
}
