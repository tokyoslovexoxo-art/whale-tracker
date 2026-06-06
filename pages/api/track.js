import Anthropic from "@anthropic-ai/sdk";
import { TRACKED_WALLETS, MIN_TRADE_USD, ALERT_WALLET_TYPES, MIN_WIN_RATE } from "../../lib/wallets";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MORALIS_KEY = process.env.MORALIS_API_KEY;

// In-memory dedup store (resets on cold start — acceptable for our use case)
const recentAlerts = new Set();

// ─────────────────────────────────────────────────────────────────────────────
// MORALIS API HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function getWalletTransactions(wallet) {
  try {
    const { address, chain } = wallet;

    let url, headers;

    if (chain === "solana") {
      // Solana via Moralis
      url = `https://solana-gateway.moralis.io/account/mainnet/${address}/swaps?limit=5`;
      headers = { "X-API-Key": MORALIS_KEY, accept: "application/json" };
    } else {
      // ETH / BSC via Moralis EVM
      const chainId = chain === "bsc" ? "0x38" : "0x1";
      url = `https://deep-index.moralis.io/api/v2.2/${address}/erc20/transfers?chain=${chainId}&limit=5`;
      headers = { "X-API-Key": MORALIS_KEY, accept: "application/json" };
    }

    const res  = await fetch(url, { headers });
    const data = await res.json();
    return data?.result || data?.swaps || [];
  } catch (err) {
    console.error(`Error fetching ${wallet.address}:`, err.message);
    return [];
  }
}

async function getTokenPrice(tokenAddress, chain) {
  try {
    const chainId = chain === "bsc" ? "0x38" : chain === "solana" ? "solana" : "0x1";
    let url;
    if (chain === "solana") {
      url = `https://solana-gateway.moralis.io/token/mainnet/${tokenAddress}/price`;
    } else {
      url = `https://deep-index.moralis.io/api/v2.2/erc20/${tokenAddress}/price?chain=${chainId}`;
    }
    const res  = await fetch(url, { headers: { "X-API-Key": MORALIS_KEY } });
    const data = await res.json();
    return data?.usdPrice || data?.usdPriceFormatted || 0;
  } catch {
    return 0;
  }
}

