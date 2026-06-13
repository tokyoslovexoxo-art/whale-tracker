import Anthropic from '@anthropic-ai/sdk';
import { TRACKED_WALLETS, MIN_TRADE_USD, ALERT_WALLET_TYPES, MIN_WIN_RATE } from '../../lib/wallets';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MORALIS_KEY = process.env.MORALIS_API_KEY;
const recentAlerts = new Set();

// ─── APEX PROMPT GENERATOR ───────────────────────────────────────────────────
// Builds the perfect prompt to paste into APEX for full institutional analysis
function buildApexPrompt(wallet, tokenName, tokenSymbol, tokenAddress, chain, price, usdValue, rugRisk, catalyst, marketCap) {
  const dex = chain === 'solana' ? 'jup.ag' : chain === 'bsc' ? 'pancakeswap.finance' : 'app.uniswap.org';
  return `A high win-rate whale wallet just bought a token. Analyze if this is worth copying.

WALLET: ${wallet.label} | Type: ${wallet.type} | Win Rate: ${wallet.knownWinRate}% | Chain: ${chain.toUpperCase()}
TOKEN: ${tokenName} (${tokenSymbol})
CONTRACT: ${tokenAddress}
CURRENT PRICE: $${price}
WHALE SPENT: ~$${usdValue?.toLocaleString() || 'Unknown'}
${marketCap && marketCap !== 'Unknown' ? 'MARKET CAP: ' + marketCap : ''}
RUG RISK (pre-screened): ${rugRisk}
${catalyst && catalyst !== 'Unknown' ? 'CATALYST FOUND: ' + catalyst : ''}
BUY ON: ${dex}

Analyze if this whale buy is worth copying RIGHT NOW:
1. Is the entry price still good or already too extended after the whale buy?
2. Technical setup on the 15 minute chart — breaking out or at a key level?
3. Is there a real catalyst behind this specific buy today?
4. What is the realistic upside from current price?
5. Exact entry zone, stop loss, and take profit targets (T1, T2)
6. Position size recommendation — max 0.5% given meme coin risk
7. Final verdict: COPY TRADE or SKIP with clear reasoning
8. Latest time to exit if targets not hit

This wallet has a ${wallet.knownWinRate}% historical win rate. Give me a fast decisive analysis.`;
}

// ─── MORALIS API ─────────────────────────────────────────────────────────────
async function getWalletTransactions(wallet) {
  try {
    const { address, chain } = wallet;
    let url, headers;
    if (chain === 'solana') {
      url = `https://solana-gateway.moralis.io/account/mainnet/${address}/swaps?limit=3`;
      headers = { 'X-API-Key': MORALIS_KEY, accept: 'application/json' };
    } else {
      const chainId = chain === 'bsc' ? '0x38' : '0x1';
      url = `https://deep-index.moralis.io/api/v2.2/${address}/erc20/transfers?chain=${chainId}&limit=3`;
      headers = { 'X-API-Key': MORALIS_KEY, accept: 'application/json' };
    }
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.result || data?.swaps || [];
  } catch (err) {
    console.error(`[MORALIS] Error fetching ${wallet.address}:`, err.message);
    return [];
  }
}

async function getTokenPrice(tokenAddress, chain) {
  try {
    let url;
    if (chain === 'solana') {
      url = `https://solana-gateway.moralis.io/token/mainnet/${tokenAddress}/price`;
    } else {
      const chainId = chain === 'bsc' ? '0x38' : '0x1';
      url = `https://deep-index.moralis.io/api/v2.2/erc20/${tokenAddress}/price?chain=${chainId}`;
    }
    const res = await fetch(url, { headers: { 'X-API-Key': MORALIS_KEY } });
    if (!res.ok) return 0;
    const data = await res.json();
    return parseFloat(data?.usdPrice || data?.usdPriceFormatted || 0);
  } catch { return 0; }
}

async function getTokenMetadata(tokenAddress, chain) {
  try {
    if (chain === 'solana') {
      const res = await fetch(
        `https://solana-gateway.moralis.io/token/mainnet/${tokenAddress}/metadata`,
        { headers: { 'X-API-Key': MORALIS_KEY } }
      );
      if (!res.ok) return {};
      return await res.json();
    }
    const chainId = chain === 'bsc' ? '0x38' : '0x1';
    const res = await fetch(
      `https://deep-index.moralis.io/api/v2.2/erc20/metadata?chain=${chainId}&addresses%5B0%5D=${tokenAddress}`,
      { headers: { 'X-API-Key': MORALIS_KEY } }
    );
    if (!res.ok) return {};
    const data = await res.json();
    return data?.[0] || {};
  } catch { return {}; }
}

