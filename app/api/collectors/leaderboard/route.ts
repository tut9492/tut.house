import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    leaderboard: [],
    total: 0,
    status: 'needs_tut_asset_indexer',
    message: 'The public leaderboard is paused until tut™ asset scores are indexed across all collectors.',
    updatedAt: new Date().toISOString(),
  });
}
