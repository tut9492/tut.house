import { createPublicClient, http, parseAbi, verifyMessage } from 'viem';

export const MEGAETH_RPC = process.env.MEGAETH_RPC || 'https://mainnet.megaeth.com/rpc';
export const LEADERBOARD_ADDRESS =
  (process.env.COLLECTOR_LEADERBOARD_ADDRESS || '0xd84Cbba8D0Cd43Aa09E315faFa462bE66Df35E9f') as `0x${string}`;

const megaeth = {
  id: 4326,
  name: 'MegaETH',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [MEGAETH_RPC] } },
};

const leaderboardAbi = parseAbi([
  'function getScore(address addr) view returns (uint256)',
  'function getAllScores() view returns (address[] addrs, uint256[] scores)',
]);

export const SCORE_MESSAGE_PREFIX = 'Verify tut.house collector access';
export const DISCORD_VERIFY_MESSAGE_PREFIX = 'Verify tut.house Discord collector role';
const MESSAGE_TTL_MS = 5 * 60 * 1000;

export type CollectorProof = {
  wallet: string;
  message: string;
  signature: `0x${string}`;
};

export function normalizeWallet(wallet: string): `0x${string}` {
  const clean = String(wallet || '').trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(clean)) {
    throw new Error('Invalid wallet address');
  }
  return clean.toLowerCase() as `0x${string}`;
}

export function buildCollectorMessage(wallet: string, timestamp: number, nonce: string): string {
  return [
    SCORE_MESSAGE_PREFIX,
    `Wallet: ${normalizeWallet(wallet)}`,
    `Timestamp: ${timestamp}`,
    `Nonce: ${nonce}`,
  ].join('\n');
}

export function parseCollectorMessage(message: string): { wallet: `0x${string}`; timestamp: number; nonce: string } {
  const lines = String(message || '').split('\n');
  if (lines[0] !== SCORE_MESSAGE_PREFIX) throw new Error('Invalid message prefix');

  const wallet = normalizeWallet((lines.find((line) => line.startsWith('Wallet: ')) || '').replace('Wallet: ', ''));
  const timestamp = Number((lines.find((line) => line.startsWith('Timestamp: ')) || '').replace('Timestamp: ', ''));
  const nonce = (lines.find((line) => line.startsWith('Nonce: ')) || '').replace('Nonce: ', '').trim();

  if (!Number.isFinite(timestamp)) throw new Error('Invalid timestamp');
  if (!nonce || nonce.length > 128) throw new Error('Invalid nonce');
  if (Math.abs(Date.now() - timestamp) > MESSAGE_TTL_MS) throw new Error('Signature expired');

  return { wallet, timestamp, nonce };
}

export async function verifyCollectorProof(proof: CollectorProof): Promise<`0x${string}`> {
  const parsed = parseCollectorMessage(proof.message);
  const requestedWallet = normalizeWallet(proof.wallet);
  if (requestedWallet !== parsed.wallet) throw new Error('Wallet mismatch');

  const valid = await verifyMessage({
    address: parsed.wallet,
    message: proof.message,
    signature: proof.signature,
  });
  if (!valid) throw new Error('Invalid signature');

  return parsed.wallet;
}

export function buildDiscordVerifyMessage(wallet: string, discordUserId: string, timestamp: number): string {
  return [
    DISCORD_VERIFY_MESSAGE_PREFIX,
    `Wallet: ${normalizeWallet(wallet)}`,
    `Discord User: ${String(discordUserId || '').trim()}`,
    `Timestamp: ${timestamp}`,
  ].join('\n');
}

export async function verifyDiscordWalletProof({
  wallet,
  discordUserId,
  timestamp,
  signature,
}: {
  wallet: string;
  discordUserId: string;
  timestamp: number;
  signature: `0x${string}`;
}): Promise<`0x${string}`> {
  const normalized = normalizeWallet(wallet);
  if (!discordUserId || !/^\d{5,32}$/.test(discordUserId)) throw new Error('Invalid Discord user');
  if (!Number.isFinite(timestamp)) throw new Error('Invalid timestamp');
  if (Math.abs(Date.now() - timestamp) > MESSAGE_TTL_MS) throw new Error('Signature expired');

  const message = buildDiscordVerifyMessage(normalized, discordUserId, timestamp);
  const valid = await verifyMessage({ address: normalized, message, signature });
  if (!valid) throw new Error('Invalid signature');
  return normalized;
}

export async function getCollectorScore(wallet: string): Promise<number> {
  const normalized = normalizeWallet(wallet);
  const client = createPublicClient({
    chain: megaeth,
    transport: http(MEGAETH_RPC),
  });

  try {
    const score = await client.readContract({
      address: LEADERBOARD_ADDRESS,
      abi: leaderboardAbi,
      functionName: 'getScore',
      args: [normalized],
    });
    return Number(score);
  } catch {
    const [addrs, scores] = await client.readContract({
      address: LEADERBOARD_ADDRESS,
      abi: leaderboardAbi,
      functionName: 'getAllScores',
    });

    const idx = addrs.findIndex((addr) => addr.toLowerCase() === normalized);
    return idx >= 0 ? Number(scores[idx]) : 0;
  }
}

export async function getCollectorLeaderboard(limit = 50): Promise<Array<{ wallet: `0x${string}`; score: number; rank: string }>> {
  const client = createPublicClient({
    chain: megaeth,
    transport: http(MEGAETH_RPC),
  });

  const [addrs, scores] = await client.readContract({
    address: LEADERBOARD_ADDRESS,
    abi: leaderboardAbi,
    functionName: 'getAllScores',
  });

  return addrs
    .map((wallet, index) => {
      const score = Number(scores[index] ?? 0);
      return {
        wallet: wallet.toLowerCase() as `0x${string}`,
        score,
        rank: scoreRank(score),
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(200, limit)));
}

export function scoreRank(score: number): string {
  if (score >= 100000) return 'Legend';
  if (score >= 25000) return 'Whale';
  if (score >= 5000) return 'Collector';
  if (score > 0) return 'Holder';
  return 'Unscored';
}
