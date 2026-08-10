// Shared collector-profile types + validation. No server-only imports here so the
// wizard (client) and the API routes (server) can both use these rules.

export type ArtRef = {
  tokenKey: string;        // `${collectionSlug}:${tokenId}` — stable identity for a piece
  image: string;
  title: string;
  collection: string;
  collectionSlug: string;
  permalink: string;
  weight: number;
};

export type CollectorProfile = {
  wallet: string;
  username: string;
  socialUrl: string | null;
  avatar: { tokenKey: string; image: string } | null;
  frame: ArtRef | null;      // the single large "Esteemed Works" piece
  gallery: ArtRef[];         // up to MAX_GALLERY curated pieces
  updatedAt: string;
};

// What the wizard sends to PUT — only identity + references. The server resolves the
// references against the wallet's real holdings, so clients can't inject arbitrary art.
export type ProfileInput = {
  username: string;
  socialUrl?: string | null;
  avatarTokenKey?: string | null;
  frameTokenKey?: string | null;
  galleryTokenKeys?: string[];
};

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
export const MAX_GALLERY = 5;
export const MAX_SOCIAL_URL = 200;

export function artTokenKey(collectionSlug: string, tokenId: string): string {
  return `${collectionSlug}:${tokenId}`;
}

export function normalizeUsername(raw: string): string {
  return String(raw || '').trim();
}

export function isValidUsername(u: string): boolean {
  return USERNAME_RE.test(u);
}

// Social link is optional. When present it must be a plain https URL (no javascript:,
// data:, etc.) so we never render a hostile href.
export function isValidSocialUrl(u: string | null | undefined): boolean {
  if (!u) return true;
  if (u.length > MAX_SOCIAL_URL) return false;
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
}
