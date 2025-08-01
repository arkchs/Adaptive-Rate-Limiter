import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let client;

export function getRedis() {
  if (!client) {
    client = new Redis(REDIS_URL);
    client.on('error', (err) => console.error('Redis Client Error', err));
  }
  return client;
}

export const redisClient = getRedis();