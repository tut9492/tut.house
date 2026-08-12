import { NextRequest, NextResponse } from 'next/server';
import {
  collectionBadges,
  getCollectorScoreBreakdownForWallets,
  normalizeWallet,
  scoreRank,
  verifyCollectorProof,
  verifyLinkProof,
} from '@/app/lib/collectorScore';
import {
  addLinkedWallet, getLinkedWallets, isWalletClaimed, profileStoreEnabled, removeLinkedWallet, updateProfileScore,
} from '@/app/lib/db';

type LinkBody = { primary?: string; linked?: string; message?: string; signature?: `0x${string}`; chain?: string };

// Recompute the primary's combined score across its wallets and persist it (no-ops without a profile).
async function rescoreAndRespond(primary: string, linked: string[]) {
  const breakdown = await getCollectorScoreBreakdownForWallets([primary, ...linked]);
  try {
    await updateProfileScore(primary, breakdown.calculatedScore, scoreRank(breakdown.calculatedScore), collectionBadges(breakdown));
  } catch { /* score persistence is best-effort */ }
  return NextResponse.json({
    primary,
    linkedWallets: linked,
    score: breakdown.calculatedScore,
    rank: breakdown.rank,
  });
}

// POST — link an additional wallet (e.g. an AGW) to a signed-in collector. The LINKED wallet signs a
// message binding primary+linked, so its ERC-1271/EOA signature proves control + declares the owner.
export async function POST(request: NextRequest) {
  try {
    if (!profileStoreEnabled()) {
      return NextResponse.json({ error: 'Wallet linking is temporarily unavailable.' }, { status: 503 });
    }
    const body = (await request.json()) as LinkBody;
    if (!body.primary || !body.linked || !body.message || !body.signature) {
      return NextResponse.json({ error: 'Missing link proof' }, { status: 400 });
    }

    const { primary, linked } = await verifyLinkProof({
      primary: body.primary,
      linked: body.linked,
      message: body.message,
      signature: body.signature,
    });

    if (await isWalletClaimed(linked, primary)) {
      return NextResponse.json({ error: 'That wallet is already linked to another collector.' }, { status: 409 });
    }

    const linkedWallets = await addLinkedWallet(primary, linked, body.chain);
    return await rescoreAndRespond(primary, linkedWallets);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not link wallet.';
    const status = /expired|invalid|mismatch|itself/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE — unlink a wallet. The PRIMARY wallet signs a standard collector message to prove ownership.
export async function DELETE(request: NextRequest) {
  try {
    if (!profileStoreEnabled()) {
      return NextResponse.json({ error: 'Wallet linking is temporarily unavailable.' }, { status: 503 });
    }
    const body = (await request.json()) as LinkBody;
    if (!body.primary || !body.linked || !body.message || !body.signature) {
      return NextResponse.json({ error: 'Missing proof' }, { status: 400 });
    }
    // Proof that the caller controls the primary account (message is signed by the primary wallet).
    const primary = await verifyCollectorProof({ wallet: body.primary, message: body.message, signature: body.signature });
    const linked = await removeLinkedWallet(primary, normalizeWallet(body.linked));
    return await rescoreAndRespond(primary, linked);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not unlink wallet.';
    const status = /expired|invalid|mismatch/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// GET — list a primary's linked wallets (public; addresses only).
export async function GET(request: NextRequest) {
  try {
    const primary = normalizeWallet(request.nextUrl.searchParams.get('wallet') || '');
    const linkedWallets = profileStoreEnabled() ? await getLinkedWallets(primary) : [];
    return NextResponse.json({ primary, linkedWallets });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lookup failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
