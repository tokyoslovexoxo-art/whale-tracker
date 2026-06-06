import { runWhaleTracker } from './track';
export const config = { maxDuration: 60 };
export default async function handler(req, res) {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (req.headers['x-vercel-cron'] !== '1') return res.status(401).json({ error: 'Unauthorized' });
      }
          try {
          const result = await runWhaleTracker();
          res.status(200).json({ ok: true, walletsChecked: result.walletsChecked, alertsSent: result.alerts.length });
          } catch (err) {
          console.error('[WHALE CRON] Error:', err);
          res.status(500).json({ error: err.message });
        }
      }
