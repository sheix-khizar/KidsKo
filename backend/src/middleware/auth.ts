import { Request, Response, NextFunction } from 'express';
import { supabase, createUserScopedClient } from '../lib/supabase';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
      supabase?: ReturnType<typeof createUserScopedClient>;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = { id: data.user.id, email: data.user.email! };
  req.supabase = createUserScopedClient(token);
  next();
}