// ─── CLAUDE ANALYSIS ─────────────────────────────────────────────────────────
// Lightweight rug check + catalyst search — uses cheap Haiku model
// Only runs when a qualifying trade is detected — not on every cron tick
async function analyzeWithClaude(wallet, tokenMeta, tokenAddress, chain, price, usdValue) {
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `A ${wallet.knownWinRate}% win-rate ${wallet.type} wallet just bought ${tokenMeta.name || 'Unknown'} (${tokenMeta.symbol || '???'}) on ${chain}. Contract: ${tokenAddress}. Current price: $${price}. Trade value: ~$${usdValue?.toLocaleString()}.

Do ONE targeted web search to find:
1. Is this token legitimate or a known rug/scam?
2. Any news or catalyst behind this buy today?
3. Market cap if findable

Return ONLY valid JSON — no markdown:
{
  "shouldAlert": true or false,
  "rugRisk": "LOW|MEDIUM|HIGH",
  "rugReason": "why this risk level",
  "catalyst": "specific news found or Unknown",
  "marketCap": "market cap if found or Unknown",
  "warning": "any critical warning or null",
  "confidence": 1-10
}`
      }]
    });

    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    try { return JSON.parse(clean); }
    catch {
      const m = clean.match(/\{[\s\S]*\}/);
      return m ? JSON.parse(m[0]) : { shouldAlert: true, rugRisk: 'MEDIUM', catalyst: 'Unknown', marketCap: 'Unknown', confidence: 5 };
    }
  } catch {
    // If Claude fails — still alert but flag as unverified
    return { shouldAlert: true, rugRisk: 'UNVERIFIED', catalyst: 'Unknown', marketCap: 'Unknown', confidence: 3, warning: 'Claude analysis unavailable — verify manually before trading' };
  }
}

// ─── TELEGRAM ────────────────────────────────────────────────────────────────
async function sendTelegram(message) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) {
    console.warn('[TELEGRAM] Missing credentials — skipping notification');
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
    if (!res.ok) console.error('[TELEGRAM] Send failed:', await res.text());
  } catch (err) {
    console.error('[TELEGRAM] Error:', err.message);
  }
}

