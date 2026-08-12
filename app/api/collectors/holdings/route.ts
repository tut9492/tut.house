import { NextRequest, NextResponse } from 'next/server';
import { collectionBadges, getCollectorScoreBreakdownForWallets, normalizeWallet, scoreRank } from '@/app/lib/collectorScore';
import { getLinkedWallets, profileStoreEnabled, updateProfileScore } from '@/app/lib/db';

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

    // Score the collector's primary wallet unioned with any linked wallets (e.g. an added AGW),
    // so combined EVM + Abstract holdings all count.
    const linked = profileStoreEnabled() ? await getLinkedWallets(wallet) : [];
    const breakdown = await getCollectorScoreBreakdownForWallets([wallet, ...linked]);

    // Keep the stored leaderboard score fresh: no-ops unless this wallet has a collector page.
    if (profileStoreEnabled()) {
      try {
        await updateProfileScore(wallet, breakdown.calculatedScore, scoreRank(breakdown.calculatedScore), collectionBadges(breakdown));
      } catch { /* score persistence is best-effort */ }
    }

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
