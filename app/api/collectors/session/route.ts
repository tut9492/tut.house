import { NextRequest, NextResponse } from 'next/server';
import { getCollectorScore, scoreRank, verifyCollectorProof } from '@/app/lib/collectorScore';

type Body = {
  wallet?: string;
  message?: string;
  signature?: `0x${string}`;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    if (!body.wallet || !body.message || !body.signature) {
      return NextResponse.json({ error: 'Missing wallet proof' }, { status: 400 });
    }

    const wallet = await verifyCollectorProof({
      wallet: body.wallet,
      message: body.message,
      signature: body.signature,
    });
    const score = await getCollectorScore(wallet);

    return NextResponse.json({
      wallet,
      score,
      rank: scoreRank(score),
      discordLink: '/api/discord/link',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    const status = /expired|invalid|mismatch/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
