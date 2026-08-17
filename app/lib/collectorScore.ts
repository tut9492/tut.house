import { createPublicClient, http } from 'viem';
import { abstract } from 'viem/chains';
import { getBreadioTokens } from './db';

// Abstract Global Wallet (AGW) is a smart-contract wallet, so its signatures are ERC-1271
// (`isValidSignature`), not EOA `ecrecover` — and EIP-6492 for wallets not yet deployed on-chain.
// A public client's `verifyMessage` action validates all three (EOA → 1271 → 6492): the ecrecover
// path runs off-chain first, so EOAs never touch this RPC; only smart-wallet proofs do. (The bare
// `verifyMessage` exported from 'viem' is offline/ecrecover-only and would reject every AGW proof.)
// AGW lives on Abstract, so we point the client there.
function createAbstractClient() {
  return createPublicClient({
    chain: abstract,
    transport: http(
      process.env.ALCHEMY_API_KEY
        ? `https://abstract-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : undefined, // falls back to the chain's default public RPC
    ),
  });
}
let abstractClient: ReturnType<typeof createAbstractClient> | undefined;
function getAbstractClient() {
  if (!abstractClient) abstractClient = createAbstractClient();
  return abstractClient;
}

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
export const LINK_MESSAGE_PREFIX = 'Add wallet to tut.house collector';
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
  {
    // The Tut Tee lives inside DYLI's shared ERC-1155 merch contract, so it MUST be scoped by
    // tokenId — otherwise every DYLI item a wallet holds would count. Add future Tut DYLI drops
    // by appending their token IDs here.
    slug: 'tut-tee',
    name: 'Tut Tee',
    weight: 2500,
    kind: 'Merch',
    chain: 'abstract',
    contract: '0x458422e93bf89a109afc4fac00aacf2f18fcf541',
    tokenIds: ['14935'],
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
  // Collection-level image (from on-chain contractURI) — used as the badge thumbnail for
  // chains without an NFT metadata API (MegaETH/Breadio), which have count but no per-token art.
  logo?: string;
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

  // Client action (not the offline helper) so ERC-1271/EIP-6492 smart wallets (AGW) verify too.
  // EOAs verify via ecrecover before this client is ever consulted.
  const valid = await getAbstractClient().verifyMessage({
    address: parsed.wallet,
    message: proof.message,
    signature: proof.signature,
  });
  if (!valid) throw new Error('Invalid signature');

  return parsed.wallet;
}

// ---- Linking an additional wallet (e.g. AGW) to a signed-in collector ----
// The message binds primary+linked so a captured sign-in signature can't be replayed to link a
// wallet, and so the signer is declaring which collector profile to attach to.
export type LinkProof = { primary: string; linked: string; message: string; signature: `0x${string}` };

export function buildLinkMessage(primary: string, linked: string, timestamp: number, nonce: string): string {
  return [
    LINK_MESSAGE_PREFIX,
    `Primary: ${normalizeWallet(primary)}`,
    `Linked: ${normalizeWallet(linked)}`,
    `Timestamp: ${timestamp}`,
    `Nonce: ${nonce}`,
  ].join('\n');
}

export function parseLinkMessage(message: string): { primary: `0x${string}`; linked: `0x${string}` } {
  const lines = String(message || '').split('\n');
  if (lines[0] !== LINK_MESSAGE_PREFIX) throw new Error('Invalid message prefix');
  const primary = normalizeWallet((lines.find((l) => l.startsWith('Primary: ')) || '').replace('Primary: ', ''));
  const linked = normalizeWallet((lines.find((l) => l.startsWith('Linked: ')) || '').replace('Linked: ', ''));
  const timestamp = Number((lines.find((l) => l.startsWith('Timestamp: ')) || '').replace('Timestamp: ', ''));
  const nonce = (lines.find((l) => l.startsWith('Nonce: ')) || '').replace('Nonce: ', '').trim();
  if (!Number.isFinite(timestamp)) throw new Error('Invalid timestamp');
  if (!nonce || nonce.length > 128) throw new Error('Invalid nonce');
  if (Math.abs(Date.now() - timestamp) > MESSAGE_TTL_MS) throw new Error('Signature expired');
  if (primary === linked) throw new Error('Cannot link a wallet to itself');
  return { primary, linked };
}

// Verify the LINKED wallet signed the link message (ERC-1271 aware for AGW). Returns {primary,linked}.
export async function verifyLinkProof(proof: LinkProof): Promise<{ primary: `0x${string}`; linked: `0x${string}` }> {
  const { primary, linked } = parseLinkMessage(proof.message);
  if (normalizeWallet(proof.primary) !== primary) throw new Error('Primary wallet mismatch');
  if (normalizeWallet(proof.linked) !== linked) throw new Error('Linked wallet mismatch');
  const valid = await getAbstractClient().verifyMessage({ address: linked, message: proof.message, signature: proof.signature });
  if (!valid) throw new Error('Invalid signature');
  return { primary, linked };
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
  const valid = await getAbstractClient().verifyMessage({ address: normalized, message, signature });
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

  // Scoped collections (e.g. the Tut Tee inside DYLI's shared ERC-1155 contract) only count the
  // listed token IDs — never the whole contract. `matched` tracks which scoped tokens the wallet
  // actually holds, so count reflects Tut items only and can't be gamed with unrelated DYLI merch.
  const scopeIds = (collection as { tokenIds?: readonly string[] }).tokenIds;
  const scope = scopeIds && scopeIds.length ? new Set(scopeIds.map(String)) : null;
  const matched = new Set<string>();

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
    // Unscoped: totalCount reflects the full filtered set; trust it over paginated artwork length.
    if (!scope && typeof data?.totalCount === 'number') count = data.totalCount;

    for (const nft of data?.ownedNfts || []) {
      const tokenId = String(nft?.tokenId ?? '');
      if (scope) {
        // Only scoped token IDs the wallet actually holds; count each distinct token once (owning
        // qty 3 of a shirt is still one Tut Tee for breadth), so quantity can't inflate the score.
        if (!scope.has(tokenId) || matched.has(tokenId)) continue;
        matched.add(tokenId);
      }
      if (artworks.length >= maxPerCollection) { if (scope) continue; else break; }
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
    // Scoped: keep paging until every listed token is found (or pages run out), so a scoped token on
    // a later page isn't missed. Unscoped: stop once we've filled the artwork cap.
  } while (pageKey && (scope ? matched.size < scope.size : artworks.length < maxPerCollection));

  if (scope) return { count: matched.size, artworks };
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

// Decode a solidity `string` return value (offset + length + data) into UTF-8.
function decodeAbiString(result: string): string {
  const hex = result.startsWith('0x') ? result.slice(2) : result;
  if (hex.length < 128) return '';
  const offset = parseInt(hex.slice(0, 64), 16) * 2;
  const len = parseInt(hex.slice(offset, offset + 64), 16) * 2;
  const strHex = hex.slice(offset + 64, offset + 64 + len);
  return Buffer.from(strHex, 'hex').toString('utf8');
}

// Chains without an NFT metadata API still expose a collection image via ERC-7572
// contractURI() (selector 0xe8a3d485). Read it on-chain and pull the `image` field so the
// badge can show real art instead of a blank swatch.
async function fetchCollectionLogoViaRpc(
  subdomain: string,
  apiKey: string,
  contract: string,
): Promise<string> {
  try {
    const res = await fetch(`https://${subdomain}.g.alchemy.com/v2/${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: contract, data: '0xe8a3d485' }, 'latest'],
      }),
    });
    if (!res.ok) return '';
    const json = await res.json();
    if (json?.error || !json?.result || json.result === '0x') return '';
    const uri = decodeAbiString(json.result);
    if (!uri) return '';
    if (uri.startsWith('data:application/json')) {
      const comma = uri.indexOf(',');
      const payload = uri.slice(comma + 1);
      const jsonStr = uri.slice(0, comma).includes('base64')
        ? Buffer.from(payload, 'base64').toString('utf8')
        : decodeURIComponent(payload);
      const meta = JSON.parse(jsonStr);
      return normalizeIpfsUrl(meta?.image || '');
    }
    return ''; // an http(s) contractURI would need a second fetch — skip for now
  } catch {
    return '';
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
    let logo: string | undefined;

    if (subdomain) {
      try {
        if (ALCHEMY_NFT_API_CHAINS.has(collection.chain)) {
          ({ count, artworks } = await fetchHoldingsViaNftApi(subdomain, apiKey, normalized, collection, maxPerCollection));
        } else {
          // RPC-only chains (MegaETH/Breadio): count via balanceOf (authoritative for score),
          // and surface the collector's ACTUAL owned tokens from the pre-indexed breadio_tokens
          // table (on-chain SVG art) so they can pick their real pieces in the wizard.
          count = await fetchCountViaRpc(subdomain, apiKey, normalized, collection);
          if (count > 0) {
            const tokens = await getBreadioTokens(normalized, maxPerCollection);
            artworks = tokens.map((t) => ({
              tokenId: t.tokenId,
              title: t.name || `${collection.name} #${t.tokenId}`,
              image: t.image,
              permalink: '',
              collection: collection.name,
              collectionSlug: collection.slug,
              weight: collection.weight,
            }));
            // Fallback to the collection logo if the index has no rows for this wallet yet.
            if (artworks.length === 0) {
              logo = (await fetchCollectionLogoViaRpc(subdomain, apiKey, collection.contract)) || undefined;
              if (logo) {
                artworks = [{ tokenId: '0', title: collection.name, image: logo, permalink: '', collection: collection.name, collectionSlug: collection.slug, weight: collection.weight }];
              }
            }
          }
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
      logo,
    };
  }));
}