// ─── MAIN TRACKER ────────────────────────────────────────────────────────────
export async function runWhaleTracker() {
  const results = [];
  const alerts  = [];

  const wallets = TRACKED_WALLETS.filter(w =>
    ALERT_WALLET_TYPES.includes(w.type) && w.knownWinRate >= MIN_WIN_RATE
  );

  console.log(`[TRACKER] Checking ${wallets.length} elite wallets...`);

  for (const wallet of wallets) {
    try {
      const txns = await getWalletTransactions(wallet);
      if (!txns?.length) continue;

      const latestTx = txns[0];
      if (!latestTx) continue;

      // Extract token address — handle ETH, SOL, BSC formats
      const tokenAddress =
        latestTx.address      ||
        latestTx.tokenAddress ||
        latestTx.mint         ||
        latestTx.toToken?.address ||
        latestTx.bought_address;

      if (!tokenAddress) continue;

      // Dedup — skip if we already alerted this exact trade
      const txHash = latestTx.transactionHash || latestTx.signature || latestTx.blockHash || '';
      const dedupKey = `${wallet.address}-${tokenAddress}-${txHash}`;
      if (recentAlerts.has(dedupKey)) continue;

      // Get token info and price in parallel
      const [tokenMeta, price] = await Promise.all([
        getTokenMetadata(tokenAddress, wallet.chain),
        getTokenPrice(tokenAddress, wallet.chain),
      ]);

      // Estimate USD value of the trade
      const rawAmount = parseFloat(
        latestTx.value          ||
        latestTx.uiAmountString ||
        latestTx.outAmount      ||
        latestTx.bought_amount  || 0
      );
      const usdValue = price > 0 ? rawAmount * price : 0;

      // Skip trades below minimum threshold
      if (usdValue > 0 && usdValue < MIN_TRADE_USD) {
        console.log(`[TRACKER] ${wallet.label} trade too small: $${usdValue.toFixed(0)} < $${MIN_TRADE_USD}`);
        continue;
      }

      console.log(`[TRACKER] ${wallet.label} bought ${tokenMeta.symbol || tokenAddress.slice(0,8)} — ~$${usdValue.toFixed(0)}`);

      // Run Claude analysis — rug check + catalyst search
      const analysis = await analyzeWithClaude(wallet, tokenMeta, tokenAddress, wallet.chain, price, usdValue);

      // Mark as seen regardless of outcome to avoid reprocessing
      recentAlerts.add(dedupKey);
      setTimeout(() => recentAlerts.delete(dedupKey), 45 * 60 * 1000); // 45 min window

      // Build APEX prompt
      const apexPrompt = buildApexPrompt(
        wallet,
        tokenMeta.name   || 'Unknown Token',
        tokenMeta.symbol || '???',
        tokenAddress,
        wallet.chain,
        price,
        usdValue,
        analysis.rugRisk,
        analysis.catalyst,
        analysis.marketCap
      );

      const tradeResult = {
        wallet,
        tokenAddress,
        tokenName:   tokenMeta.name   || tokenMeta.symbol || 'Unknown Token',
        tokenSymbol: tokenMeta.symbol || '???',
        price,
        usdValue,
        analysis,
        apexPrompt,
        timestamp: new Date().toISOString(),
      };

      results.push(tradeResult);

      // Only alert if Claude says it's worth it and rug risk is not HIGH
      if (analysis.shouldAlert && analysis.rugRisk !== 'HIGH') {
        alerts.push(tradeResult);

        const rugEmoji   = { LOW: '🟢', MEDIUM: '🟡', UNVERIFIED: '⚪' }[analysis.rugRisk] || '🔴';
        const dex        = wallet.chain === 'solana' ? 'jup.ag' : wallet.chain === 'bsc' ? 'pancakeswap.finance' : 'app.uniswap.org';
        const chainLabel = wallet.chain.toUpperCase();

        // Alert message 1 — trade details
        const alertMsg =
          `🐋 <b>WHALE COPY TRADE ALERT</b>\n\n` +
          `👛 <b>${wallet.label}</b> (${wallet.type.replace('_',' ')})\n` +
          `📊 Win Rate: <b>${wallet.knownWinRate}%</b> | Chain: <b>${chainLabel}</b>\n\n` +
          `💎 Token: <b>${tokenMeta.name || 'Unknown'} (${tokenMeta.symbol || '???'})</b>\n` +
          `📋 CA: <code>${tokenAddress}</code>\n` +
          `💰 Whale Bought: ~<b>$${usdValue?.toLocaleString() || 'Unknown'}</b>\n` +
          `📈 Current Price: <b>$${price}</b>\n` +
          (analysis.marketCap && analysis.marketCap !== 'Unknown' ? `🏦 Market Cap: <b>${analysis.marketCap}</b>\n` : '') +
          `\n${rugEmoji} Rug Risk: <b>${analysis.rugRisk}</b> | Confidence: <b>${analysis.confidence}/10</b>\n` +
          `⚡ Catalyst: ${analysis.catalyst || 'Unknown'}\n` +
          (analysis.warning ? `\n⚠️ <b>${analysis.warning}</b>\n` : '') +
          `\n🔗 Buy on: <b>${dex}</b>`;

        await sendTelegram(alertMsg);
        await new Promise(r => setTimeout(r, 600));

} else {
        console.log(`[TRACKER] ${wallet.label} trade filtered — rugRisk: ${analysis.rugRisk} shouldAlert: ${analysis.shouldAlert}`);
      }

    } catch (err) {
      console.error(`[TRACKER] Error processing ${wallet.label}:`, err.message);
    }

    // Rate limit between wallets
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`[TRACKER] Done. ${results.length} trades found, ${alerts.length} alerts sent.`);
  return { results, alerts, walletsChecked: wallets.length };
}

export const config = {
  api: { bodyParser: true, responseLimit: false },
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const result = await runWhaleTracker();
    res.status(200).json(result);
  } catch (err) {
    console.error('[HANDLER] Error:', err);
    res.status(500).json({ error: err.message || 'Tracker failed' });
  }
                                }
