import { Request, Response, NextFunction } from 'express';

// Simple in-memory store: { userId: [timestamps of recent requests] }
// Good enough for now — swap for Redis later if you run multiple server instances.
const requestLog = new Map<string, number[]>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10; // matches your free-tier daily message design intent, but per-minute burst protection

export function userRateLimit(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const now = Date.now();
  const timestamps = requestLog.get(userId) || [];
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Slow down! Please wait a moment before sending another message.',
    });
  }

  recent.push(now);
  requestLog.set(userId, recent);
  next();
}

// Separate, slightly more generous limiter for image analysis (Ticket 5.9 will formalize this further in Phase 5)
export function imageRateLimit(req: Request, res: Response, next: NextFunction) {
  return userRateLimit(req, res, next); // same logic, reused — kept as its own export for clarity in routes
}
