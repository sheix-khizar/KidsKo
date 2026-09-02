import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

// Estimated cost constants per event type (USD)
const EVENT_COSTS: Record<string, number> = {
  message: 0.0005,
  scan: 0.002,
  cache_hit: 0.0,
  live_snapshot: 0.005,
  voice_trial: 0.023,
};

// GET /api/admin/usage — Analytics endpoint returning DAU, MAU, and cost breakdown per feature
router.get('/usage', requireAuth, async (req: Request, res: Response) => {
  try {
    // 1. Strict Unconditional Admin Authorization Check
    const adminSecret = req.headers['x-admin-secret'];
    const expectedSecret = process.env.ADMIN_SECRET_KEY;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', req.user!.id)
      .maybeSingle();

    const isAdmin = profile?.is_admin === true || (expectedSecret && adminSecret === expectedSecret);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Access denied. Admin authorization required.' });
    }

    // 2. Use service-role client (supabaseAdmin) to bypass RLS for global cross-account analytics
    const client = supabaseAdmin;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. DAU: Distinct parents active today
    const { data: dauData } = await client
      .from('usage_events')
      .select('parent_id')
      .gte('created_at', startOfDay);

    const dauCount = dauData ? new Set(dauData.map((d) => d.parent_id)).size : 0;

    // 2. MAU: Distinct parents active in the last 30 days
    const { data: mauData } = await client
      .from('usage_events')
      .select('parent_id')
      .gte('created_at', thirtyDaysAgo);

    const mauCount = mauData ? new Set(mauData.map((m) => m.parent_id)).size : 0;

    // 3. Feature Breakdown & Cost Estimation (last 30 days)
    const { data: eventsData } = await client
      .from('usage_events')
      .select('event_type, created_at')
      .gte('created_at', thirtyDaysAgo);

    const breakdown: Record<string, { count: number; estimatedCostUsd: number }> = {
      message: { count: 0, estimatedCostUsd: 0 },
      scan: { count: 0, estimatedCostUsd: 0 },
      cache_hit: { count: 0, estimatedCostUsd: 0 },
      live_snapshot: { count: 0, estimatedCostUsd: 0 },
      voice_trial: { count: 0, estimatedCostUsd: 0 },
    };

    let totalCostUsd = 0;

    if (eventsData) {
      for (const ev of eventsData) {
        const type = ev.event_type || 'message';
        if (!breakdown[type]) {
          breakdown[type] = { count: 0, estimatedCostUsd: 0 };
        }
        const unitCost = EVENT_COSTS[type] || 0.001;
        breakdown[type].count += 1;
        breakdown[type].estimatedCostUsd += unitCost;
        totalCostUsd += unitCost;
      }
    }

    // Format costs to 4 decimal places
    for (const key of Object.keys(breakdown)) {
      breakdown[key].estimatedCostUsd = Number(breakdown[key].estimatedCostUsd.toFixed(4));
    }

    return res.status(200).json({
      timestamp: now.toISOString(),
      dau: dauCount,
      mau: mauCount,
      totalCostUsd: Number(totalCostUsd.toFixed(4)),
      featureBreakdown: breakdown,
    });
  } catch (err: any) {
    console.error('[Admin Usage Analytics Error]:', err.message);
    return res.status(500).json({ error: 'Could not fetch usage analytics' });
  }
});

export default router;
