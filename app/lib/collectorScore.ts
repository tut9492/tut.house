import { verifyMessage } from 'viem';

const OPENSEA_API = 'https://api.opensea.io/api/v2';

export const SCORE_MESSAGE_PREFIX = 'Verify tut.house collector access';
export const DISCORD_VERIFY_MESSAGE_PREFIX = 'Verify tut.house Discord collector role';
const MESSAGE_TTL_MS = 5 * 60 * 1000;

export type CollectorProof = {
  wallet: string;
  message: string;
  signature: `0x${string}`;
};

export const TUT_COLLECTIONS = [
  { slug: 'kingtut-genesis', name: 'Tut Genesis', weight: 10000, kind: 'Genesis', chain: 'ethereum' },
  { slug: 'abstractions', name: 'Abstractions', weight: 5000, kind: 'Series', chain: 'ethereum' },
  { slug: 'obsessive-cycles-of-fiber', name: 'OCF', weight: 3000, kind: '1/1', chain: 'ethereum' },
  {
    slug: 'breadio',
    name: 'Breadio',
    weight: 1500,
    kind: 'MegaETH',
    chain: 'megaeth',
    contract: '0x015061aa806b5abab9ee453e366e18a713e8ea80',
  },
  {
    slug: 'tut-loudio',
    name: 'Tut Loudio',
    weight: 750,
    kind: 'Edition',
    chain: 'ethereum',
    contract: '0x3bea26866fce3596e7e994e45a0a65b74e16947e',
  },
] as const;

export const TUT_DEPTH_BONUSES = [
  { min: 3, bonus: 500 },
  { min: 5, bonus: 1500 },
  { min: 10, bonus: 5000 },
  { min: 25, bonus: 15000 },
] as const;

export type OwnedArtwork = {
  tokenId: string;
  title: string;
  image: string;
  permalink: string;
  collection: string;
  collectionSlug: string;
  weight: number;
};

export type ScoreCollection = {
  slug: string;
  name: string;
  kind: string;
  chain: string;
  contract?: string;
  weight: number;
  count: number;
  score: number;
  artworks: OwnedArtwork[];
};

export type ScoreBreakdown = {
  assetCount: number;
  oneOfOneCount: number;
  base: number;
  breadthBonus: number;
  depthBonus: number;
  calculatedScore: number;
  rank: string;
  collections: ScoreCollection[];
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
  return (await getCollectorScoreBreakdown(wallet)).calculatedScore;
}

function normalizeIpfsUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('ipfs://')) {
    const path = url.replace('ipfs://', '').replace(/^ipfs\//, '');
    return `https://ipfs.io/ipfs/${path}`;
  }
  return url;
}

export function calculateScoreBreakdown({
  collections,
}: {
  collections: ScoreCollection[];
}): ScoreBreakdown {
  const assetCount = collections.reduce((sum, collection) => sum + collection.count, 0);
  const oneOfOneCount = collections
    .filter((collection) => collection.kind === '1/1')
    .reduce((sum, collection) => sum + collection.count, 0);
  const base = collections.reduce((sum, collection) => sum + collection.score, 0);
  const uniqueCollections = collections.filter((collection) => collection.count > 0).length;
  const breadthBonus = uniqueCollections > 1 ? uniqueCollections * uniqueCollections * 250 : 0;
  const depthBonus = TUT_DEPTH_BONUSES.reduce((sum, milestone) => (
    assetCount >= milestone.min ? sum + milestone.bonus : sum
  ), 0);
  const calculatedScore = base + breadthBonus + depthBonus;

  return {
    assetCount,
    oneOfOneCount,
    base,
    breadthBonus,
    depthBonus,
    calculatedScore,
    rank: scoreRank(calculatedScore),
    collections,
    formula: 'score = weighted tut™ assets + breadth bonus + depth bonus',
  };
}

export async function getTutCollectionHoldings(wallet: string, maxPerCollection = 100): Promise<ScoreCollection[]> {
  const normalized = normalizeWallet(wallet);
  const apiKey = process.env.OPENSEA_API_KEY;

  return Promise.all(TUT_COLLECTIONS.map(async (collection) => {
    const artworks: OwnedArtwork[] = [];
    let next: string | null = null;

    if (apiKey) {
      while (artworks.length < maxPerCollection) {
        const url = new URL(`${OPENSEA_API}/chain/${collection.chain}/account/${normalized}/nfts`);
        url.searchParams.set('collection', collection.slug);
        url.searchParams.set('limit', String(Math.min(50, maxPerCollection - artworks.length)));
        if (next) url.searchParams.set('next', next);

        const res = await fetch(url, {
          headers: {
            Accept: 'application/json',
            'X-API-KEY': apiKey,
          },
        });
        if (!res.ok) break;

        const data = await res.json();
        for (const nft of data?.nfts || []) {
          const tokenId = String(nft.identifier || nft.token_id || '');
          artworks.push({
            tokenId,
            title: nft.name || `${collection.name} #${tokenId || '?'}`,
            image: normalizeIpfsUrl(nft.image_url || nft.display_image_url || nft.original_image_url || ''),
            permalink: nft.opensea_url || (tokenId ? `https://opensea.io/assets/${collection.chain}/${nft.contract}/${tokenId}` : ''),
            collection: collection.name,
            collectionSlug: collection.slug,
            weight: collection.weight,
          });
        }

        next = data?.next || null;
        if (!next) break;
      }
    }

    return {
      slug: collection.slug,
      name: collection.name,
      kind: collection.kind,
      chain: collection.chain,
      contract: 'contract' in collection ? collection.contract : undefined,
      weight: collection.weight,
      count: artworks.length,
      score: artworks.length * collection.weight,
      artworks,
    };
  }));
}

export async function getCollectorScoreBreakdown(wallet: string): Promise<ScoreBreakdown> {
  return calculateScoreBreakdown({
    collections: await getTutCollectionHoldings(wallet),
  });
}

export function scoreRank(score: number): string {
  if (score >= 100000) return 'Legend';
  if (score >= 25000) return 'Whale';
  if (score >= 5000) return 'Collector';
  if (score > 0) return 'Holder';
  return 'Unscored';
}
