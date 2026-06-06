export const TRACKED_WALLETS = [
    // ETH SMART MONEY
  { address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296', label: 'ETH Whale #1', chain: 'eth', type: 'SMART_MONEY', knownWinRate: 84, notes: 'Consistently early on ETH bluechip moves' },
  { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', label: 'Vitalik.eth', chain: 'eth', type: 'INFLUENCER', knownWinRate: 70, notes: 'Ethereum founder' },
  { address: '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503', label: 'Known Whale #2', chain: 'eth', type: 'WHALE', knownWinRate: 79, notes: 'Large cap accumulator' },
    // SOLANA SMART MONEY
  { address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', label: 'SOL Meme Sniper #1', chain: 'solana', type: 'MEME_SNIPER', knownWinRate: 91, notes: 'Catches Solana meme coins in first 10 minutes' },
  { address: 'GThUX1Atko4tqhN2NaiTazWSeFWMuiUvfFnyJyUghFMJ', label: 'SOL Smart Money #1', chain: 'solana', type: 'SMART_MONEY', knownWinRate: 85, notes: 'Early buyer on Solana ecosystem tokens' },
  { address: 'AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2', label: 'Pump.fun Early Buyer', chain: 'solana', type: 'MEME_SNIPER', knownWinRate: 88, notes: 'First buyer on graduating Pump.fun tokens' },
  { address: '7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5', label: 'SOL Meme Sniper #2', chain: 'solana', type: 'MEME_SNIPER', knownWinRate: 86, notes: 'High win rate on viral Solana meme coins' },
    // BSC
  { address: '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3', label: 'BSC Whale #1', chain: 'bsc', type: 'WHALE', knownWinRate: 76, notes: 'Large BSC meme coin accumulator' },
    // ADD YOUR OWN WALLETS BELOW THIS LINE
  ];

export const MIN_TRADE_USD = parseInt(process.env.MIN_TRADE_USD || '5000');
export const DEDUP_WINDOW_MINUTES = 30;
export const ALERT_WALLET_TYPES = ['SMART_MONEY', 'WHALE', 'MEME_SNIPER', 'INFLUENCER'];
export const MIN_WIN_RATE = 70;
