import IORedis, { RedisOptions } from 'ioredis';
import { config } from './env';

export const redisConnectionOptions: RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
};

export const redisClient = new IORedis(redisConnectionOptions);

redisClient.on('connect', () => {
  console.log('[Redis] Connected successfully to Redis at', `${config.redis.host}:${config.redis.port}`);
});

redisClient.on('error', (err) => {
  console.error('[Redis] Connection Error:', err.message);
});
