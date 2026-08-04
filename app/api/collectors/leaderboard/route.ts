import { NextRequest, NextResponse } from 'next/server';
import { getCollectorLeaderboard } from '@/app/lib/collectorScore';

export async function GET(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get('limit') || 50);
    const leaderboard = await getCollectorLeaderboard(limit);
    return NextResponse.json({
      leaderboard,
      total: leaderboard.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Leaderboard lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
