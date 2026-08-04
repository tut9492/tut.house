import { NextRequest, NextResponse } from 'next/server';
import { getCollectorScore, normalizeWallet, scoreRank } from '@/app/lib/collectorScore';

export async function GET(request: NextRequest) {
  try {
    const wallet = normalizeWallet(request.nextUrl.searchParams.get('wallet') || '');
    const score = await getCollectorScore(wallet);
    return NextResponse.json({ wallet, score, rank: scoreRank(score) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Score lookup failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
