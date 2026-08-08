'use client';

import { useState, useEffect } from 'react';

interface CollectorsHubWindowProps {
  id: string;
  title: string;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
  zIndex: number;
}

type CollectorSession = {
  wallet: string;
  score: number;
  rank: string;
  discordLink: string;
};

type DiscordResult = {
  type: 'tut_discord_verified';
  ok: boolean;
  score?: number;
  rank?: string;
  error?: string;
};

type DiscordConnection = {
  type: 'tut_discord_connected';
  ok: boolean;
  code: string;
  discordUserId: string;
  discordUsername: string;
};

type LeaderboardEntry = {
  wallet: string;
  score: number;
  rank: string;
};

type ScoreCollection = {
  slug: string;
  name: string;
  kind: string;
  weight: number;
  count: number;
  score: number;
  artworks: OwnedArtwork[];
};

type ScoreBreakdown = {
  assetCount: number;
  oneOfOneCount: number;
  base: number;
  breadthBonus: number;
  depthBonus: number;
  calculatedScore: number;
  rank: string;
  collections: ScoreCollection[];
  formula: string;
};

type OwnedArtwork = {
  tokenId: string;
  title: string;
  image: string;
  permalink: string;
  collection: string;
  collectionSlug: string;
  weight: number;
};

type CollectorDashboard = {
  wallet: string;
  score: number;
  rank: string;
  breakdown: ScoreBreakdown;
  holdings: {
    assets: {
      count: number;
      shown: number;
      artworks: OwnedArtwork[];
    };
    collections: ScoreCollection[];
  };
  updatedAt: string;
};

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

function shortWallet(wallet: string) {
  return wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : '';
}

function buildMessage(wallet: string) {
  const nonce =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return [
    'Verify tut.house collector access',
    `Wallet: ${wallet.toLowerCase()}`,
    `Timestamp: ${Date.now()}`,
    `Nonce: ${nonce}`,
  ].join('\n');
}

function buildDiscordMessage(wallet: string, discordUserId: string, timestamp: number) {
  return [
    'Verify tut.house Discord collector role',
    `Wallet: ${wallet.toLowerCase()}`,
    `Discord User: ${discordUserId}`,
    `Timestamp: ${timestamp}`,
  ].join('\n');
}

// Collection accent (badge tint + gallery swatch), keyed by collection slug.
const SWATCH: Record<string, string> = {
  'kingtut-genesis': '#cbf000',
  'abstractions': '#c58aa8',
  'obsessive-cycles-of-fiber': '#e0b23a',
  'breadio': '#c86a4a',
  'tut-loudio': '#4a6f9c',
  'tut-editions': '#6f8a4a',
};

// STATUS window copy — playful, family-themed, mapped from the collector rank.
// Edit these five to retune the voice; the honest tier name is the fallback.
const STATUS_LABELS: Record<string, string> = {
  Unscored: 'Stray',
  Holder: 'Deadbeat Dad',
  Collector: 'Provider',
  Whale: 'Breadwinner',
  Legend: 'Head of Household',
};

