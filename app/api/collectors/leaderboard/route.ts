import { NextRequest, NextResponse } from 'next/server';
import { collectionBadges, getCollectorScoreBreakdown, scoreRank } from '@/app/lib/collectorScore';
import { getAllProfiles, getStoredLeaderboard, profileStoreEnabled, updateProfileScore } from '@/app/lib/db';

// The board reads straight from stored scores (fast, no Alchemy). Scores are kept fresh by the
// holdings route (every time a collector loads their Hub) and by a periodic cron rebuild.
const CACHE_TTL_MS = 60 * 1000;

type CachedBoard = { ts: number; body: unknown };
declare global {
  var __collectorLeaderboardCache: CachedBoard | undefined;
}

// Recompute + persist every profile's score. Expensive (Alchemy per profile) — cron/seed only.
async function rebuildAll(): Promise<void> {
  const profiles = await getAllProfiles();
  await Promise.all(profiles.map(async (p) => {
    try {
      const bd = await getCollectorScoreBreakdown(p.wallet);
      await updateProfileScore(p.wallet, bd.calculatedScore, scoreRank(bd.calculatedScore), collectionBadges(bd));
    } catch { /* skip a failed wallet, keep the rest */ }
  }));
}

async function buildBody(limit: number) {
  const rows = await getStoredLeaderboard(limit);
  const leaderboard = rows.map((r, i) => ({
    rank: i + 1,
    username: r.username,
    wallet: r.wallet,
    avatar: r.avatar?.image || null,
    score: r.score,
    tier: r.tier || scoreRank(r.score),
    badges: r.badges,
  }));
  return { leaderboard, total: leaderboard.length, storeEnabled: true, updatedAt: new Date().toISOString() };
}

export async function GET(request: NextRequest) {
  if (!profileStoreEnabled()) {
    return NextResponse.json({ leaderboard: [], total: 0, storeEnabled: false });
  }

  // Cron rebuild: Vercel attaches `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
  const secret = process.env.CRON_SECRET;
  const isCron = !!secret && request.headers.get('authorization') === `Bearer ${secret}`;

  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 50, 100);

  try {
    if (isCron) {
      await rebuildAll();
      globalThis.__collectorLeaderboardCache = undefined;
      const body = await buildBody(limit);
      return NextResponse.json(body);
    }

    const cached = globalThis.__collectorLeaderboardCache;
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.body);
    }

    let body = await buildBody(limit);
    // Nothing stored yet but profiles exist → self-seed once so the board is never empty.
    if (body.total === 0) {
      const profiles = await getAllProfiles();
      if (profiles.length > 0) {
        await rebuildAll();
        body = await buildBody(limit);
      }
    }

    globalThis.__collectorLeaderboardCache = { ts: Date.now(), body };
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Leaderboard lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
