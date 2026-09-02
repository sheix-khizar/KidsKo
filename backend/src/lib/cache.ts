import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://placeholder.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'placeholder_token',
});

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function cacheKey(question: string, gradeBand: string = 'general'): string {
  const normalized = question.trim().toLowerCase().replace(/[^\w\s]/g, '');
  const hash = crypto.createHash('sha256').update(`${gradeBand}:${normalized}`).digest('hex');
  return `qa:${gradeBand}:${hash}`;
}

export async function getCachedAnswer(question: string, gradeBand: string = 'general'): Promise<string | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  try {
    const val = await redis.get<string>(cacheKey(question, gradeBand));
    return val ?? null;
  } catch (err: any) {
    console.error('Redis cache get error:', err.message);
    return null;
  }
}

export async function setCachedAnswer(question: string, answer: string, gradeBand: string = 'general'): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return;
  }
  try {
    await redis.set(cacheKey(question, gradeBand), answer, { ex: TTL_SECONDS });
  } catch (err: any) {
    console.error('Redis cache set error:', err.message);
  }
}
