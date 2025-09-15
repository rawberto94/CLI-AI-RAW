import { Queue } from 'bullmq';

export function getQueue(name: string) {
	const redisUrl = process.env['REDIS_URL'];
	if (!redisUrl) {
		// Return a stub with add() that resolves for local dev without Redis
		return {
			add: async (_name: string, _data: unknown) => ({ id: 'stub' }),
		} as unknown as Queue;
	}
	return new Queue(name, { connection: { url: redisUrl } as any });
}

export const ingestionQueue = getQueue('ingestion');
