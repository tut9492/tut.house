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

// All profiles (lightweight fields) — used to build the leaderboard by scoring each wallet.
export async function getAllProfiles(): Promise<{ wallet: string; username: string; avatar: CollectorProfile['avatar'] }[]> {
  const sql = client();
  const rows = (await sql`SELECT wallet, username, avatar FROM collector_profiles`) as {
    wallet: string; username: string; avatar: CollectorProfile['avatar'];
  }[];
  return rows;
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