const HUB_CSS = `
#collectors-hub {
  --mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;
  --sans:"Segoe UI",-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
  --ink:#141019; --lime:#cbf000; --pink:#eaa7be; --gold:#edb52e; --gray:#dcdcdc;
  --blurple:#5865f2; --blue:#a9c6e8; --navy:#1d2532; --olive:#6f8600;
  --label:#8a8a93; --hair:#ececec; --hair2:#e0e0e0;
  --shadow:4px 5px 0 0 rgba(20,16,30,.26), 0 16px 30px -12px rgba(30,20,45,.5);
  position:fixed; top:0; left:0; right:0; bottom:48px; overflow-y:auto;
  padding:26px 30px 60px; color:var(--ink);
  font-family:var(--sans); -webkit-font-smoothing:antialiased;
  background:#c3b8cb url(/assets/images/hubClouds.jpg) center/cover fixed no-repeat;
}
/* pink gradient layered ABOVE the clouds for the dusk effect */
#collectors-hub::before { content:""; position:fixed; top:0; left:0; right:0; bottom:48px; background:url(/assets/images/hubPink.jpg) center/cover no-repeat; opacity:.6; mix-blend-mode:multiply; pointer-events:none; z-index:0; }
#collectors-hub .ch-top, #collectors-hub .desk, #collectors-hub .hub-footer { position:relative; z-index:1; }
#collectors-hub .ch-top { display:flex; align-items:flex-start; justify-content:space-between; max-width:1180px; margin:0 auto 22px; }
#collectors-hub .ch-wordmark { width:120px; height:52px; background-repeat:no-repeat; background-position:left center; background-size:contain; filter:brightness(0); }
#collectors-hub .ch-hubclose { width:30px; height:26px; border:3px solid #000; border-radius:6px; background:#ededed; font:700 15px/1 var(--mono); color:#000; cursor:pointer; box-shadow:3px 3px 0 0 rgba(20,16,30,.24); display:grid; place-items:center; padding:0; }
#collectors-hub .ch-hubclose:hover { filter:brightness(.94); }

#collectors-hub .win { border:3px solid #000; border-radius:12px; background:#fff; box-shadow:var(--shadow); overflow:hidden; }
#collectors-hub .bar { display:flex; align-items:center; gap:10px; padding:9px 12px; border-bottom:3px solid #000; }
#collectors-hub .bar .t { font:700 14.5px/1 var(--mono); letter-spacing:.11em; color:#000; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#collectors-hub .ctl { margin-left:auto; display:flex; gap:5px; flex:none; }
#collectors-hub .ctl b { width:25px; height:21px; border:2.5px solid #000; border-radius:5px; background:#ededed; font:700 12px/1 var(--mono); display:grid; place-items:center; color:#000; }
#collectors-hub .w-lime .bar { background:var(--lime); }
#collectors-hub .w-pink .bar { background:var(--pink); }
#collectors-hub .w-gold .bar { background:var(--gold); }
#collectors-hub .w-gray .bar { background:var(--gray); }
#collectors-hub .w-blurple .bar { background:var(--blurple); }
#collectors-hub .w-blurple .bar .t { color:#fff; }
#collectors-hub .w-blurple .ctl b { background:#cdd2fb; }
#collectors-hub .w-blue .bar { background:var(--blue); }

#collectors-hub .desk { display:grid; grid-template-columns:352px 1fr; gap:22px; align-items:start; max-width:1180px; margin:0 auto; }
#collectors-hub .col-left { display:flex; flex-direction:column; gap:16px; }
#collectors-hub .col-right { min-width:0; }
#collectors-hub .full { grid-column:1 / -1; }
#collectors-hub .trio { display:grid; grid-template-columns:1.05fr 1.2fr 1fr; gap:22px; }
@media (max-width:880px){ #collectors-hub .desk { grid-template-columns:1fr; } #collectors-hub .trio { grid-template-columns:1fr; } }

/* FAMILY MEMBER */
#collectors-hub .fm-body { display:flex; flex-direction:column; align-items:center; gap:16px; padding:26px 18px 30px; }
#collectors-hub .ch-avatar { width:150px; height:150px; border-radius:22px; background-size:cover; background-position:center; box-shadow:0 6px 16px -6px rgba(0,0,0,.4); }
#collectors-hub .ch-avatar.empty { display:grid; place-items:center; background:#f0efec; box-shadow:none; border:2px dashed #cdcdcd; font:700 34px/1 var(--mono); color:#c4c4c4; }
#collectors-hub .fm-name { font:700 26px/1 var(--mono); letter-spacing:.06em; color:#161616; }
#collectors-hub .fm-signin { display:flex; flex-direction:column; align-items:center; gap:12px; }
#collectors-hub .fm-signin .sub { font:400 12.5px/1.5 var(--sans); color:var(--label); text-align:center; max-width:24ch; }
#collectors-hub .btn-navy { border:3px solid #000; border-radius:9px; background:var(--navy); color:#fff; font:600 13.5px/1 var(--sans); padding:12px 22px; cursor:pointer; box-shadow:3px 3px 0 0 rgba(20,16,30,.24); }
#collectors-hub .btn-navy:hover { background:#171d28; }
#collectors-hub .btn-navy:disabled { opacity:.6; cursor:default; }

/* STATUS / GOLD STARS slim bars */
#collectors-hub .stars-num { font-variant-numeric:tabular-nums; }

/* BADGES */
#collectors-hub .badges { display:flex; flex-wrap:wrap; gap:13px; padding:16px 15px 18px; justify-content:space-between; }
#collectors-hub .ch-badge { width:70px; height:70px; border-radius:50%; position:relative; flex:none; border:2px solid rgba(0,0,0,.35); box-shadow:inset 0 2px 4px rgba(255,255,255,.65), inset 0 -4px 8px rgba(0,0,0,.4), 0 3px 6px rgba(0,0,0,.34); }
#collectors-hub .ch-badge i { position:absolute; inset:4px; border-radius:50%; background-size:cover; background-position:center; border:1.5px solid rgba(0,0,0,.25); }
#collectors-hub .ch-badge .lock { position:absolute; inset:0; display:none; place-items:center; font-size:20px; }
#collectors-hub .ch-badge.locked { filter:grayscale(1) brightness(.92); opacity:.5; }
#collectors-hub .ch-badge.locked .lock { display:grid; }

/* ESTEEMED WORKS */
#collectors-hub .esteem-body { padding:22px; background:linear-gradient(#fff,#fbfbfa); }
#collectors-hub .ch-mat { background:#fff; padding:20px; border-radius:4px; box-shadow:0 20px 44px -20px rgba(0,0,0,.45), 0 0 0 1px #eee; }
#collectors-hub .ch-art { width:100%; aspect-ratio:4/5; border-radius:2px; background-size:cover; background-position:center; background-color:#efeae2; }
#collectors-hub .ch-art.hero { aspect-ratio:3/3.4; }
#collectors-hub .esteem-cap { display:flex; justify-content:space-between; align-items:baseline; gap:12px; margin-top:14px; padding:0 2px; }
#collectors-hub .esteem-cap .ti { font:600 15px/1.25 var(--sans); color:#1a1a1a; }
#collectors-hub .esteem-cap .wt { font:700 12px/1 var(--mono); color:var(--olive); white-space:nowrap; }
#collectors-hub .esteem-empty { text-align:center; color:var(--label); font-size:13px; padding:40px 10px; }

/* GALLERY */
#collectors-hub .gallery { display:flex; gap:20px; padding:22px; overflow-x:auto; background:linear-gradient(#fff,#fcfcfb); }
#collectors-hub .ch-frame { flex:none; width:210px; text-decoration:none; }
#collectors-hub .ch-frame .ch-mat { padding:14px; }
#collectors-hub .ch-frame .cap { font:500 11.5px/1.3 var(--sans); color:#5a5a62; margin-top:9px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#collectors-hub .gal-empty { padding:40px 18px; font-size:13px; color:var(--label); }

/* DISCORD */
#collectors-hub .disc-body { padding:16px 18px 18px; }
#collectors-hub .disc-lede { font:400 13px/1.55 var(--sans); color:#4a4a52; margin:0 0 14px; }
#collectors-hub .disc-btns { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
#collectors-hub .btn { border:2.5px solid #000; border-radius:8px; font:600 12.5px/1 var(--sans); padding:11px; cursor:pointer; box-shadow:2px 2px 0 0 rgba(20,16,30,.2); }
#collectors-hub .btn:disabled { opacity:.45; cursor:default; }
#collectors-hub .btn.blur { background:var(--blurple); color:#fff; }
#collectors-hub .btn.navy { background:var(--navy); color:#fff; }
#collectors-hub .note { margin-top:12px; font:400 12px/1.5 var(--sans); padding:9px 11px; border-radius:8px; border:2px solid; }
#collectors-hub .note.ok { color:#3a6b40; background:#f2f8ef; border-color:#bcdcb2; }
#collectors-hub .note.info { color:#3a44a0; background:#f1f2fe; border-color:#cdd2fb; }
#collectors-hub .note.err { color:#9a3b3b; background:#fdf1f1; border-color:#f2d3d3; }
#collectors-hub .steps { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-top:13px; }
#collectors-hub .step { border:2px solid #000; border-radius:7px; padding:8px 4px; text-align:center; background:#f4f4f2; }
#collectors-hub .step .n { font:700 9px/1 var(--mono); color:#9a9aa2; }
#collectors-hub .step .l { font:600 10.5px/1 var(--sans); margin-top:4px; color:#6a6a72; }
#collectors-hub .step.done { background:var(--navy); border-color:#000; }
#collectors-hub .step.done .n { color:var(--lime); }
#collectors-hub .step.done .l { color:#fff; }
#collectors-hub .legal { display:flex; gap:13px; margin-top:12px; font-size:11px; }
#collectors-hub .legal a { color:var(--label); text-decoration:none; border-bottom:1px solid var(--hair2); }
#collectors-hub .legal a:hover { color:var(--ink); }

/* SCORING */
#collectors-hub .score-body { padding:16px 18px 18px; }
#collectors-hub .formula { font:600 11.5px/1.7 var(--mono); background:#171d28; color:#e9ecdd; padding:13px 15px; border-radius:9px; white-space:pre; overflow-x:auto; margin:0 0 14px; }
#collectors-hub .wrow { display:grid; grid-template-columns:1fr auto auto; gap:10px; align-items:center; padding:7px 0; border-bottom:1px solid var(--hair); font:500 12.5px/1 var(--sans); }
#collectors-hub .wrow:last-child { border-bottom:none; }
#collectors-hub .wrow .k { font:700 8px/1 var(--mono); letter-spacing:.05em; text-transform:uppercase; color:var(--label); border:1.5px solid var(--hair2); border-radius:4px; padding:2px 5px; justify-self:start; }
#collectors-hub .wrow .w { font:700 12px/1 var(--mono); color:var(--olive); font-variant-numeric:tabular-nums; }

/* RANKS */
#collectors-hub .lbhead, #collectors-hub .lbrow { display:grid; grid-template-columns:40px 1fr auto; align-items:center; gap:8px; padding:10px 15px; }
#collectors-hub .lbhead { background:#f4f4f2; border-bottom:2px solid #000; font:700 8.5px/1 var(--mono); letter-spacing:.1em; text-transform:uppercase; color:var(--label); }
#collectors-hub .lbrow { border-bottom:1px solid var(--hair); font:500 13px/1 var(--sans); }
#collectors-hub .lbrow:last-child { border-bottom:none; }
#collectors-hub .lbrow .r { font:700 13px/1 var(--mono); }
#collectors-hub .lbrow .wal { font:500 12px/1 var(--mono); color:#4a4a52; }
#collectors-hub .lbrow .sc { font:700 12.5px/1 var(--mono); color:#161616; font-variant-numeric:tabular-nums; text-align:right; }
#collectors-hub .lbrow.me { background:#fbfde8; }
#collectors-hub .lb-empty { padding:20px 15px; font-size:13px; color:var(--label); }

/* sealed / signed-out muting of the personal windows */
#collectors-hub.sealed .mute { filter:grayscale(1) brightness(.98); opacity:.55; }

/* Scoring + Ranks share their own row */
#collectors-hub .pair { display:grid; grid-template-columns:1fr 1fr; gap:22px; }
@media (max-width:880px){ #collectors-hub .pair { grid-template-columns:1fr; } }

/* Discord as a small icon under the pfp (no full card) */
#collectors-hub .fm-discord { display:flex; flex-direction:column; align-items:center; gap:6px; margin-top:2px; }
#collectors-hub .disc-ico { width:42px; height:42px; border:2.5px solid #000; border-radius:11px; background:var(--blurple); display:grid; place-items:center; cursor:pointer; box-shadow:2px 2px 0 0 rgba(20,16,30,.24); padding:0; transition:filter .15s; }
#collectors-hub .disc-ico:hover { filter:brightness(1.06); }
#collectors-hub .disc-ico:disabled { cursor:default; }
#collectors-hub .disc-ico svg { width:25px; height:25px; fill:#fff; }
#collectors-hub .disc-ico.done { background:#3a6b40; }
#collectors-hub .disc-cap { font:600 10.5px/1.35 var(--sans); color:var(--label); letter-spacing:.02em; text-align:center; max-width:26ch; }
#collectors-hub .disc-cap.err { color:#9a3b3b; }

/* legal footer */
#collectors-hub .hub-footer { display:flex; justify-content:center; gap:16px; max-width:1180px; margin:26px auto 0; font-size:11px; }
#collectors-hub .hub-footer a { color:#6a6a72; text-decoration:none; border-bottom:1px solid rgba(0,0,0,.16); }
#collectors-hub .hub-footer a:hover { color:#161616; }

@media (prefers-reduced-motion:reduce){ #collectors-hub * { transition-duration:.001ms !important; } }
`;

