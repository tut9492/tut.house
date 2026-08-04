import { verifyMessage } from 'viem';

// Holdings are read from Alchemy. Each collection's `chain` maps to an Alchemy subdomain.
// Ethereum + Abstract expose the NFT API (metadata + images). MegaETH has RPC only, so
// Breadio is counted via an on-chain balanceOf and carries no artwork thumbnails.
const ALCHEMY_SUBDOMAIN: Record<string, string> = {
  ethereum: 'eth-mainnet',
  abstract: 'abstract-mainnet',
  megaeth: 'megaeth-mainnet',
};
const ALCHEMY_NFT_API_CHAINS = new Set(['ethereum', 'abstract']);
// Chains OpenSea can build a marketplace permalink for (MegaETH has no OpenSea presence).
const OPENSEA_PERMALINK_CHAINS = new Set(['ethereum', 'abstract']);

export const SCORE_MESSAGE_PREFIX = 'Verify tut.house collector access';
export const DISCORD_VERIFY_MESSAGE_PREFIX = 'Verify tut.house Discord collector role';
const MESSAGE_TTL_MS = 5 * 60 * 1000;

export type CollectorProof = {
  wallet: string;
  message: string;
  signature: `0x${string}`;
};

export const TUT_COLLECTIONS = [
  {
    slug: 'kingtut-genesis',
    name: 'Tut Genesis',
    weight: 25000,
    kind: 'Genesis',
    chain: 'ethereum',
    contract: '0x208e95f17312b7b348b44aad217387c5999edc04',
  },
  {
    slug: 'abstractions',
    name: 'Abstractions',
    weight: 5000,
    kind: 'Series',
    chain: 'abstract',
    contract: '0xc469c6dbfd7a48d0bfe1556935074fe3a4f3c96c',
  },
  {
    slug: 'obsessive-cycles-of-fiber',
    name: 'OCF',
    weight: 1000,
    kind: '1/1',
    chain: 'ethereum',
    contract: '0x65b40270ae0ace41221b30d92f449822ac066a7f',
  },
  {
    slug: 'breadio',
    name: 'Breadio',
    weight: 500,
    kind: 'MegaETH',
    chain: 'megaeth',
    contract: '0x015061aa806b5abab9ee453e366e18a713e8ea80',
  },
  {
    slug: 'tut-loudio',
    name: 'Tut Loudio',
    weight: 100,
    kind: 'Edition',
    chain: 'ethereum',
    contract: '0x3bea26866fce3596e7e994e45a0a65b74e16947e',
  },
  {
    slug: 'tut-editions',
    name: 'tut™ Editions',
    weight: 50,
    kind: 'Edition',
    chain: 'ethereum',
    contract: '0x6d4ecf5c26b2a6537cb9b290fc46a3f6439e4dfc',
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

type CollectionConfig = (typeof TUT_COLLECTIONS)[number];

// Alchemy NFT API (Ethereum + Abstract): returns owned NFTs with metadata + resolved images.
async function fetchHoldingsViaNftApi(
  subdomain: string,
  apiKey: string,
  wallet: `0x${string}`,
  collection: CollectionConfig,
  maxPerCollection: number,
): Promise<{ count: number; artworks: OwnedArtwork[] }> {
  const artworks: OwnedArtwork[] = [];
  let count = 0;
  let pageKey: string | null = null;

  do {
    const url = new URL(`https://${subdomain}.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner`);
    url.searchParams.set('owner', wallet);
    url.searchParams.append('contractAddresses[]', collection.contract);
    url.searchParams.set('withMetadata', 'true');
    url.searchParams.set('pageSize', '100');
    if (pageKey) url.searchParams.set('pageKey', pageKey);

    const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) break;

    const data = await res.json();
    // totalCount reflects the full filtered set; trust it over paginated artwork length.
    if (typeof data?.totalCount === 'number') count = data.totalCount;

    for (const nft of data?.ownedNfts || []) {
      if (artworks.length >= maxPerCollection) break;
      const tokenId = String(nft?.tokenId ?? '');
      const image = normalizeIpfsUrl(
        nft?.image?.cachedUrl || nft?.image?.originalUrl || nft?.image?.pngUrl || nft?.raw?.metadata?.image || '',
      );
      artworks.push({
        tokenId,
        title: nft?.name || `${collection.name} #${tokenId || '?'}`,
        image,
        permalink: OPENSEA_PERMALINK_CHAINS.has(collection.chain) && tokenId
          ? `https://opensea.io/assets/${collection.chain}/${collection.contract}/${tokenId}`
          : '',
        collection: collection.name,
        collectionSlug: collection.slug,
        weight: collection.weight,
      });
    }

    pageKey = data?.pageKey || null;
  } while (pageKey && artworks.length < maxPerCollection);

  if (count === 0 && artworks.length > 0) count = artworks.length;
  return { count, artworks };
}

// MegaETH has no Alchemy NFT API — count Breadio via on-chain ERC721 balanceOf(owner).
async function fetchCountViaRpc(
  subdomain: string,
  apiKey: string,
  wallet: `0x${string}`,
  collection: CollectionConfig,
): Promise<number> {
  const data = `0x70a08231${wallet.slice(2).toLowerCase().padStart(64, '0')}`;
  const res = await fetch(`https://${subdomain}.g.alchemy.com/v2/${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: collection.contract, data }, 'latest'],
    }),
  });
  if (!res.ok) return 0;
  const json = await res.json();
  if (json?.error || !json?.result || json.result === '0x') return 0;
  try {
    return Number(BigInt(json.result));
  } catch {
    return 0;
  }
}

export async function getTutCollectionHoldings(wallet: string, maxPerCollection = 100): Promise<ScoreCollection[]> {
  const normalized = normalizeWallet(wallet);
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    // Without a key every collection would silently return count 0, which reads as a
    // legitimate score of 0. Fail loudly instead so the UI shows a config error, not a wrong score.
    throw new Error('Collector scoring is temporarily unavailable (ALCHEMY_API_KEY not configured).');
  }

  return Promise.all(TUT_COLLECTIONS.map(async (collection) => {
    const subdomain = ALCHEMY_SUBDOMAIN[collection.chain];
    let count = 0;
    let artworks: OwnedArtwork[] = [];

    if (subdomain) {
      try {
        if (ALCHEMY_NFT_API_CHAINS.has(collection.chain)) {
          ({ count, artworks } = await fetchHoldingsViaNftApi(subdomain, apiKey, normalized, collection, maxPerCollection));
        } else {
          count = await fetchCountViaRpc(subdomain, apiKey, normalized, collection);
        }
      } catch {
        // A single collection's read failing (e.g. a chain not enabled on the Alchemy app)
        // must not zero out the whole score — leave this collection at 0 and continue.
        count = 0;
        artworks = [];
      }
    }

    return {
      slug: collection.slug,
      name: collection.name,
      kind: collection.kind,
      chain: collection.chain,
      contract: 'contract' in collection ? collection.contract : undefined,
      weight: collection.weight,
      count,
      score: count * collection.weight,
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
