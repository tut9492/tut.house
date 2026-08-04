import { NextRequest, NextResponse } from 'next/server';
import { discordRedirectUri, readDiscordState } from '@/app/lib/discordVerify';

export async function GET(request: NextRequest) {
  try {
    const state = request.nextUrl.searchParams.get('state') || '';
    readDiscordState(state);

    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) throw new Error('Missing DISCORD_CLIENT_ID');

    const authUrl = new URL('https://discord.com/api/oauth2/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', discordRedirectUri(request.url));
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'identify');
    authUrl.searchParams.set('state', state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Discord link failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