export default function CollectorsHubWindow({ onClose, onClick, zIndex }: CollectorsHubWindowProps) {
  const [wallet, setWallet] = useState('');
  const [session, setSession] = useState<CollectorSession | null>(null);
  const [discordConnection, setDiscordConnection] = useState<DiscordConnection | null>(null);
  const [discordResult, setDiscordResult] = useState<DiscordResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'signing' | 'verified' | 'discord_connected' | 'assigning' | 'discord'>('idle');
  const [error, setError] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [dashboard, setDashboard] = useState<CollectorDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as DiscordResult | DiscordConnection;
      if (data?.type === 'tut_discord_connected') {
        setDiscordConnection(data);
        setStatus('discord_connected');
        setError('');
        return;
      }
      if (data?.type === 'tut_discord_verified') {
        setDiscordResult(data);
        if (data.ok) {
          setStatus('discord');
          setError('');
        } else {
          setError(data.error || 'Discord linked, but role assignment needs attention.');
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadLeaderboard = async () => {
      setLeaderboardLoading(true);
      try {
        const res = await fetch('/api/collectors/leaderboard?limit=50');
        if (!res.ok) return;
        const data = (await res.json()) as { leaderboard?: LeaderboardEntry[] };
        if (!cancelled) setLeaderboard(data.leaderboard || []);
      } catch {
        if (!cancelled) setLeaderboard([]);
      } finally {
        if (!cancelled) setLeaderboardLoading(false);
      }
    };

    void loadLeaderboard();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadCollectorDashboard = async (selectedWallet: string) => {
    setDashboardLoading(true);
    try {
      const res = await fetch(`/api/collectors/holdings?wallet=${encodeURIComponent(selectedWallet)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not load collector holdings.');
      setDashboard(data);
      setSession((prev) => prev ? { ...prev, score: data.score, rank: data.rank } : prev);
    } catch (err) {
      setDashboard(null);
      setError(err instanceof Error ? err.message : 'Could not load collector holdings.');
    } finally {
      setDashboardLoading(false);
    }
  };

  const connectAndVerify = async () => {
    setError('');
    setDiscordResult(null);
    setDiscordConnection(null);
    setDashboard(null);
    try {
      if (!window.ethereum) {
        setError('No wallet found. Open this with MetaMask, Rabby, or another EVM wallet.');
        return;
      }

      setStatus('connecting');
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const selected = (accounts?.[0] || '').toLowerCase();
      if (!selected) throw new Error('Wallet connection cancelled.');
      setWallet(selected);

      setStatus('signing');
      const message = buildMessage(selected);
      const signature = (await window.ethereum.request({
        method: 'personal_sign',
        params: [message, selected],
      })) as `0x${string}`;

      const res = await fetch('/api/collectors/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: selected, message, signature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not verify collector score.');

      setSession(data);
      setStatus('verified');
      await loadCollectorDashboard(selected);
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Wallet verification failed.');
    }
  };

  const linkDiscord = () => {
    if (!session?.discordLink) return;
    setError('');
    const popup = window.open(session.discordLink, 'tu-discord-verify', 'width=520,height=720');
    if (!popup) {
      window.location.href = session.discordLink;
    }
  };

  const signAndAssignRole = async () => {
    if (!wallet || !discordConnection?.code || !discordConnection.discordUserId) return;
    setError('');
    setStatus('assigning');

    try {
      if (!window.ethereum) throw new Error('No wallet found.');
      const timestamp = Date.now();
      const message = buildDiscordMessage(wallet, discordConnection.discordUserId, timestamp);
      const signature = (await window.ethereum.request({
        method: 'personal_sign',
        params: [message, wallet],
      })) as `0x${string}`;

      const res = await fetch('/api/discord/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          signature,
          timestamp,
          discord_code: discordConnection.code,
        }),
      });
      const data = await res.json();
      setDiscordResult({ type: 'tut_discord_verified', ...data });
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Discord role assignment needs attention.');
      setSession((prev) => prev ? { ...prev, score: data.score, rank: data.rank } : prev);
      setStatus('discord');
    } catch (err) {
      setStatus('discord_connected');
      setError(err instanceof Error ? err.message : 'Could not assign Discord role.');
    }
  };

  const signedIn = !!session;
  const artworks = dashboard?.holdings.assets.artworks || [];
  const topArt = artworks.length ? [...artworks].sort((a, b) => b.weight - a.weight)[0] : null;
  const rank = session?.rank || dashboard?.rank || 'Unscored';
  const statusLabel = STATUS_LABELS[rank] || rank;
  const targetScore = dashboard?.score ?? session?.score ?? 0;

  useEffect(() => {
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || targetScore === 0) { setDisplayScore(targetScore); return; }
    let raf = 0;
    const t0 = performance.now();
    const dur = 1200;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setDisplayScore(Math.round(targetScore * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetScore]);

  const badgeCollections =
    dashboard?.holdings.collections && dashboard.holdings.collections.length
      ? dashboard.holdings.collections
      : null;

  const walletActionLabel =
    status === 'connecting' ? 'Connecting…' : status === 'signing' ? 'Check wallet…' : 'Sign in with wallet';

  const goldStars = signedIn ? displayScore.toLocaleString() : '—';

  // Discord affordance (now a single icon under the pfp, no full card).
  const discordDone = !!discordResult?.ok || status === 'discord';
  const discordAction = discordConnection ? signAndAssignRole : linkDiscord;
  const discordCap = discordDone
    ? 'Role active'
    : status === 'assigning'
      ? 'Signing…'
      : discordConnection
        ? 'Sign to assign role'
        : 'Connect Discord';

  return (
    <div id="collectors-hub" className={signedIn ? '' : 'sealed'} style={{ zIndex }} onClick={onClick}>
      <style>{HUB_CSS}</style>

      <div className="ch-top">
        <div className="ch-wordmark" style={{ backgroundImage: 'url(/assets/images/tutLogo.png)' }} aria-label="tut" />
        <button className="ch-hubclose window-controls" onClick={onClose} aria-label="Close">X</button>
      </div>

      <div className="desk">
        {/* ================= LEFT COLUMN ================= */}
        <div className="col-left">

          {/* FAMILY MEMBER */}
          <div className="win w-lime">
            <div className="bar"><span className="t">Family Member</span><span className="ctl"><b>X</b><b>_</b></span></div>
            <div className="fm-body">
              {signedIn ? (
                <>
                  <div className="ch-avatar" style={{ backgroundImage: 'url(/assets/images/aboutProfilePicture.png)' }} />
                  <div className="fm-name">{shortWallet(wallet)}</div>
                  <div className="fm-discord">
                    <button
                      className={`disc-ico${discordDone ? ' done' : ''}`}
                      onClick={discordAction}
                      disabled={discordDone || status === 'assigning'}
                      title={discordCap}
                      aria-label={discordCap}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.445.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.371-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.245.198.372.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.955 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.419-2.157 2.419z" /></svg>
                    </button>
                    <div className={`disc-cap${error ? ' err' : ''}`}>{error || discordCap}</div>
                  </div>
                </>
              ) : (
                <div className="fm-signin">
                  <div className="ch-avatar empty">?</div>
                  <div className="sub">Sign with the wallet that holds your tut™ work — a signature, never a transaction.</div>
                  <button className="btn-navy" onClick={connectAndVerify} disabled={status === 'connecting' || status === 'signing'}>
                    {walletActionLabel}
                  </button>
                  {error && <div className="note err">{error}</div>}
                </div>
              )}
            </div>
          </div>

          {/* STATUS */}
          <div className="win w-pink">
            <div className="bar"><span className="t">Status — {statusLabel}</span><span className="ctl"><b>X</b><b>_</b></span></div>
          </div>

          {/* GOLD STARS */}
          <div className="win w-gold mute">
            <div className="bar"><span className="t">Gold Stars ⭐ — <span className="stars-num">{goldStars}</span></span><span className="ctl"><b>X</b><b>_</b></span></div>
          </div>

          {/* BADGES */}
          <div className="win w-gray mute">
            <div className="bar"><span className="t">Badges</span><span className="ctl"><b>X</b><b>_</b></span></div>
            <div className="badges">
              {(badgeCollections || []).map((c) => {
                const owned = c.count > 0;
                const img = c.artworks?.[0]?.image;
                const tint = SWATCH[c.slug] || '#c9c9cf';
                return (
                  <div key={c.slug} className={`ch-badge${owned ? '' : ' locked'}`} title={`${c.name}${owned ? ` · ×${c.count}` : ''}`}>
                    <i style={owned && img ? { backgroundImage: `url(${img})` } : { background: `radial-gradient(circle at 35% 30%, ${tint}, rgba(0,0,0,.5))` }} />
                    <span className="lock">🔒</span>
                  </div>
                );
              })}
              {!badgeCollections &&
                Object.entries(SWATCH).map(([slug, tint]) => (
                  <div key={slug} className="ch-badge locked" title="Sign in to reveal">
                    <i style={{ background: `radial-gradient(circle at 35% 30%, ${tint}, rgba(0,0,0,.5))` }} />
                    <span className="lock">🔒</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN — ESTEEMED WORKS ================= */}
        <div className="col-right">
          <div className="win w-lime mute">
            <div className="bar"><span className="t">Esteemed Works</span><span className="ctl"><b>X</b><b>_</b></span></div>
            <div className="esteem-body">
              {topArt ? (
                <>
                  <div className="ch-mat">
                    <div className="ch-art hero" style={topArt.image ? { backgroundImage: `url(${topArt.image})` } : undefined} />
                  </div>
                  <div className="esteem-cap"><span className="ti">{topArt.title}</span><span className="wt">+{topArt.weight.toLocaleString()} ★</span></div>
                </>
              ) : (
                <div className="esteem-empty">
                  {dashboardLoading ? 'Loading your finest work…' : 'Sign in to hang your finest piece.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= GALLERY OF FINE ART ================= */}
        <div className="full">
          <div className="win w-lime mute">
            <div className="bar"><span className="t">Gallery of Fine Art</span><span className="ctl"><b>X</b><b>_</b></span></div>
            {artworks.length ? (
              <div className="gallery">
                {artworks.map((a) => (
                  <a
                    key={`${a.collectionSlug}-${a.tokenId}`}
                    className="ch-frame"
                    href={a.permalink || undefined}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => { if (!a.permalink) e.preventDefault(); }}
                  >
                    <div className="ch-mat"><div className="ch-art" style={a.image ? { backgroundImage: `url(${a.image})` } : undefined} /></div>
                    <div className="cap">{a.title}{a.collection ? ` · ${a.collection}` : ''}</div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="gal-empty">
                {dashboardLoading ? 'Loading your collection…' : 'Sign in on Family Member to hang your owned tut™ works.'}
              </div>
            )}
          </div>
        </div>

        {/* ================= PAIR: SCORING / RANKS ================= */}
        <div className="full pair">

          {/* SCORING */}
          <div className="win w-lime">
            <div className="bar"><span className="t">Scoring</span><span className="ctl"><b>X</b><b>_</b></span></div>
            <div className="score-body">
              <pre className="formula">{`stars = Σ (count × weight)
      + n² × 250      breadth
      + depth 3·5·10·25`}</pre>
              <div className="wrow"><span>Tut Genesis</span><span className="k">Genesis</span><span className="w">25,000</span></div>
              <div className="wrow"><span>Abstractions</span><span className="k">Series</span><span className="w">5,000</span></div>
              <div className="wrow"><span>OCF</span><span className="k">1/1</span><span className="w">1,000</span></div>
              <div className="wrow"><span>Breadio</span><span className="k">MegaETH</span><span className="w">500</span></div>
              <div className="wrow"><span>Tut Loudio</span><span className="k">Edition</span><span className="w">100</span></div>
              <div className="wrow"><span>tut™ Editions</span><span className="k">Edition</span><span className="w">50</span></div>
            </div>
          </div>

          {/* RANKS */}
          <div className="win w-blue">
            <div className="bar"><span className="t">Ranks</span><span className="ctl"><b>X</b><b>_</b></span></div>
            <div>
              <div className="lbhead"><div>#</div><div>Wallet</div><div style={{ textAlign: 'right' }}>Stars</div></div>
              {leaderboardLoading && <div className="lb-empty">Checking leaderboard…</div>}
              {!leaderboardLoading && leaderboard.length === 0 && (
                <div className="lb-empty">The leaderboard isn’t indexed yet. Sign in on Family Member for your live score.</div>
              )}
              {!leaderboardLoading && leaderboard.map((entry, i) => (
                <div key={`${entry.wallet}-${i}`} className={`lbrow${wallet && entry.wallet.toLowerCase() === wallet.toLowerCase() ? ' me' : ''}`}>
                  <div className="r">{i + 1}</div>
                  <div className="wal">{shortWallet(entry.wallet)}</div>
                  <div className="sc">{entry.score.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="hub-footer">
        <a href="/security" target="_blank" rel="noreferrer">Security</a>
        <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a>
        <a href="/terms" target="_blank" rel="noreferrer">Terms</a>
      </div>
    </div>
  );
}
