import { NextRequest, NextResponse } from 'next/server';
import { insertRaiseContribution, profileStoreEnabled } from '@/app/lib/db';

type Body = { x?: string; discord?: string; amount?: string | number; tx?: string; wallet?: string };

const MIN_USD = 250;
const MAX_USD = 10000;

// POST — a contributor who sent USDC to the treasury themselves submits their details for reconciliation.
// No wallet signature: this is a self-attestation, verified off-chain against the tx hash.
export async function POST(request: NextRequest) {
  try {
    if (!profileStoreEnabled()) {
      return NextResponse.json({ error: 'Submissions are temporarily unavailable.' }, { status: 503 });
    }
    const body = (await request.json()) as Body;

    const x = String(body.x ?? '').trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9_]{1,32}$/.test(x)) {
      return NextResponse.json({ error: 'Enter a valid X handle (letters, numbers, underscore).' }, { status: 400 });
    }

    const discordRaw = String(body.discord ?? '').trim();
    if (discordRaw.length > 40 || (discordRaw && !/^[A-Za-z0-9_.#-]{1,40}$/.test(discordRaw))) {
      return NextResponse.json({ error: 'Discord handle looks invalid.' }, { status: 400 });
    }
    const discord = discordRaw || null;

    const tx = String(body.tx ?? '').trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) {
      return NextResponse.json({ error: 'Enter the transaction hash (0x + 64 hex characters).' }, { status: 400 });
    }

    const amountNum = typeof body.amount === 'number' ? body.amount : parseFloat(String(body.amount ?? ''));
    const amountUsd = Number.isFinite(amountNum) ? amountNum : null;
    if (amountUsd === null || amountUsd < MIN_USD || amountUsd > MAX_USD) {
      return NextResponse.json({ error: `Amount must be between $${MIN_USD} and $${MAX_USD.toLocaleString('en-US')}.` }, { status: 400 });
    }

    const walletRaw = String(body.wallet ?? '').trim();
    const wallet = /^0x[0-9a-fA-F]{40}$/.test(walletRaw) ? walletRaw.toLowerCase() : null;

    const stored = await insertRaiseContribution({ xHandle: x, discord, amountUsd, txHash: tx, wallet });
    return NextResponse.json({ ok: true, duplicate: !stored });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not record your contribution.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
