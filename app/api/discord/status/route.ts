import { NextRequest, NextResponse } from 'next/server';
import { normalizeWallet } from '@/app/lib/collectorScore';
import { getDiscordLink, profileStoreEnabled } from '@/app/lib/db';

// Whether a wallet already has Discord linked — lets the Hub show "connected" across reloads.
export async function GET(request: NextRequest) {
  try {
    const wallet = normalizeWallet(request.nextUrl.searchParams.get('wallet') || '');
    if (!profileStoreEnabled()) return NextResponse.json({ connected: false });
    const link = await getDiscordLink(wallet);
    return NextResponse.json({
      connected: !!link,
      discordUsername: link?.discordUsername || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lookup failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
