import { NextRequest, NextResponse } from 'next/server';
import {
  DEADBIT_COLLECTION_SLUG,
  getCollectorScoreBreakdown,
  normalizeWallet,
} from '@/app/lib/collectorScore';

type OwnedArtwork = {
  tokenId: string;
  title: string;
  image: string;
  permalink: string;
};

type CachedHoldings = { ts: number; body: unknown };

const CACHE_TTL_MS = 2 * 60 * 1000;
const OPENSEA_API = 'https://api.opensea.io/api/v2';

declare global {
  var __collectorHoldingsCache: Map<string, CachedHoldings> | undefined;
}

const cache: Map<string, CachedHoldings> =
  globalThis.__collectorHoldingsCache ?? (globalThis.__collectorHoldingsCache = new Map());

function normalizeIpfsUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('ipfs://')) {
    const path = url.replace('ipfs://', '').replace(/^ipfs\//, '');
    return `https://ipfs.io/ipfs/${path}`;
  }
  return url;
}

async function fetchOwnedDeadbits(wallet: string, max = 100): Promise<OwnedArtwork[]> {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) return [];

  const nfts: OwnedArtwork[] = [];
  let next: string | null = null;

  while (nfts.length < max) {
    const url = new URL(`${OPENSEA_API}/chain/megaeth/account/${wallet}/nfts`);
    url.searchParams.set('collection', DEADBIT_COLLECTION_SLUG);
    url.searchParams.set('limit', String(Math.min(50, max - nfts.length)));
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
      nfts.push({
        tokenId,
        title: nft.name || `Deadbit #${tokenId || '?'}`,
        image: normalizeIpfsUrl(nft.image_url || nft.display_image_url || nft.original_image_url || ''),
        permalink: nft.opensea_url || (tokenId ? `https://opensea.io/assets/megaeth/${nft.contract}/${tokenId}` : ''),
      });
    }

    next = data?.next || null;
    if (!next) break;
  }

  return nfts;
}

export async function GET(request: NextRequest) {
  try {
    const wallet = normalizeWallet(request.nextUrl.searchParams.get('wallet') || '');
    const cacheKey = wallet;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.body, {
        headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
      });
    }

    const [breakdown, artworks] = await Promise.all([
      getCollectorScoreBreakdown(wallet),
      fetchOwnedDeadbits(wallet),
    ]);

    const body = {
      wallet,
      score: Math.max(breakdown.onChainScore, breakdown.calculatedScore),
      rank: breakdown.rank,
      breakdown,
      holdings: {
        deadbits: {
          count: breakdown.deadbitCount,
          shown: artworks.length,
          artworks,
        },
        partners: breakdown.partners,
      },
      updatedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, { ts: Date.now(), body });
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Collector holdings lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
