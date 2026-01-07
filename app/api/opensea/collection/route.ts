import { NextRequest, NextResponse } from 'next/server';

type CachedCollection = { ts: number; body: unknown };

const CACHE_TTL_MS = 5 * 60 * 1000;

declare global {
  var __openseaCollectionCache: Map<string, CachedCollection> | undefined;
}

const cache: Map<string, CachedCollection> =
  globalThis.__openseaCollectionCache ?? (globalThis.__openseaCollectionCache = new Map());

function normalizeIpfsUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('ipfs://')) {
    const path = url.replace('ipfs://', '').replace(/^ipfs\//, '');
    return `https://ipfs.io/ipfs/${path}`;
  }
  return url;
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 8000): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const collectionSlug = searchParams.get('slug');

    if (!collectionSlug) {
      return NextResponse.json(
        { error: 'Collection slug is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENSEA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenSea API key is not configured' },
        { status: 500 }
      );
    }

    const cached = cache.get(collectionSlug);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.body, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
        },
      });
    }

    console.log('Fetching collection:', collectionSlug);

    const collectionUrl = `https://api.opensea.io/api/v2/collections/${collectionSlug}`;
    const collectionRes = await fetch(collectionUrl, {
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': apiKey,
      },
    });

    if (!collectionRes.ok) {
      const errorText = await collectionRes.text();
      console.error('Collection fetch error:', collectionRes.status, errorText);
      return NextResponse.json(
        { error: `Failed to fetch collection: ${collectionRes.statusText}` },
        { status: collectionRes.status }
      );
    }

    const collection = await collectionRes.json();
    console.log('Collection fetched:', collection.name);

    const nftsUrl = `https://api.opensea.io/api/v2/collection/${collectionSlug}/nfts?limit=50`;
    const nftsRes = await fetch(nftsUrl, {
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': apiKey,
      },
    });

    if (!nftsRes.ok) {
      const errorText = await nftsRes.text();
      console.error('NFTs fetch error:', nftsRes.status, errorText);
      return NextResponse.json(
        { error: `Failed to fetch NFTs: ${nftsRes.statusText}` },
        { status: nftsRes.status }
      );
    }

    const nftsData = await nftsRes.json();
    console.log('NFTs fetched:', nftsData.nfts?.length || 0);

    const chain = collection.contracts?.[0]?.chain || 'ethereum';

    const artworksPromises = (nftsData.nfts || []).map(async (nft: {
      identifier?: string;
      contract?: string;
      name?: string;
      opensea_url?: string;
    }) => {
      let imageUrl = '';

      if (nft.contract && nft.identifier) {
        try {
          const nftMetadataUrl = `https://api.opensea.io/api/v2/chain/${chain}/contract/${nft.contract}/nfts/${nft.identifier}`;
          const metadataRes = await fetch(nftMetadataUrl, {
            headers: {
              'Accept': 'application/json',
              'X-API-KEY': apiKey,
            },
          });

          if (metadataRes.ok) {
            const metadata = await metadataRes.json();
            imageUrl =
              metadata?.nft?.original_image_url ||
              metadata?.nft?.image_original_url ||
              '';

            if (!imageUrl) {
              const metadataUrlRaw: string | undefined = metadata?.nft?.metadata_url;
              const metadataUrl = metadataUrlRaw ? normalizeIpfsUrl(metadataUrlRaw) : '';
              if (metadataUrl) {
                const tokenMetadata = await fetchJsonWithTimeout(metadataUrl);
                const tokenImageRaw =
                  (tokenMetadata as { image?: string; image_url?: string; imageUrl?: string } | null)?.image ||
                  (tokenMetadata as { image?: string; image_url?: string; imageUrl?: string } | null)?.image_url ||
                  (tokenMetadata as { image?: string; image_url?: string; imageUrl?: string } | null)?.imageUrl ||
                  '';
                if (tokenImageRaw) {
                  imageUrl = normalizeIpfsUrl(tokenImageRaw);
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching metadata for NFT ${nft.identifier}:`, error);
        }
      }

      let openseaUrl = '';
      if (nft.opensea_url) {
        openseaUrl = nft.opensea_url;
      } else if (nft.contract && nft.identifier) {
        openseaUrl = `https://opensea.io/assets/${chain}/${nft.contract}/${nft.identifier}`;
      }

      return {
        id: `${nft.contract || ''}-${nft.identifier || ''}`,
        title: nft.name || `#${nft.identifier || 'unknown'}`,
        src: imageUrl || '/assets/images/placeholderImage.png',
        collection: collection.name || 'Unknown Collection',
        chain: chain === 'ethereum' ? 'Ethereum' : chain,
        technique: 'Digital',
        permalink: openseaUrl,
      };
    });

    const artworks = await Promise.all(artworksPromises);
    console.log('Artworks processed:', artworks.length);

    const body = { artworks };
    cache.set(collectionSlug, { ts: Date.now(), body });

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: err.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
