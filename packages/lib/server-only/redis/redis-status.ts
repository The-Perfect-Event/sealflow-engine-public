import IORedis from 'ioredis';

import { env } from '../../utils/env';

/**
 * Point-in-time Redis reachability check for health/readiness probes. Opens a
 * short-lived connection (no retries, 2s connect timeout) rather than reusing
 * the app's long-lived BullMQ connection, since a probe shouldn't hold a
 * persistent connection open or be affected by the job worker's own state.
 */
export const isRedisReachable = async (): Promise<boolean> => {
  const redisUrl = env('NEXT_PRIVATE_REDIS_URL');

  if (!redisUrl) {
    return false;
  }

  const redis = new IORedis(redisUrl, {
    lazyConnect: true,
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });

  try {
    await redis.connect();
    await redis.ping();

    return true;
  } catch {
    return false;
  } finally {
    redis.disconnect();
  }
};
