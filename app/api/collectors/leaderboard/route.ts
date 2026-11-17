import { NextRequest, NextResponse } from 'next/server';
import { collectionBadges, getCollectorScoreBreakdownForWallets, scoreRank } from '@/app/lib/collectorScore';
import {
  getAllProfiles, getLinkedWallets, getStaleProfileWallets, getStoredLeaderboard, profileStoreEnabled, updateProfileScore,
} from '@/app/lib/db';

// The board reads straight from stored scores (fast, no Alchemy). Scores are kept fresh three ways:
// the holdings route (when a collector loads their Hub), a nightly cron rebuild, and — so the board
// never goes stale even if the cron doesn't fire — a small self-heal on each uncached board read.
const CACHE_TTL_MS = 60 * 1000;

type CachedBoard = { ts: number; body: unknown };
declare global {
  var __collectorLeaderboardCache: CachedBoard | undefined;
}

// Self-heal tuning: on each (uncached, ~once/min) board read, rescore up to this many profiles whose
// stored score is older than the staleness window. Small enough to stay well under the function
// timeout; over a few minutes it rotates through every stale wallet.
const SELF_HEAL_BATCH = 8;
// 6 hours, was 15 minutes. At 15 minutes every profile was rescored up to 96 times a day for as long
// as the board was being opened, and one rescore is an Alchemy NFT lookup per collection per wallet
// (six lookups, more with linked wallets). Alchemy usage for Nov 9-16 2026 put those lookups at about
// a tenth of the whole account's bill. A collector's own score still refreshes the moment they load
// their Hub, and the nightly cron still rebuilds everyone; this only slows the background catch-up.
const STALE_WINDOW_MS = 6 * 60 * 60 * 1000;

// Rescore + persist one wallet's score (union of primary + any linked wallets). Isolated so a single
// failure can't abort a batch.
async function rescoreWallet(wallet: string): Promise<void> {
  const linked = await getLinkedWallets(wallet);
  const bd = await getCollectorScoreBreakdownForWallets([wallet, ...linked]);
  await updateProfileScore(wallet, bd.calculatedScore, scoreRank(bd.calculatedScore), collectionBadges(bd));
}

// Refresh the stalest handful of profiles. Cheap, bounded, and safe to run on a normal board read.
async function selfHealStale(): Promise<void> {
  const wallets = await getStaleProfileWallets(SELF_HEAL_BATCH, STALE_WINDOW_MS);
  await Promise.all(wallets.map((w) => rescoreWallet(w).catch(() => { /* skip a failed wallet */ })));
}

// Recompute + persist every profile's score. Expensive (Alchemy per profile) — cron/seed only.
// Chunked so we don't fire hundreds of concurrent Alchemy calls (rate limits / function timeout).
async function rebuildAll(): Promise<void> {
  const profiles = await getAllProfiles();
  const CHUNK = 8;
  for (let i = 0; i < profiles.length; i += CHUNK) {
    await Promise.all(profiles.slice(i, i + CHUNK).map((p) =>
      rescoreWallet(p.wallet).catch(() => { /* skip a failed wallet, keep the rest */ }),
    ));
  }
}

// The board shows EVERY scored collector, not a top-N. The ceiling is just a safety valve so a
// runaway store can never blow the payload/render; bump it if the collector base ever approaches it.
const MAX_BOARD = 1000;

async function buildBody() {
  const rows = await getStoredLeaderboard(MAX_BOARD);
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

  // Cron rebuild. Vercel attaches `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set;
  // if it isn't set, fall back to Vercel's `vercel-cron` user-agent so the nightly rebuild still
  // runs. (Worst case of a spoofed UA is an extra rescoring pass — no data is destroyed.)
  const secret = process.env.CRON_SECRET;
  const ua = request.headers.get('user-agent') || '';
  const isCron = secret
    ? request.headers.get('authorization') === `Bearer ${secret}`
    : /vercel-cron/i.test(ua);

  try {
    if (isCron) {
      await rebuildAll();
      globalThis.__collectorLeaderboardCache = undefined;
      const body = await buildBody();
      return NextResponse.json(body);
    }

    // Edge-cache the board so repeat opens are instant (served from the CDN, not recomputed).
    const cacheHeaders = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' };

    const cached = globalThis.__collectorLeaderboardCache;
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.body, { headers: cacheHeaders });
    }

    // Self-heal: refresh the stalest few profiles before reading the board so scores stay current
    // even when the nightly cron doesn't run. Guarded — a healing failure must not break the board.
    try { await selfHealStale(); } catch { /* best-effort */ }

    let body = await buildBody();
    // Nothing stored yet but profiles exist → self-seed once so the board is never empty.
    if (body.total === 0) {
      const profiles = await getAllProfiles();
      if (profiles.length > 0) {
        await rebuildAll();
        body = await buildBody();
      }
    }

    globalThis.__collectorLeaderboardCache = { ts: Date.now(), body };
    return NextResponse.json(body, { headers: cacheHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Leaderboard lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