export async function getCollectorScoreBreakdown(wallet: string): Promise<ScoreBreakdown> {
  return calculateScoreBreakdown({
    collections: await getTutCollectionHoldings(wallet),
  });
}

// Merge per-wallet holdings into one combined set. Each list is in TUT_COLLECTIONS order (getTut…
// maps over it), so we can merge index-by-index: sum counts, concat + cap artworks, keep a logo.
function mergeHoldings(lists: ScoreCollection[][], maxPerCollection: number): ScoreCollection[] {
  return TUT_COLLECTIONS.map((_, i) => {
    const parts = lists.map((l) => l[i]);
    const base = parts[0];
    const count = parts.reduce((sum, c) => sum + c.count, 0);
    const artworks = parts.flatMap((c) => c.artworks).slice(0, maxPerCollection);
    return { ...base, count, score: count * base.weight, artworks, logo: parts.find((c) => c.logo)?.logo };
  });
}

// Combined holdings across a collector's primary wallet + any linked wallets (e.g. an AGW that holds
// their Abstract-chain work), merged per collection. De-dupes addresses; a single wallet is a passthrough.
export async function getTutCollectionHoldingsForWallets(wallets: string[], maxPerCollection = 100): Promise<ScoreCollection[]> {
  const unique = Array.from(new Set(wallets.map((w) => normalizeWallet(w))));
  if (unique.length <= 1) {
    return getTutCollectionHoldings(unique[0] ?? wallets[0], maxPerCollection);
  }
  const lists = await Promise.all(unique.map((w) => getTutCollectionHoldings(w, maxPerCollection)));
  return mergeHoldings(lists, maxPerCollection);
}

// Combined score across primary + linked wallets. Holdings are unioned before breadth/depth so
// bonuses reflect the whole collection, not one wallet.
export async function getCollectorScoreBreakdownForWallets(wallets: string[], maxPerCollection = 100): Promise<ScoreBreakdown> {
  return calculateScoreBreakdown({ collections: await getTutCollectionHoldingsForWallets(wallets, maxPerCollection) });
}

// Owned collections (with an image) → leaderboard/badge shape.
export function collectionBadges(breakdown: ScoreBreakdown): { slug: string; name: string; count: number; image: string | null }[] {
  return breakdown.collections
    .filter((c) => c.count > 0)
    .map((c) => ({ slug: c.slug, name: c.name, count: c.count, image: c.artworks?.[0]?.image || c.logo || null }));
}

export function scoreRank(score: number): string {
  if (score >= 100000) return 'Legend';
  if (score >= 25000) return 'Whale';
  if (score >= 5000) return 'Collector';
  if (score > 0) return 'Holder';
  return 'Unscored';
}
