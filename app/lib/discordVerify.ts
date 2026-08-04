import crypto from 'crypto';

type DiscordStatePayload = {
  wallet: string;
  score: number;
  iat: number;
};

export type DiscordRoleResult = {
  roleId: string;
  name: string;
  ok: boolean;
  status: number;
  error?: string;
};

type RoleTier = {
  minScore: number;
  roleId: string;
  name?: string;
};

const STATE_TTL_MS = 10 * 60 * 1000;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function stateSecret(): string {
  const secret =
    process.env.DISCORD_STATE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.DISCORD_CLIENT_SECRET;
  if (!secret) throw new Error('Missing DISCORD_STATE_SECRET or DISCORD_CLIENT_SECRET');
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', stateSecret()).update(payload).digest('base64url');
}

export function createDiscordState(wallet: string, score: number): string {
  const payload = base64url(JSON.stringify({ wallet, score, iat: Date.now() } satisfies DiscordStatePayload));
  return `${payload}.${sign(payload)}`;
}

export function readDiscordState(state: string): DiscordStatePayload {
  const [payload, mac] = String(state || '').split('.');
  if (!payload || !mac || sign(payload) !== mac) throw new Error('Invalid state');

  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as DiscordStatePayload;
  if (!parsed.wallet || !Number.isFinite(parsed.score) || !Number.isFinite(parsed.iat)) {
    throw new Error('Malformed state');
  }
  if (Date.now() - parsed.iat > STATE_TTL_MS) throw new Error('Expired state');
  return parsed;
}

export function getBaseUrl(requestUrl: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (configured) {
    return configured.startsWith('http') ? configured.replace(/\/$/, '') : `https://${configured.replace(/\/$/, '')}`;
  }
  const url = new URL(requestUrl);
  return url.origin;
}

export function discordRedirectUri(requestUrl: string): string {
  return `${getBaseUrl(requestUrl)}/api/discord/callback`;
}

export function roleTiersForScore(score: number): RoleTier[] {
  const tiers: RoleTier[] = [];

  const defaultRole = process.env.DISCORD_ROLE_ID || process.env.DISCORD_VERIFIED_ROLE_ID;
  if (defaultRole && score > 0) {
    tiers.push({ minScore: 1, roleId: defaultRole, name: 'Verified Collector' });
  }

  const raw = process.env.DISCORD_ROLE_TIERS;
  if (raw) {
    const parsed = JSON.parse(raw) as RoleTier[];
    for (const tier of parsed) {
      if (
        Number.isFinite(tier.minScore) &&
        tier.roleId &&
        score >= tier.minScore &&
        !tiers.some((existing) => existing.roleId === tier.roleId)
      ) {
        tiers.push(tier);
      }
    }
  }

  return tiers;
}

export async function fetchDiscordUser(accessToken: string): Promise<{ id: string; username: string; global_name?: string }> {
  const res = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch Discord user');
  return res.json();
}

export async function assignDiscordRoles(discordUserId: string, score: number): Promise<DiscordRoleResult[]> {
  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!guildId || !botToken) throw new Error('Missing Discord guild or bot token');

  const roles = roleTiersForScore(score);
  const results: DiscordRoleResult[] = [];

  for (const role of roles) {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${role.roleId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Length': '0',
        },
      }
    );
    const text = res.ok ? '' : await res.text();
    results.push({
      roleId: role.roleId,
      name: role.name || `Score ${role.minScore}+`,
      ok: res.ok || res.status === 204,
      status: res.status,
      error: text || undefined,
    });
  }

  return results;
}
