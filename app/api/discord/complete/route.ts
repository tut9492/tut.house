import { NextRequest, NextResponse } from 'next/server';
import { getCollectorScoreBreakdown, scoreRank, verifyDiscordWalletProof } from '@/app/lib/collectorScore';
import { assignCollectionRoles, fetchDiscordUser, takeDiscordToken } from '@/app/lib/discordVerify';

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

    const breakdown = await getCollectorScoreBreakdown(wallet);
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

    // Grant the Discord role for each collection this wallet actually holds.
    const ownedSlugs = breakdown.collections.filter((c) => c.count > 0).map((c) => c.slug);
    const roles = await assignCollectionRoles(discordUser.id, ownedSlugs);
    const failedRoles = roles.filter((role) => !role.ok);

    return NextResponse.json({
      ok: failedRoles.length === 0,
      wallet,
      discordUserId: discordUser.id,
      discordUsername: discordUser.global_name || discordUser.username,
      score,
      rank: scoreRank(score),
      roles,
      error: failedRoles.length > 0 ? 'Discord linked, but at least one role could not be assigned.' : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Discord verification failed';
    const status = /expired|invalid|missing|mismatch/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
