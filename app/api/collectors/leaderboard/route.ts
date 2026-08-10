import { NextRequest, NextResponse } from 'next/server';
import { getCollectorScoreBreakdown, scoreRank } from '@/app/lib/collectorScore';
import { getAllProfiles, profileStoreEnabled } from '@/app/lib/db';

// Scoring every profile hits Alchemy (6 calls each), so cache the built board briefly.
const CACHE_TTL_MS = 3 * 60 * 1000;

type CachedBoard = { ts: number; body: unknown };
declare global {
  var __collectorLeaderboardCache: CachedBoard | undefined;
}

export async function GET(request: NextRequest) {
  if (!profileStoreEnabled()) {
    return NextResponse.json({ leaderboard: [], total: 0, storeEnabled: false });
  }

  const cached = globalThis.__collectorLeaderboardCache;
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.body);
  }

  try {
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 50, 100);
    const profiles = await getAllProfiles();

    const scored = await Promise.all(
      profiles.map(async (p) => {
        try {
          const bd = await getCollectorScoreBreakdown(p.wallet);
          // Badges = owned collections, with an image (per-token art or collection logo).
          const badges = bd.collections
            .filter((c) => c.count > 0)
            .map((c) => ({
              slug: c.slug,
              name: c.name,
              count: c.count,
              image: c.artworks?.[0]?.image || c.logo || null,
            }));
          return {
            username: p.username,
            wallet: p.wallet,
            avatar: p.avatar?.image || null,
            score: bd.calculatedScore,
            tier: scoreRank(bd.calculatedScore),
            badges,
          };
        } catch {
          return { username: p.username, wallet: p.wallet, avatar: p.avatar?.image || null, score: 0, tier: 'Unscored', badges: [] };
        }
      }),
    );

    scored.sort((a, b) => b.score - a.score);
    const leaderboard = scored.slice(0, limit).map((p, i) => ({ rank: i + 1, ...p }));

    const body = { leaderboard, total: leaderboard.length, storeEnabled: true, updatedAt: new Date().toISOString() };
    globalThis.__collectorLeaderboardCache = { ts: Date.now(), body };
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Leaderboard lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
