import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

// RevenueCat sends: Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
// Configure this exact string in the RevenueCat dashboard under Webhooks.
router.post('/webhook', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const expectedSecret = process.env.REVENUECAT_WEBHOOK_SECRET;

  // Strict security check: reject if secret is not set in backend env OR header does not match
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    console.error('❌ Webhook security rejection: Invalid or unconfigured REVENUECAT_WEBHOOK_SECRET');
    return res.status(401).json({ error: 'Unauthorized webhook request' });
  }

  const event = req.body?.event;
  if (!event) {
    return res.status(400).json({ error: 'Malformed webhook payload' });
  }

  // app_user_id must be set to the Supabase auth user id when the mobile app
  // configures RevenueCat — that's what makes this lookup work.
  const parentId = event.app_user_id;
  const activatingTypes = ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE'];
  const deactivatingTypes = ['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE'];

  try {
    if (activatingTypes.includes(event.type)) {
      await supabaseAdmin.from('profiles').update({ is_premium: true }).eq('id', parentId);
    } else if (deactivatingTypes.includes(event.type)) {
      await supabaseAdmin.from('profiles').update({ is_premium: false }).eq('id', parentId);
    }
    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('RevenueCat webhook error:', error.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
