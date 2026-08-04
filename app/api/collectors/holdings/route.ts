import { NextRequest, NextResponse } from 'next/server';
import { getCollectorScoreBreakdown, normalizeWallet } from '@/app/lib/collectorScore';

type CachedHoldings = { ts: number; body: unknown };

const CACHE_TTL_MS = 2 * 60 * 1000;

declare global {
  var __collectorHoldingsCache: Map<string, CachedHoldings> | undefined;
}

const cache: Map<string, CachedHoldings> =
  globalThis.__collectorHoldingsCache ?? (globalThis.__collectorHoldingsCache = new Map());

export async function GET(request: NextRequest) {
  try {
    const wallet = normalizeWallet(request.nextUrl.searchParams.get('wallet') || '');
    const cached = cache.get(wallet);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.body, {
        headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
      });
    }

    const breakdown = await getCollectorScoreBreakdown(wallet);
    const artworks = breakdown.collections.flatMap((collection) => collection.artworks);
    const body = {
      wallet,
      score: breakdown.calculatedScore,
      rank: breakdown.rank,
      breakdown,
      holdings: {
        assets: {
          count: breakdown.assetCount,
          shown: artworks.length,
          artworks,
        },
        collections: breakdown.collections,
      },
      updatedAt: new Date().toISOString(),
    };

    cache.set(wallet, { ts: Date.now(), body });
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Collector holdings lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
