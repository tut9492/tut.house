import { NextRequest, NextResponse } from 'next/server';
import { getCollectorScoreBreakdownForWallets, scoreRank, verifyDiscordWalletProof } from '@/app/lib/collectorScore';
import { assignCollectionRoles, assignDiscordRoles, fetchDiscordUser, takeDiscordToken } from '@/app/lib/discordVerify';
import { getLinkedWallets, profileStoreEnabled, upsertDiscordLink } from '@/app/lib/db';

type Body = {
  wallet?: string;
  signature?: `0x${string}`;
  discord_code?: string;
  timestamp?: number;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    if (!body.wallet || !body.signature || !body.discord_code || !body.timestamp) {
      return NextResponse.json({ error: 'Missing verification payload' }, { status: 400 });
    }

    const tokenData = takeDiscordToken(body.discord_code);
    if (!tokenData) {
      return NextResponse.json({ error: 'Discord session expired. Please connect Discord again.' }, { status: 400 });
    }

    const discordUser = await fetchDiscordUser(tokenData.access_token);
    if (discordUser.id !== tokenData.discord_user_id) {
      return NextResponse.json({ error: 'Discord identity mismatch' }, { status: 403 });
    }

    const wallet = await verifyDiscordWalletProof({
      wallet: body.wallet,
      discordUserId: discordUser.id,
      timestamp: body.timestamp,
      signature: body.signature,
    });

    // Score + role eligibility across the wallet's linked wallets too (e.g. AGW-held collections).
    const linked = profileStoreEnabled() ? await getLinkedWallets(wallet) : [];
    const breakdown = await getCollectorScoreBreakdownForWallets([wallet, ...linked]);
    const score = breakdown.calculatedScore;
    if (score <= 0) {
      return NextResponse.json({
        ok: false,
        wallet,
        discordUserId: discordUser.id,
        discordUsername: discordUser.global_name || discordUser.username,
        score,
        rank: scoreRank(score),
        roles: [],
        error: 'No collector score found for this wallet.',
      });
    }

    // Grant BOTH the score-tier role (the base "Verified Collector" via DISCORD_ROLE_ID) AND any
    // per-collection roles the wallet qualifies for. Without the score-tier grant, a holder whose
    // collection isn't mapped in DISCORD_COLLECTION_ROLES links successfully but gets no role.
    const ownedSlugs = breakdown.collections.filter((c) => c.count > 0).map((c) => c.slug);
    const [scoreRoles, collectionRoles] = await Promise.all([
      assignDiscordRoles(discordUser.id, score),
      assignCollectionRoles(discordUser.id, ownedSlugs),
    ]);
    const seen = new Set<string>();
    const roles = [...scoreRoles, ...collectionRoles].filter((r) => (seen.has(r.roleId) ? false : (seen.add(r.roleId), true)));
    // A 403 / code 50013 means the target role sits above the bot in the server's role hierarchy —
    // a server-config problem, not something the user can fix. It must NOT make an otherwise-successful
    // verification (they got their qualifying collection role) report as failed. Only treat a role that
    // failed for some OTHER reason as blocking.
    const isPermissionError = (r: { status?: number; error?: string }) =>
      r.status === 403 || /50013|missing permissions/i.test(r.error || '');
    const blockingFailures = roles.filter((role) => !role.ok && !isPermissionError(role));
    const gotAnyRole = roles.some((role) => role.ok);

    // Persist the linkage so the Hub shows "connected" on later loads (best-effort).
    if (profileStoreEnabled()) {
      try {
        await upsertDiscordLink(wallet, discordUser.id, discordUser.global_name || discordUser.username, roles);
      } catch { /* persistence is best-effort — don't fail the verification response */ }
    }

    return NextResponse.json({
      ok: gotAnyRole && blockingFailures.length === 0,
      wallet,
      discordUserId: discordUser.id,
      discordUsername: discordUser.global_name || discordUser.username,
      score,
      rank: scoreRank(score),
      roles,
      error: blockingFailures.length > 0 ? 'Discord linked, but at least one role could not be assigned.' : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Discord verification failed';
    const status = /expired|invalid|missing|mismatch/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
