import { NextRequest, NextResponse } from 'next/server';
import { getTutCollectionHoldings, normalizeWallet, verifyCollectorProof } from '@/app/lib/collectorScore';
import {
  artTokenKey,
  isValidSocialUrl,
  isValidUsername,
  MAX_GALLERY,
  normalizeUsername,
  type ArtRef,
  type CollectorProfile,
  type ProfileInput,
} from '@/app/lib/collectorProfile';
import {
  getProfileByUsername,
  getProfileByWallet,
  isUsernameTaken,
  profileStoreEnabled,
  UsernameTakenError,
  upsertProfile,
} from '@/app/lib/db';

type PutBody = {
  wallet?: string;
  message?: string;
  signature?: `0x${string}`;
  profile?: ProfileInput;
};

// Resolve the wallet's owned pieces into a tokenKey -> ArtRef map. This is the source of
// truth for a profile: the client only sends tokenKeys, never image URLs, so a collector
// can never pin art they don't own or inject an arbitrary image.
async function ownedArtByKey(wallet: string): Promise<Map<string, ArtRef>> {
  const collections = await getTutCollectionHoldings(wallet);
  const map = new Map<string, ArtRef>();
  for (const c of collections) {
    for (const a of c.artworks) {
      const key = artTokenKey(a.collectionSlug, a.tokenId);
      map.set(key, {
        tokenKey: key,
        image: a.image,
        title: a.title,
        collection: a.collection,
        collectionSlug: a.collectionSlug,
        permalink: a.permalink,
        weight: a.weight,
      });
    }
  }
  return map;
}

export async function GET(request: NextRequest) {
  if (!profileStoreEnabled()) {
    return NextResponse.json({ profile: null, storeEnabled: false });
  }
  try {
    const walletParam = request.nextUrl.searchParams.get('wallet');
    const usernameParam = request.nextUrl.searchParams.get('username');

    let profile: CollectorProfile | null = null;
    if (walletParam) {
      profile = await getProfileByWallet(normalizeWallet(walletParam));
    } else if (usernameParam) {
      profile = await getProfileByUsername(usernameParam);
    } else {
      return NextResponse.json({ error: 'Provide a wallet or username.' }, { status: 400 });
    }

    return NextResponse.json({ profile, storeEnabled: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Profile lookup failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  if (!profileStoreEnabled()) {
    return NextResponse.json(
      { error: 'Collector pages are not enabled yet.' },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as PutBody;
    if (!body.wallet || !body.message || !body.signature || !body.profile) {
      return NextResponse.json({ error: 'Missing profile payload.' }, { status: 400 });
    }

    // Auth: only the wallet owner can write their own page.
    const wallet = await verifyCollectorProof({
      wallet: body.wallet,
      message: body.message,
      signature: body.signature,
    });

    const input = body.profile;
    const username = normalizeUsername(input.username);
    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: 'Username must be 3–20 characters: letters, numbers, or underscores.' },
        { status: 400 },
      );
    }
    const socialUrl = input.socialUrl ? String(input.socialUrl).trim() : null;
    if (!isValidSocialUrl(socialUrl)) {
      return NextResponse.json({ error: 'Social link must be a valid https URL.' }, { status: 400 });
    }

    if (await isUsernameTaken(username, wallet)) {
      return NextResponse.json({ error: 'That username is taken.' }, { status: 409 });
    }

    const owned = await ownedArtByKey(wallet);

    const avatarRef = input.avatarTokenKey ? owned.get(input.avatarTokenKey) : undefined;
    const avatar = avatarRef ? { tokenKey: avatarRef.tokenKey, image: avatarRef.image } : null;

    const frame = input.frameTokenKey ? owned.get(input.frameTokenKey) ?? null : null;

    const gallery: ArtRef[] = [];
    const seen = new Set<string>();
    for (const key of input.galleryTokenKeys || []) {
      if (gallery.length >= MAX_GALLERY) break;
      if (seen.has(key)) continue;
      const ref = owned.get(key);
      if (ref) {
        gallery.push(ref);
        seen.add(key);
      }
    }

    const saved = await upsertProfile({
      wallet,
      username,
      socialUrl,
      avatar,
      frame,
      gallery,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ profile: saved, storeEnabled: true });
  } catch (error) {
    if (error instanceof UsernameTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'Could not save your page.';
    const status = /expired|invalid|mismatch/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
