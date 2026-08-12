import { neon } from '@neondatabase/serverless';
import type { CollectorProfile } from './collectorProfile';

// Server-only. Collector profiles live in the tut-house Neon project (blue-art-47234366),
// table `collector_profiles`, keyed by lowercase wallet.

export function profileStoreEnabled(): boolean {
  return !!process.env.DATABASE_URL;
}

function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Profile store is not configured (DATABASE_URL missing).');
  return neon(url);
}

type Row = {
  wallet: string;
  username: string;
  social_url: string | null;
  avatar: CollectorProfile['avatar'];
  frame: CollectorProfile['frame'];
  gallery: CollectorProfile['gallery'] | null;
  updated_at: string;
};

function rowToProfile(r: Row): CollectorProfile {
  return {
    wallet: r.wallet,
    username: r.username,
    socialUrl: r.social_url,
    avatar: r.avatar ?? null,
    frame: r.frame ?? null,
    gallery: Array.isArray(r.gallery) ? r.gallery : [],
    updatedAt: r.updated_at,
  };
}

export async function getProfileByWallet(wallet: string): Promise<CollectorProfile | null> {
  const sql = client();
  const rows = (await sql`
    SELECT wallet, username, social_url, avatar, frame, gallery, updated_at
    FROM collector_profiles WHERE wallet = ${wallet.toLowerCase()}
  `) as Row[];
  return rows[0] ? rowToProfile(rows[0]) : null;
}

// All profiles (lightweight fields) — used to (re)build the leaderboard by scoring each wallet.
export async function getAllProfiles(): Promise<{ wallet: string; username: string; avatar: CollectorProfile['avatar'] }[]> {
  const sql = client();
  const rows = (await sql`SELECT wallet, username, avatar FROM collector_profiles`) as {
    wallet: string; username: string; avatar: CollectorProfile['avatar'];
  }[];
  return rows;
}

// A wallet's indexed Breadio tokens (MegaETH has no NFT API — see breadio_tokens indexer).
export async function getBreadioTokens(wallet: string, limit: number): Promise<{ tokenId: string; image: string; name: string }[]> {
  if (!process.env.DATABASE_URL) return [];
  const sql = client();
  const rows = (await sql`
    SELECT token_id, image, name FROM breadio_tokens
    WHERE owner = ${wallet.toLowerCase()} ORDER BY token_id LIMIT ${limit}
  `) as { token_id: number | string; image: string; name: string }[];
  return rows.map((r) => ({ tokenId: String(r.token_id), image: r.image, name: r.name }));
}

export type LeaderboardBadge = { slug: string; name: string; count: number; image: string | null };
export type StoredLeaderboardRow = {
  wallet: string; username: string; avatar: CollectorProfile['avatar'];
  score: number; tier: string | null; badges: LeaderboardBadge[];
};

// Persist a wallet's computed score snapshot. No-ops when the wallet has no profile row.
export async function updateProfileScore(
  wallet: string, score: number, tier: string, badges: LeaderboardBadge[],
): Promise<void> {
  const sql = client();
  await sql`
    UPDATE collector_profiles
    SET score = ${score}, tier = ${tier}, badges = ${JSON.stringify(badges)}::jsonb, score_updated_at = now()
    WHERE wallet = ${wallet.toLowerCase()}
  `;
}

// Fast leaderboard read straight from stored scores — no Alchemy fan-out.
export async function getStoredLeaderboard(limit: number): Promise<StoredLeaderboardRow[]> {
  const sql = client();
  const rows = (await sql`
    SELECT wallet, username, avatar, score, tier, badges
    FROM collector_profiles
    WHERE score > 0
    ORDER BY score DESC, score_updated_at DESC NULLS LAST
    LIMIT ${limit}
  `) as StoredLeaderboardRow[];
  return rows.map((r) => ({ ...r, badges: Array.isArray(r.badges) ? r.badges : [] }));
}

// Wallets whose stored score is stale (never scored, or older than `olderThanMs`), oldest first.
// Used to self-heal the leaderboard: the board rescoring a few of these on each (uncached) read
// keeps scores fresh without depending on the daily cron actually firing.
export async function getStaleProfileWallets(limit: number, olderThanMs: number): Promise<string[]> {
  const sql = client();
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const rows = (await sql`
    SELECT wallet FROM collector_profiles
    WHERE score_updated_at IS NULL OR score_updated_at < ${cutoff}
    ORDER BY score_updated_at ASC NULLS FIRST
    LIMIT ${limit}
  `) as { wallet: string }[];
  return rows.map((r) => r.wallet);
}

export async function getProfileByUsername(username: string): Promise<CollectorProfile | null> {
  const sql = client();
  const rows = (await sql`
    SELECT wallet, username, social_url, avatar, frame, gallery, updated_at
    FROM collector_profiles WHERE username_lower = ${username.toLowerCase()}
  `) as Row[];
  return rows[0] ? rowToProfile(rows[0]) : null;
}

// True when the username is held by a DIFFERENT wallet (case-insensitive).
export async function isUsernameTaken(username: string, exceptWallet: string): Promise<boolean> {
  const sql = client();
  const rows = (await sql`
    SELECT 1 FROM collector_profiles
    WHERE username_lower = ${username.toLowerCase()} AND wallet <> ${exceptWallet.toLowerCase()}
  `) as unknown[];
  return rows.length > 0;
}

export class UsernameTakenError extends Error {
  constructor() {
    super('That username is taken.');
    this.name = 'UsernameTakenError';
  }
}

export async function upsertProfile(p: CollectorProfile): Promise<CollectorProfile> {
  const sql = client();
  try {
    const rows = (await sql`
      INSERT INTO collector_profiles
        (wallet, username, username_lower, social_url, avatar, frame, gallery, updated_at)
      VALUES
        (${p.wallet.toLowerCase()}, ${p.username}, ${p.username.toLowerCase()}, ${p.socialUrl},
         ${JSON.stringify(p.avatar)}::jsonb, ${JSON.stringify(p.frame)}::jsonb,
         ${JSON.stringify(p.gallery)}::jsonb, now())
      ON CONFLICT (wallet) DO UPDATE SET
        username = EXCLUDED.username,
        username_lower = EXCLUDED.username_lower,
        social_url = EXCLUDED.social_url,
        avatar = EXCLUDED.avatar,
        frame = EXCLUDED.frame,
        gallery = EXCLUDED.gallery,
        updated_at = now()
      RETURNING wallet, username, social_url, avatar, frame, gallery, updated_at
    `) as Row[];
    return rowToProfile(rows[0]);
  } catch (err) {
    // username_lower unique violation from a concurrent claim by another wallet.
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === '23505') {
      throw new UsernameTakenError();
    }
    throw err;
  }
}
