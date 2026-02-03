import { NextRequest, NextResponse } from 'next/server';

type CachedPrefetch = { ts: number; body: unknown };

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

declare global {
  var __openseaPrefetchCache: CachedPrefetch | undefined;
}

const PREFETCH_ENTRIES: { slug: string; limit?: number }[] = [
  { slug: 'obsessive-cycles-of-fiber' },
  { slug: 'tut-1-1' },
  { slug: 'kingtut-genesis' },
  { slug: 'abstractions', limit: 20 },
  { slug: 'tut-editions', limit: 2 },
  { slug: 'tut-loudio', limit: 20 },
];

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    const cached = globalThis.__openseaPrefetchCache;
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.body, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
        },
      });
    }

    const origin = request.nextUrl.origin;
    const results = await Promise.all(
      PREFETCH_ENTRIES.map(async ({ slug, limit }) => {
        const url = `${origin}/api/opensea/collection?slug=${encodeURIComponent(slug)}${limit != null ? `&limit=${limit}` : ''}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) return { slug, artworks: [], collectionName: null as string | null };
        const data = (await res.json()) as { artworks?: unknown[]; collectionName?: string | null };
        return {
          slug,
          artworks: data?.artworks ?? [],
          collectionName: data?.collectionName ?? null,
        };
      })
    );

    const collections: Record<string, { artworks: unknown[]; collectionName: string | null }> = {};
    for (const { slug, artworks, collectionName } of results) {
      collections[slug] = { artworks, collectionName };
    }

    const body = { collections };
    globalThis.__openseaPrefetchCache = { ts: now, body };

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Prefetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
