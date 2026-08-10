import { NextRequest, NextResponse } from 'next/server';
import { isValidUsername, normalizeUsername } from '@/app/lib/collectorProfile';
import { isUsernameTaken, profileStoreEnabled } from '@/app/lib/db';
import { normalizeWallet } from '@/app/lib/collectorScore';

// Lightweight check for the wizard's live "username available?" hint. Does not leak any
// profile data — only a boolean.
export async function GET(request: NextRequest) {
  if (!profileStoreEnabled()) {
    return NextResponse.json({ available: false, reason: 'unconfigured' });
  }
  const username = normalizeUsername(request.nextUrl.searchParams.get('u') || '');
  if (!isValidUsername(username)) {
    return NextResponse.json({ available: false, reason: 'invalid' });
  }

  // A wallet may keep its own username, so exclude it from the taken check when provided.
  let exceptWallet = '';
  const walletParam = request.nextUrl.searchParams.get('wallet');
  if (walletParam) {
    try {
      exceptWallet = normalizeWallet(walletParam);
    } catch {
      exceptWallet = '';
    }
  }

  try {
    const taken = await isUsernameTaken(username, exceptWallet);
    return NextResponse.json({ available: !taken, reason: taken ? 'taken' : 'ok' });
  } catch {
    return NextResponse.json({ available: false, reason: 'error' });
  }
}
