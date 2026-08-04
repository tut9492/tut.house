import { createPublicClient, http, parseAbi, verifyMessage } from 'viem';

export const MEGAETH_RPC = process.env.MEGAETH_RPC || 'https://mainnet.megaeth.com/rpc';
export const ETH_RPC = process.env.ETH_RPC || 'https://eth.llamarpc.com';
export const LEADERBOARD_ADDRESS =
  (process.env.COLLECTOR_LEADERBOARD_ADDRESS || '0xd84Cbba8D0Cd43Aa09E315faFa462bE66Df35E9f') as `0x${string}`;
export const DEADBIT_CONTRACT = '0x8a01e97adc0a1883255ead1cd166629b983c80bf' as `0x${string}`;
export const DEADBIT_COLLECTION_SLUG = 'deadbit-nation-777112182';

const megaeth = {
  id: 4326,
  name: 'MegaETH',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [MEGAETH_RPC] } },
};

const ethereum = {
  id: 1,
  name: 'Ethereum',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [ETH_RPC] } },
};

const leaderboardAbi = parseAbi([
  'function getScore(address addr) view returns (uint256)',
  'function getAllScores() view returns (address[] addrs, uint256[] scores)',
]);
const erc721Abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
]);

export const SCORE_MESSAGE_PREFIX = 'Verify tut.house collector access';
export const DISCORD_VERIFY_MESSAGE_PREFIX = 'Verify tut.house Discord collector role';
const MESSAGE_TTL_MS = 5 * 60 * 1000;

export type CollectorProof = {
  wallet: string;
  message: string;
  signature: `0x${string}`;
};

export const REGULAR_POINTS = 100;
export const ONE_OF_ONE_POINTS = 10000;
export const MAX_MULTIPLIER = 2.4;
export const REGULAR_MILESTONES = [
  { min: 5, bonus: 500 },
  { min: 10, bonus: 2000 },
  { min: 25, bonus: 10000 },
  { min: 50, bonus: 25000 },
  { min: 100, bonus: 100000 },
] as const;
export const ONE_OF_ONE_IDS = [
  3144, 307, 1195, 346, 235, 2792, 2660, 932, 2891, 1641,
  1906, 876, 2109, 1527, 1661, 387, 1786, 1094, 931, 1790,
  2160, 2162, 2763, 2334, 3312, 2548, 2974, 303, 2238, 1880,
  1554, 2955, 2799, 2680, 1185, 3071, 621, 2972, 791, 214,
] as const;

export const PARTNER_COLLECTIONS = [
  { id: 'panks', name: 'PANKS', contract: '0x95995a9beaf89265de51104936c6ad9ee961cc88' as `0x${string}`, multiplier: 0.2, chain: 'ethereum' },
  { id: 'breadio', name: 'Breadio', contract: '0x015061aa806b5abab9ee453e366e18a713e8ea80' as `0x${string}`, multiplier: 0.2, chain: 'megaeth' },
  { id: 'nacci', name: 'Nacci Cartel', contract: '0x2e5902a40115bf36739949d9875be0bcd2384c05' as `0x${string}`, multiplier: 0.3, chain: 'megaeth' },
  { id: 'betman', name: 'Betman Genesis', contract: '0xa3a4EbF5AD43625A1F87F46491D5760EDC921E33' as `0x${string}`, multiplier: 0.5, chain: 'megaeth' },
  { id: 'digitrabbits', name: 'Digit Rabbits', contract: '0x509022b7038ba8f3e79799fc7ea3232f15811cc7' as `0x${string}`, multiplier: 0.1, chain: 'megaeth' },
  { id: 'badlydrawnbarry', name: 'Badly Drawn Barry', contract: '0xa7911e22b9bba3af9d43bbae3491aa50396cc453' as `0x${string}`, multiplier: 0.1, chain: 'megaeth' },
] as const;

export type ScorePartner = {
  id: string;
  name: string;
  count: number;
  multiplier: number;
  held: boolean;
};

