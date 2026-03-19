import Redis from 'ioredis';

const REDIS_EVENTS_CHANNEL = 'cli-ai:events';

let publisher: InstanceType<typeof Redis> | null = null;
let publisherReady = false;
let publisherConnectPromise: Promise<void> | null = null;

function getRedisUrl(): string | null {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  if (process.env.REDIS_HOST) return `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`;
  // No Redis configured — return null to skip connection attempts
  return null;
}

async function ensureRedisPublisher(): Promise<InstanceType<typeof Redis>> {
  if (publisher && publisherReady) return publisher;
  if (publisherConnectPromise) {
    await publisherConnectPromise;
    if (publisher && publisherReady) return publisher;
  }

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    throw new Error('Redis not configured');
  }

  publisherConnectPromise = (async () => {
    try {
      publisher = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => Math.min(times * 100, 3000),
        lazyConnect: true,
      });

      publisher.on('error', () => {
        publisherReady = false;
      });

      publisher.on('close', () => {
        publisherReady = false;
      });

      await publisher.connect();
      publisherReady = true;
    } catch {
      publisherReady = false;
    }
  })();

  await publisherConnectPromise;

  if (!publisher || !publisherReady) {
    throw new Error('Redis publisher not available');
  }

  return publisher;
}

export async function publishRealtimeEvent(params: {
  event: string;
  data: Record<string, unknown>;
  source?: string;
}): Promise<void> {
  try {
    const redis = await ensureRedisPublisher();

    await redis.publish(
      REDIS_EVENTS_CHANNEL,
      JSON.stringify({
        event: params.event,
        data: params.data,
        timestamp: new Date().toISOString(),
        source: params.source || 'web-api',
      })
    );
  } catch {
    // Best-effort only
  }
}
