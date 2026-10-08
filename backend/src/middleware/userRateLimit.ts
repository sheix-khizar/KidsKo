import { Request, Response, NextFunction } from 'express';

const chatRequestLog = new Map<string, number[]>();
const imageRequestLog = new Map<string, number[]>();

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10;

function rateLimitFactory(store: Map<string, number[]>, max: number) {
  return function (req: Request, res: Response, next: NextFunction) {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const now = Date.now();
    const timestamps = store.get(userId) || [];
    const recent = timestamps.filter((t) => now - t < WINDOW_MS);

    if (recent.length >= max) {
      return res.status(429).json({
        error: 'Slow down! Please wait a moment before sending another request.',
      });
    }

    recent.push(now);
    store.set(userId, recent);
    next();
  };
}

export const userRateLimit = rateLimitFactory(chatRequestLog, MAX_REQUESTS);
export const imageRateLimit = rateLimitFactory(imageRequestLog, 5);
