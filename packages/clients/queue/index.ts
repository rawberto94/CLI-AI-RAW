import { Queue } from 'bullmq';

type QueueLike = {
	add: (name: string, data: unknown) => Promise<{ id: string }>;
};

export function getQueue(name: string): QueueLike {
	const redisUrl = process.env['REDIS_URL'];
	if (!redisUrl) {
		// Return a stub with add() that resolves for local dev without Redis
		return {
			add: async (_name: string, _data: unknown) => ({ id: 'stub' }),
		};
	}
	return new Queue(name, { connection: { url: redisUrl } as unknown as object });
}

export const ingestionQueue = getQueue('ingestion');