export type ScoreBreakdown = {
  deadbitCount: number;
  regularCount: number;
  oneOfOneCount: number;
  base: number;
  milestoneBonus: number;
  multiplier: number;
  calculatedScore: number;
  onChainScore: number;
  rank: string;
  partners: ScorePartner[];
  formula: string;
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

async function erc721Balance(
  client: ReturnType<typeof createPublicClient>,
  contract: `0x${string}`,
  wallet: `0x${string}`,
): Promise<number> {
  try {
    const balance = await client.readContract({
      address: contract,
      abi: erc721Abi,
      functionName: 'balanceOf',
      args: [wallet],
    });
    return Number(balance);
  } catch {
    return 0;
  }
}

export function calculateScoreBreakdown({
  deadbitCount,
  oneOfOneCount,
  partners,
  onChainScore = 0,
}: {
  deadbitCount: number;
  oneOfOneCount: number;
  partners: ScorePartner[];
  onChainScore?: number;
}): ScoreBreakdown {
  const regularCount = Math.max(0, deadbitCount - oneOfOneCount);
  const base = deadbitCount * REGULAR_POINTS;
  const milestoneBonus =
    oneOfOneCount * ONE_OF_ONE_POINTS +
    REGULAR_MILESTONES.reduce((sum, milestone) => (
      deadbitCount >= milestone.min ? sum + milestone.bonus : sum
    ), 0);
  const rawMultiplier = 1 + partners
    .filter((partner) => partner.held)
    .reduce((sum, partner) => sum + partner.multiplier, 0);
  const multiplier = deadbitCount > 0 ? Math.min(rawMultiplier, MAX_MULTIPLIER) : 1;
  const calculatedScore = Math.floor((base + milestoneBonus) * multiplier);
  const score = Math.max(onChainScore, calculatedScore);

  return {
    deadbitCount,
    regularCount,
    oneOfOneCount,
    base,
    milestoneBonus,
    multiplier,
    calculatedScore,
    onChainScore,
    rank: scoreRank(score),
    partners,
    formula: 'score = floor((base + milestones) * multiplier)',
  };
}

export async function getCollectorScoreBreakdown(wallet: string): Promise<ScoreBreakdown> {
  const normalized = normalizeWallet(wallet);
  const megaClient = createPublicClient({
    chain: megaeth,
    transport: http(MEGAETH_RPC),
  });
  const ethClient = createPublicClient({
    chain: ethereum,
    transport: http(ETH_RPC),
  });

  const [deadbitCount, oneOfOneOwners, partners, onChainScore] = await Promise.all([
    erc721Balance(megaClient, DEADBIT_CONTRACT, normalized),
    Promise.all(ONE_OF_ONE_IDS.map(async (tokenId) => {
      try {
        const owner = await megaClient.readContract({
          address: DEADBIT_CONTRACT,
          abi: erc721Abi,
          functionName: 'ownerOf',
          args: [BigInt(tokenId)],
        });
        return owner.toLowerCase() === normalized;
      } catch {
        return false;
      }
    })),
    Promise.all(PARTNER_COLLECTIONS.map(async (partner) => {
      const client = partner.chain === 'ethereum' ? ethClient : megaClient;
      const count = await erc721Balance(client, partner.contract, normalized);
      return {
        id: partner.id,
        name: partner.name,
        count,
        multiplier: partner.multiplier,
        held: count > 0,
      };
    })),
    getCollectorScore(normalized),
  ]);

  return calculateScoreBreakdown({
    deadbitCount,
    oneOfOneCount: oneOfOneOwners.filter(Boolean).length,
    partners,
    onChainScore,
  });
}

export function scoreRank(score: number): string {
  if (score >= 100000) return 'Legend';
  if (score >= 25000) return 'Whale';
  if (score >= 5000) return 'Collector';
  if (score > 0) return 'Holder';
  return 'Unscored';
}
