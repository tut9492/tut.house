import { NextRequest, NextResponse } from 'next/server';
import {
  discordRedirectUri,
  fetchDiscordUser,
  getBaseUrl,
  readDiscordState,
  storeDiscordToken,
} from '@/app/lib/discordVerify';

function html(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function resultPage(payload: Record<string, unknown>, title: string, detail: string, targetOrigin: string) {
  const encoded = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f2e8;color:#171717;font-family:Arial,sans-serif}
    main{width:min(420px,calc(100vw - 32px));border:2px solid #171717;background:#fff;padding:28px;box-shadow:8px 8px 0 #171717}
    h1{margin:0 0 12px;font-size:28px;line-height:1}
    p{margin:0 0 16px;color:#444;line-height:1.5}
    button{border:2px solid #171717;background:#171717;color:#fff;padding:10px 14px;font-weight:700;cursor:pointer}
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${detail}</p>
    <button onclick="window.close()">Close</button>
  </main>
  <script>
    if (window.opener) window.opener.postMessage(${encoded}, ${JSON.stringify(targetOrigin)});
    setTimeout(function(){ window.close(); }, 1800);
  </script>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state') || '';
  if (!code) return html('Missing Discord code', 400);

  try {
    readDiscordState(state);
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('Missing Discord OAuth config');

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: discordRedirectUri(request.url),
      }),
      cache: 'no-store',
    });
    if (!tokenRes.ok) throw new Error('Discord token exchange failed');

    const tokenData = (await tokenRes.json()) as { access_token: string };
    const discordUser = await fetchDiscordUser(tokenData.access_token);
    const targetOrigin = getBaseUrl(request.url);
    const opaqueCode = storeDiscordToken({
      access_token: tokenData.access_token,
      discord_user_id: discordUser.id,
      discord_username: discordUser.global_name || discordUser.username,
      discord_avatar: '',
    });

    return html(
      resultPage(
        {
          type: 'tut_discord_connected',
          ok: true,
          code: opaqueCode,
          discordUserId: discordUser.id,
          discordUsername: discordUser.global_name || discordUser.username,
        },
        'Discord Connected',
        `Discord connected for ${discordUser.global_name || discordUser.username}. Return to tut.house and sign once to receive your role.`,
        targetOrigin
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Discord verification failed';
    return html(
      resultPage({ type: 'tut_discord_verified', ok: false, error: message }, 'Verification Failed', message, getBaseUrl(request.url)),
      500
    );
  }
}
