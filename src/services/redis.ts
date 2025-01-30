import type { Redis } from 'ioredis';

let redisClient: Redis | null = null;

export async function getRedisClient(): Promise<Redis> {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const Redis = require('ioredis');
    redisClient = new Redis(redisUrl);
  }
  if (!redisClient) {
    throw new Error('Failed to create Redis client');
  }
  return redisClient;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
} 