async function getTokenMetadata(tokenAddress, chain) {
  try {
    const chainId = chain === "bsc" ? "0x38" : "0x1";
    if (chain === "solana") {
      const res  = await fetch(`https://solana-gateway.moralis.io/token/mainnet/${tokenAddress}/metadata`, {
        headers: { "X-API-Key": MORALIS_KEY },
      });
      return await res.json();
    }
    const res  = await fetch(`https://deep-index.moralis.io/api/v2.2/erc20/metadata?chain=${chainId}&addresses%5B0%5D=${tokenAddress}`, {
      headers: { "X-API-Key": MORALIS_KEY },
    });
    const data = await res.json();
    return data?.[0] || {};
  } catch {
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAUDE TRADE ANALYSIS
// Quick AI assessment of the copied trade
// ─────────────────────────────────────────────────────────────────────────────
async function analyzeTradeWithClaude(wallet, trade, tokenMeta, price) {
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `A high win-rate crypto wallet just bought a token. Quickly assess if we should copy this trade.

WALLET INFO:
Label: ${wallet.label}
Type: ${wallet.type}
Known Win Rate: ${wallet.knownWinRate}%
Chain: ${wallet.chain}

TOKEN BOUGHT:
Name: ${tokenMeta.name || "Unknown"}
Symbol: ${tokenMeta.symbol || "Unknown"}
Contract: ${trade.tokenAddress || trade.mint || "Unknown"}
Current Price: $${price}
Trade Value: ~$${trade.usdValue || "Unknown"}

Do ONE quick search to find out:
1. Is this token legitimate or a potential rug?
2. Any news or catalyst behind this buy?
3. What is the market cap if findable?
4. Should we copy this trade right now?

Return ONLY valid JSON:
{
  "shouldCopy": true or false,
  "confidence": 1-10,
  "reason": "one sentence why",
  "rugRisk": "LOW|MEDIUM|HIGH",
  "catalyst": "any news or reason found or Unknown",
  "marketCap": "market cap if found or Unknown",
  "copyEntry": "price to enter or same as current",
  "copyStop": "suggested stop loss price",
  "copyTarget1": "first take profit target",
  "copyTarget2": "second take profit target",
  "timeLimit": "exit by when if no move e.g. 4 hours",
  "warning": "any warning or null"
}`,
      }],
    });

    const text  = msg.content.filter(b => b.type === "text").map(b => b.text).join("");
    const clean = text.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(clean);
    } catch {
      const m = clean.match(/\{[\s\S]*\}/);
      return m ? JSON.parse(m[0]) : { shouldCopy: false, confidence: 3, reason: "Analysis failed", rugRisk: "MEDIUM" };
    }
  } catch {
    return { shouldCopy: false, confidence: 3, reason: "Analysis unavailable", rugRisk: "MEDIUM" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TELEGRAM NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────
async function sendTelegram(message) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN TRACKER
// ─────────────────────────────────────────────────────────────────────────────
export async function runWhaleTracker() {
  const results = [];
  const alerts  = [];

  // Filter to only alert-worthy wallet types
  const wallets = TRACKED_WALLETS.filter(w =>
    ALERT_WALLET_TYPES.includes(w.type) && w.knownWinRate >= MIN_WIN_RATE
  );

  for (const wallet of wallets) {
    try {
      const txns = await getWalletTransactions(wallet);
      if (!txns || txns.length === 0) continue;

      // Check most recent transaction
      const latestTx = txns[0];
      if (!latestTx) continue;

      // Get token address
      const tokenAddress = latestTx.address || latestTx.tokenAddress ||
                           latestTx.mint    || latestTx.toToken?.address;
      if (!tokenAddress) continue;

      // Create dedup key
      const dedupKey = `${wallet.address}-${tokenAddress}-${latestTx.blockHash || latestTx.signature || Date.now()}`;
      if (recentAlerts.has(dedupKey)) continue;

      // Get token info and price
      const [tokenMeta, price] = await Promise.all([
        getTokenMetadata(tokenAddress, wallet.chain),
        getTokenPrice(tokenAddress, wallet.chain),
      ]);

      // Estimate USD value
      const amount   = parseFloat(latestTx.value || latestTx.uiAmountString || latestTx.outAmount || 0);
      const usdValue = price ? amount * price : 0;

      // Skip if below minimum trade size
      if (usdValue < MIN_TRADE_USD && usdValue > 0) continue;

      // Get Claude's assessment
      const analysis = await analyzeTradeWithClaude(
        wallet,
        { ...latestTx, tokenAddress, usdValue },
        tokenMeta,
        price,
      );

      // Mark as seen
      recentAlerts.add(dedupKey);
      // Clean up old entries after 30 min
      setTimeout(() => recentAlerts.delete(dedupKey), 30 * 60 * 1000);

      const tradeResult = {
        wallet,
        tokenAddress,
        tokenName:   tokenMeta.name   || tokenMeta.symbol || "Unknown Token",
        tokenSymbol: tokenMeta.symbol || "???",
        price,
        usdValue,
        analysis,
        timestamp: new Date().toISOString(),
      };

      results.push(tradeResult);

      // Only alert if Claude says to copy
      if (analysis.shouldCopy && analysis.rugRisk !== "HIGH") {
        alerts.push(tradeResult);

        // Build Telegram message
        const rugEmoji = analysis.rugRisk === "LOW" ? "🟢" : analysis.rugRisk === "MEDIUM" ? "🟡" : "🔴";
        const msg =
          `🐋 <b>WHALE COPY TRADE ALERT</b>\n\n` +
          `👛 <b>${wallet.label}</b> (${wallet.type})\n` +
          `📊 Win Rate: <b>${wallet.knownWinRate}%</b> | Chain: ${wallet.chain.toUpperCase()}\n\n` +
          `💎 Token: <b>${tokenMeta.name || "Unknown"} (${tokenMeta.symbol || "???"})</b>\n` +
          `📋 CA: <code>${tokenAddress}</code>\n` +
          `💰 Whale Bought: ~<b>$${usdValue.toLocaleString()}</b>\n` +
          `📈 Current Price: <b>$${price}</b>\n` +
          `${analysis.marketCap !== "Unknown" ? `🏦 Market Cap: ${analysis.marketCap}\n` : ""}` +
          `\n` +
          `${rugEmoji} Rug Risk: <b>${analysis.rugRisk}</b>\n` +
          `🤖 Claude Confidence: <b>${analysis.confidence}/10</b>\n` +
          `⚡ Catalyst: ${analysis.catalyst || "Unknown"}\n\n` +
          `📊 <b>COPY TRADE LEVELS:</b>\n` +
          `Entry: <b>${analysis.copyEntry || "Market price"}</b>\n` +
          `Stop: <b>${analysis.copyStop || "Set -15%"}</b>\n` +
          `T1: <b>${analysis.copyTarget1 || "Set +30%"}</b>\n` +
          `T2: <b>${analysis.copyTarget2 || "Set +60%"}</b>\n` +
          `⏰ Exit by: <b>${analysis.timeLimit || "4 hours"}</b>\n\n` +
          `💡 ${analysis.reason}\n` +
          (analysis.warning ? `\n⚠️ ${analysis.warning}` : "") +
          `\n\n🔗 Buy on: ${wallet.chain === "solana" ? "jup.ag" : wallet.chain === "bsc" ? "pancakeswap.finance" : "app.uniswap.org"}`;

        await sendTelegram(msg);
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (err) {
      console.error(`Error tracking ${wallet.address}:`, err.message);
    }

    // Rate limit protection
    await new Promise(r => setTimeout(r, 200));
  }

  return { results, alerts, walletsChecked: wallets.length };
}

export const config = {
  api: { bodyParser: true, responseLimit: false },
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const result = await runWhaleTracker();
    res.status(200).json(result);
  } catch (err) {
    console.error("Tracker error:", err);
    res.status(500).json({ error: err.message });
  }
}
