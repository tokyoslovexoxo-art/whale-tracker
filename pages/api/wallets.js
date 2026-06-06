import { TRACKED_WALLETS } from '../../lib/wallets';
export default function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ wallets: TRACKED_WALLETS });
    res.status(405).json({ error: 'Method not allowed' });
    }
