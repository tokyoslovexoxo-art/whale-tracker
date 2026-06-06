// TOP 5 HIGHEST WIN-RATE WALLETS ONLY
// Keeping to 5 wallets to stay within Moralis free tier (40k requests/month)
// Each wallet = ~3 API calls per scan, 5 wallets = 15 calls per scan
// Every 5 min = 4,320 calls/day — well within free limit

export const TRACKED_WALLETS = [
  {
    address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    label: 'SOL Meme Sniper #1',
    chain: 'solana',
    type: 'MEME_SNIPER',
    knownWinRate: 91,
    notes: 'Catches Solana meme coins in first 10 minutes — highest win rate',
  },
  {
    address: 'AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2',
    label: 'Pump.fun Early Buyer',
    chain: 'solana',
    type: 'MEME_SNIPER',
    knownWinRate: 88,
    notes: 'First buyer on graduating Pump.fun tokens',
  },
  {
    address: '7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5',
    label: 'SOL Meme Sniper #2',
    chain: 'solana',
    type: 'MEME_SNIPER',
    knownWinRate: 86,
    notes: 'High win rate on viral Solana meme coins',
  },
  {
    address: 'GThUX1Atko4tqhN2NaiTazWSeFWMuiUvfFnyJyUghFMJ',
    label: 'SOL Smart Money #1',
    chain: 'solana',
    type: 'SMART_MONEY',
    knownWinRate: 85,
    notes: 'Early buyer on Solana ecosystem tokens',
  },
  {
    address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296',
    label: 'ETH Whale #1',
    chain: 'eth',
    type: 'SMART_MONEY',
    knownWinRate: 84,
    notes: 'Consistently early on ETH bluechip moves',
  },
  // ADD YOUR OWN WALLETS BELOW THIS LINE
];

export const MIN_TRADE_USD = parseInt(process.env.MIN_TRADE_USD || '5000');
export const DEDUP_WINDOW_MINUTES = 45;
export const ALERT_WALLET_TYPES = ['SMART_MONEY', 'WHALE', 'MEME_SNIPER', 'INFLUENCER'];
export const MIN_WIN_RATE = 80;
