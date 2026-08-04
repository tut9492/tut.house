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

type HubTab = 'verify' | 'holdings' | 'leaderboard' | 'guide';

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
  return wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : '';
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

const SWATCH: Record<string, string> = {
  'kingtut-genesis': '#cbf000',
  'abstractions': '#c58aa8',
  'obsessive-cycles-of-fiber': '#e0b23a',
  'breadio': '#c86a4a',
  'tut-loudio': '#4a6f9c',
  'tut-editions': '#6f8a4a',
};

const HUB_CSS = `
#collectors-hub {
  --bg:#fff; --chrome:#f5f5f4; --chrome-2:#efefee; --ink:#1c1c20; --ink-2:#40404a;
  --label:#9a9aa4; --faint:#b8b8bf; --hair:#ececec; --hair-2:#e0e0e0;
  --navy:#1d2532; --navy-2:#171d28; --acid:#cbf000; --olive:#6f8600; --blurple:#5865f2;
  position:fixed; top:0; left:0; right:0; bottom:48px; background:var(--bg);
  display:flex; flex-direction:column; overflow:hidden; color:var(--ink);
  font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
}
#collectors-hub .ch-titlebar { display:flex; align-items:center; padding:13px 18px; border-bottom:1px solid var(--hair); }
#collectors-hub .ch-ttl { font-size:14px; color:var(--ink-2); }
#collectors-hub .ch-close { margin-left:auto; width:12px; height:12px; border-radius:50%; background:#ec5f56; border:none; padding:0; cursor:pointer; }
#collectors-hub .ch-close:hover { filter:brightness(.92); }
#collectors-hub .ch-scroll { flex:1; overflow-y:auto; }

#collectors-hub .ch-masthead { display:grid; grid-template-columns:1fr auto; align-items:end; gap:24px; padding:34px 44px 22px; }
#collectors-hub .ch-kicker { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--label); }
#collectors-hub .ch-h1 { margin:8px 0 0; font-size:clamp(34px,5.6vw,58px); line-height:.95; letter-spacing:-.035em; font-weight:700; }
#collectors-hub .ch-tm { color:var(--acid); }
#collectors-hub .ch-lead { margin:12px 0 0; max-width:50ch; color:var(--ink-2); font-size:14.5px; line-height:1.55; }
#collectors-hub .ch-connect { border:none; border-radius:8px; background:var(--navy); color:#fff; font-weight:600; font-size:13.5px; padding:14px 24px; cursor:pointer; white-space:nowrap; transition:transform .14s, background .2s; }
#collectors-hub .ch-connect:hover { transform:translateY(-1px); background:var(--navy-2); }
#collectors-hub .ch-connect:disabled { opacity:.6; cursor:default; transform:none; }

#collectors-hub .ch-tabs { display:flex; gap:26px; padding:0 44px; border-bottom:1px solid var(--hair); }
#collectors-hub .ch-tab { background:none; border:none; cursor:pointer; padding:14px 0; position:relative; font-size:13.5px; font-weight:500; color:var(--label); font-family:inherit; transition:color .15s; }
#collectors-hub .ch-tab:hover { color:var(--ink); }
#collectors-hub .ch-tab[aria-selected="true"] { color:var(--ink); font-weight:600; }
#collectors-hub .ch-tab[aria-selected="true"]::after { content:""; position:absolute; left:0; right:0; bottom:-1px; height:2px; background:var(--ink); }
#collectors-hub .ch-tabcount { color:var(--faint); font-size:11px; margin-left:5px; }

#collectors-hub .ch-panels { padding:30px 44px 40px; }
@media (max-width:900px){ #collectors-hub .ch-masthead,#collectors-hub .ch-tabs,#collectors-hub .ch-panels{ padding-left:20px; padding-right:20px; } }

#collectors-hub .ch-passport { display:grid; grid-template-columns:1.02fr .98fr; gap:22px; }
@media (max-width:900px){ #collectors-hub .ch-passport{ grid-template-columns:1fr; } }

#collectors-hub .ch-readout { position:relative; border-radius:14px; padding:22px 24px 24px; background:var(--bg); border:1px solid var(--hair-2); overflow:hidden; }
#collectors-hub .ch-rhead { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
#collectors-hub .ch-rk { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--label); }
#collectors-hub .ch-serial { font-family:ui-monospace,Menlo,monospace; font-size:9.5px; letter-spacing:.08em; color:var(--faint); text-align:right; line-height:1.6; }
#collectors-hub .ch-scorelabel { font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--label); margin-top:22px; }
#collectors-hub .ch-score { font-weight:700; font-size:clamp(58px,11vw,94px); line-height:.84; letter-spacing:-.04em; margin-top:8px; color:var(--ink); font-variant-numeric:tabular-nums; }
#collectors-hub .ch-rankrow { display:flex; align-items:center; gap:12px; margin-top:20px; }
#collectors-hub .ch-rankbadge { display:inline-flex; align-items:center; gap:8px; padding:7px 14px 7px 10px; border-radius:999px; background:var(--bg); border:1px solid var(--hair-2); color:var(--ink); font-size:11.5px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; }
#collectors-hub .ch-seal { width:12px; height:12px; border-radius:3px; background:var(--acid); }
#collectors-hub .ch-walletchip { margin-left:auto; font-family:ui-monospace,Menlo,monospace; font-size:10.5px; color:var(--label); border:1px solid var(--hair-2); padding:5px 9px; border-radius:5px; }
#collectors-hub .ch-ladder { margin-top:22px; }
#collectors-hub .ch-track { height:7px; border-radius:999px; background:var(--chrome-2); border:1px solid var(--hair-2); overflow:hidden; }
#collectors-hub .ch-fill { height:100%; border-radius:999px; background:var(--acid); transition:width 1.1s cubic-bezier(.22,.9,.24,1); }
#collectors-hub .ch-marks { display:flex; justify-content:space-between; margin-top:8px; font-family:ui-monospace,Menlo,monospace; font-size:9.5px; color:var(--faint); }
#collectors-hub .ch-mark { display:flex; flex-direction:column; gap:1px; }
#collectors-hub .ch-mark b { color:var(--label); font-size:10px; }
#collectors-hub .ch-mark.hit { color:var(--ink); }
#collectors-hub .ch-mark.hit b { color:var(--olive); }
#collectors-hub .ch-tonext { margin-top:11px; font-size:12px; color:var(--label); }

#collectors-hub .ch-readout.is-locked .ch-reveal { visibility:hidden; }
#collectors-hub .ch-veil { display:none; }
#collectors-hub .ch-readout.is-locked .ch-veil { display:grid; place-items:center; text-align:center; position:absolute; inset:0; background:var(--bg); }
#collectors-hub .ch-lk { font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--olive); }
#collectors-hub .ch-lh { color:var(--ink); font-size:21px; font-weight:700; margin-top:9px; max-width:20ch; letter-spacing:-.02em; }
#collectors-hub .ch-ls { color:var(--label); font-size:11.5px; margin-top:9px; font-family:ui-monospace,Menlo,monospace; }

#collectors-hub .ch-trio { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:14px; }
#collectors-hub .ch-stat { border:1px solid var(--hair-2); border-radius:10px; padding:13px 14px; }
#collectors-hub .ch-k { font-size:9.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--label); }
#collectors-hub .ch-v { font-size:27px; font-weight:700; letter-spacing:-.02em; margin-top:5px; font-variant-numeric:tabular-nums; }

#collectors-hub .ch-side { display:flex; flex-direction:column; gap:14px; }
#collectors-hub .ch-block { border:1px solid var(--hair-2); border-radius:12px; padding:16px 18px; }
#collectors-hub .ch-block h3 { margin:0; font-size:13px; font-weight:600; display:flex; align-items:baseline; gap:8px; }
#collectors-hub .ch-sub { font-family:ui-monospace,Menlo,monospace; font-size:10.5px; color:var(--label); font-weight:400; }

#collectors-hub .ch-ledger { margin-top:10px; }
#collectors-hub .ch-lrow { display:grid; grid-template-columns:1fr auto; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--hair); font-size:13px; }
#collectors-hub .ch-lrow:last-child { border-bottom:none; }
#collectors-hub .ch-name { display:flex; align-items:center; gap:9px; }
#collectors-hub .ch-swatch { width:9px; height:9px; border-radius:2px; flex:none; }
#collectors-hub .ch-kind { font-family:ui-monospace,Menlo,monospace; font-size:8.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--label); border:1px solid var(--hair-2); border-radius:4px; padding:1px 5px; }
#collectors-hub .ch-math { font-family:ui-monospace,Menlo,monospace; font-size:11.5px; color:var(--ink); font-variant-numeric:tabular-nums; }
#collectors-hub .ch-lrow.zero { opacity:.42; }
#collectors-hub .ch-lrow.zero .ch-math { color:var(--label); }
#collectors-hub .ch-sum { display:grid; grid-template-columns:1fr auto; gap:10px; padding-top:9px; margin-top:3px; border-top:1px solid var(--hair-2); font-family:ui-monospace,Menlo,monospace; font-size:11.5px; font-variant-numeric:tabular-nums; }
#collectors-hub .ch-lbl { color:var(--label); }
#collectors-hub .ch-val { color:var(--ink); }
#collectors-hub .ch-sum.total { border-top:2px solid var(--ink); font-weight:700; font-size:13px; margin-top:2px; }

#collectors-hub .ch-steps { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; margin-top:12px; }
#collectors-hub .ch-step { border:1px solid var(--hair-2); border-radius:9px; padding:10px 6px; text-align:center; background:var(--chrome); }
#collectors-hub .ch-n { font-family:ui-monospace,Menlo,monospace; font-size:9.5px; color:var(--faint); }
#collectors-hub .ch-t { font-size:11.5px; font-weight:600; margin-top:3px; color:var(--label); }
#collectors-hub .ch-step.done { background:var(--navy); border-color:var(--navy); }
#collectors-hub .ch-step.done .ch-n { color:var(--acid); }
#collectors-hub .ch-step.done .ch-t { color:#fff; }

#collectors-hub .ch-disc { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-top:12px; }
#collectors-hub .ch-btn { border:1px solid var(--hair-2); background:var(--chrome); color:var(--ink); font-weight:600; font-size:12px; padding:11px; border-radius:8px; cursor:pointer; font-family:inherit; transition:transform .12s, opacity .2s; }
#collectors-hub .ch-btn:hover { transform:translateY(-1px); }
#collectors-hub .ch-btn:disabled { opacity:.4; cursor:default; transform:none; }
#collectors-hub .ch-btn.blurple { background:var(--blurple); border-color:var(--blurple); color:#fff; }
#collectors-hub .ch-btn.navy { background:var(--navy); border-color:var(--navy); color:#fff; }
#collectors-hub .ch-note { margin-top:11px; font-size:12px; line-height:1.5; padding:9px 11px; border-radius:8px; border:1px solid; }
#collectors-hub .ch-note.ok { color:#3a6b40; background:#f2f8ef; border-color:#cfe3c9; }
#collectors-hub .ch-note.info { color:#3a44a0; background:#f1f2fe; border-color:#d3d7fb; }
#collectors-hub .ch-note.err { color:#9a3b3b; background:#fdf1f1; border-color:#f2d3d3; }
#collectors-hub .ch-legal { display:flex; gap:14px; margin-top:13px; font-size:11px; }
#collectors-hub .ch-legal a { color:var(--label); text-decoration:none; border-bottom:1px solid var(--hair-2); }
#collectors-hub .ch-legal a:hover { color:var(--ink); }

#collectors-hub .ch-gal { display:grid; grid-template-columns:210px 1fr; border:1px solid var(--hair-2); border-radius:12px; overflow:hidden; min-height:460px; }
@media (max-width:720px){ #collectors-hub .ch-gal{ grid-template-columns:1fr; } #collectors-hub .ch-rail{ display:none; } }
#collectors-hub .ch-rail { border-right:1px solid var(--hair); background:var(--chrome-2); overflow-y:auto; max-height:560px; padding:10px; }
#collectors-hub .ch-railempty { padding:18px 12px; font-size:12px; color:var(--label); line-height:1.5; }
#collectors-hub .ch-thumb { display:block; width:100%; border:1px solid transparent; border-radius:9px; padding:7px; margin-bottom:6px; cursor:pointer; background:none; text-align:left; transition:background .15s; }
#collectors-hub .ch-thumb:hover { background:#fff; }
#collectors-hub .ch-thumb[aria-current="true"] { background:#fff; border-color:var(--ink); box-shadow:0 2px 8px -4px rgba(0,0,0,.3); }
#collectors-hub .ch-thumbimg { display:block; width:100%; aspect-ratio:1; border-radius:6px; background:#dedad0 center/cover no-repeat; }
#collectors-hub .ch-tt { display:block; font-size:11px; color:var(--ink-2); margin-top:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

#collectors-hub .ch-viewer { display:flex; flex-direction:column; background:var(--bg); }
#collectors-hub .ch-stage { flex:1; display:grid; place-items:center; padding:26px; background:linear-gradient(#fff,#fbfbfa); }
#collectors-hub .ch-art { width:100%; max-width:420px; aspect-ratio:1; border-radius:8px; border:1px solid var(--hair-2); background:#f0efec center/contain no-repeat; box-shadow:0 18px 40px -22px rgba(0,0,0,.4); }
#collectors-hub .ch-stageempty { text-align:center; color:var(--label); }
#collectors-hub .ch-big { font-size:22px; font-weight:700; color:var(--ink); margin-bottom:6px; }
#collectors-hub .ch-meta { display:grid; grid-template-columns:repeat(4,1fr); border-top:1px solid var(--hair); }
#collectors-hub .ch-cell { padding:16px 18px; text-align:center; border-right:1px solid var(--hair); }
#collectors-hub .ch-cell:last-child { border-right:none; }
#collectors-hub .ch-cl { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--label); }
#collectors-hub .ch-cv { font-size:14px; font-weight:500; margin-top:6px; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
#collectors-hub .ch-cv.acid { color:var(--olive); font-family:ui-monospace,Menlo,monospace; font-weight:700; }
#collectors-hub .ch-viewbtn { display:flex; align-items:center; justify-content:center; gap:9px; padding:15px; background:var(--navy); color:#fff; font-weight:600; font-size:13.5px; cursor:pointer; text-decoration:none; }
#collectors-hub .ch-viewbtn:hover { background:var(--navy-2); }
#collectors-hub .ch-viewbtn.disabled { opacity:.45; cursor:default; }

#collectors-hub .ch-prov { display:grid; grid-template-columns:1.1fr .9fr; gap:22px; }
@media (max-width:900px){ #collectors-hub .ch-prov{ grid-template-columns:1fr; } }
#collectors-hub .ch-h2 { margin:0 0 6px; font-size:clamp(24px,3.6vw,34px); font-weight:700; letter-spacing:-.03em; }
#collectors-hub .ch-provlede { margin:0 0 18px; color:var(--ink-2); font-size:14.5px; line-height:1.6; max-width:52ch; }
#collectors-hub .ch-provlede em { color:var(--olive); font-style:normal; font-weight:600; }
#collectors-hub .ch-formula { font-family:ui-monospace,Menlo,monospace; font-size:12.5px; background:var(--navy-2); color:#e9ecdd; padding:15px 18px; border-radius:11px; line-height:1.75; overflow-x:auto; margin:0; white-space:pre; }
#collectors-hub .ch-provcard { border:1px solid var(--hair-2); border-radius:12px; padding:17px; }
#collectors-hub .ch-provcard h4 { margin:0 0 11px; font-size:11px; font-family:ui-monospace,Menlo,monospace; letter-spacing:.12em; text-transform:uppercase; color:var(--label); }
#collectors-hub .ch-wrow { display:grid; grid-template-columns:1fr auto auto; gap:12px; align-items:center; padding:9px 0; border-bottom:1px solid var(--hair); font-size:13px; }
#collectors-hub .ch-wrow:last-of-type { border-bottom:none; }
#collectors-hub .ch-wkind { font-family:ui-monospace,Menlo,monospace; font-size:8.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--label); }
#collectors-hub .ch-w { font-family:ui-monospace,Menlo,monospace; font-weight:700; color:var(--olive); font-variant-numeric:tabular-nums; }
#collectors-hub .ch-bonus .ch-b { display:grid; grid-template-columns:1fr auto; gap:10px; padding:8px 0; border-bottom:1px solid var(--hair); font-size:13px; }
#collectors-hub .ch-bonus .ch-b:last-child { border-bottom:none; }
#collectors-hub .ch-d { font-family:ui-monospace,Menlo,monospace; font-size:11px; color:var(--label); }
#collectors-hub .ch-bv { font-family:ui-monospace,Menlo,monospace; color:var(--ink); font-variant-numeric:tabular-nums; }

#collectors-hub .ch-ranks .ch-h2 { margin-bottom:16px; }
#collectors-hub .ch-lb { border:1px solid var(--hair-2); border-radius:12px; overflow:hidden; }
#collectors-hub .ch-lbhead, #collectors-hub .ch-lbrow { display:grid; grid-template-columns:52px 1fr 130px 110px; align-items:center; }
#collectors-hub .ch-lbhead { background:var(--chrome); border-bottom:1px solid var(--hair); font-family:ui-monospace,Menlo,monospace; font-size:9.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--label); }
#collectors-hub .ch-lbhead > div, #collectors-hub .ch-lbrow > div { padding:12px 16px; }
#collectors-hub .ch-lbhead .rt { text-align:right; }
#collectors-hub .ch-lbrow { border-bottom:1px solid var(--hair); font-size:14px; }
#collectors-hub .ch-lbrow:last-child { border-bottom:none; }
#collectors-hub .ch-rankn { font-weight:700; font-variant-numeric:tabular-nums; }
#collectors-hub .ch-wal { font-family:ui-monospace,Menlo,monospace; font-size:12.5px; color:var(--ink-2); }
#collectors-hub .ch-sc { text-align:right; font-family:ui-monospace,Menlo,monospace; font-weight:700; font-variant-numeric:tabular-nums; }
#collectors-hub .ch-tier { text-align:right; font-family:ui-monospace,Menlo,monospace; font-size:10.5px; text-transform:uppercase; letter-spacing:.06em; color:var(--label); }
#collectors-hub .ch-lbempty { padding:20px 16px; font-size:13px; color:var(--label); }

@media (prefers-reduced-motion:reduce){ #collectors-hub * { transition-duration:.001ms !important; } }
`;

export default function CollectorsHubWindow({ title, onClose, onClick, zIndex }: CollectorsHubWindowProps) {
  const [wallet, setWallet] = useState('');
  const [session, setSession] = useState<CollectorSession | null>(null);
  const [discordConnection, setDiscordConnection] = useState<DiscordConnection | null>(null);
  const [discordResult, setDiscordResult] = useState<DiscordResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'signing' | 'verified' | 'discord_connected' | 'assigning' | 'discord'>('idle');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<HubTab>('verify');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [dashboard, setDashboard] = useState<CollectorDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

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

  const [selectedArtKey, setSelectedArtKey] = useState<string | null>(null);
  const [displayScore, setDisplayScore] = useState(0);

  const artworks = dashboard?.holdings.assets.artworks || [];

  useEffect(() => {
    const arts = dashboard?.holdings.assets.artworks || [];
    setSelectedArtKey(arts.length ? `${arts[0].collectionSlug}-${arts[0].tokenId}` : null);
  }, [dashboard]);

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

  const CHAIN_BY_SLUG: Record<string, string> = {
    'kingtut-genesis': 'Ethereum',
    'abstractions': 'Abstract',
    'obsessive-cycles-of-fiber': 'Ethereum',
    'breadio': 'MegaETH',
    'tut-loudio': 'Ethereum',
    'tut-editions': 'Ethereum',
  };
  const TUT_WEIGHTS: Array<[string, string, number]> = [
    ['Tut Genesis', 'Genesis', 25000],
    ['Abstractions', 'Series', 5000],
    ['OCF', '1/1', 1000],
    ['Breadio', 'MegaETH', 500],
    ['Tut Loudio', 'Edition', 100],
    ['tut™ Editions', 'Edition', 50],
  ];

  const connectedCollections = dashboard?.holdings.collections.filter((c) => c.count > 0) || [];
  const signedIn = !!session;
  const rank = session?.rank || dashboard?.rank || 'Unscored';
  const selectedArt = artworks.find((a) => `${a.collectionSlug}-${a.tokenId}` === selectedArtKey) || artworks[0] || null;

  const TIER_STOPS = [1, 5000, 25000, 100000];
  const TIER_NAMES = ['Holder', 'Collector', 'Whale', 'Legend'];
  const tierIdx = TIER_STOPS.reduce((acc, min, i) => (targetScore >= min ? i : acc), -1);
  const segLo = TIER_STOPS[Math.max(tierIdx, 0)];
  const segHi = TIER_STOPS[Math.min(Math.max(tierIdx, 0) + 1, 3)];
  const within = tierIdx >= 3 ? 1 : Math.max(0, (targetScore - segLo) / (segHi - segLo));
  const fillPct = tierIdx < 0 ? 0 : Math.min(100, ((tierIdx + Math.min(within, 1)) / 3) * 100);
  const toNext =
    tierIdx < 0
      ? ''
      : tierIdx >= 3
        ? 'Legend — top of the ladder'
        : `${(TIER_STOPS[tierIdx + 1] - targetScore).toLocaleString()} to ${TIER_NAMES[tierIdx + 1]}`;

  const walletActionLabel =
    status === 'connecting'
      ? 'Connecting…'
      : status === 'signing'
        ? 'Check wallet…'
        : signedIn
          ? 'Refresh wallet'
          : 'Sign in with wallet';

  const steps: Array<[string, string, boolean]> = [
    ['01', 'Wallet', !!wallet || signedIn],
    ['02', 'Score', signedIn],
    ['03', 'Discord', !!discordConnection || !!discordResult?.ok],
    ['04', 'Role', !!discordResult?.ok],
  ];

  const tabs: Array<[HubTab, string, string]> = [
    ['verify', 'Passport', ''],
    ['holdings', 'Gallery', artworks.length ? String(artworks.length) : ''],
    ['guide', 'Scoring', ''],
    ['leaderboard', 'Ranks', ''],
  ];

  return (
    <div id="collectors-hub" style={{ zIndex }} onClick={onClick}>
      <style>{HUB_CSS}</style>

      <div className="ch-titlebar">
        <span className="ch-ttl">{title}</span>
        <button className="ch-close window-controls" onClick={onClose} aria-label="Close" />
      </div>

      <div className="ch-scroll">
        <div className="ch-masthead">
          <div>
            <div className="ch-kicker">Collectors Hub</div>
            <h1 className="ch-h1">Collector Score<span className="ch-tm">™</span></h1>
            <p className="ch-lead">
              Sign with the wallet that holds your tut™ work. We read your holdings on-chain and issue a living record — score, owned art, and Discord standing.
            </p>
          </div>
          <button
            className="ch-connect"
            onClick={connectAndVerify}
            disabled={status === 'connecting' || status === 'signing'}
          >
            {walletActionLabel}
          </button>
        </div>

        <div className="ch-tabs" role="tablist">
          {tabs.map(([key, label, count]) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              className="ch-tab"
              onClick={() => setActiveTab(key)}
            >
              {label}
              {count && <span className="ch-tabcount">{count}</span>}
            </button>
          ))}
        </div>

        <div className="ch-panels">
          {/* -------- PASSPORT -------- */}
          {activeTab === 'verify' && (
            <div className="ch-passport">
              <div>
                <div className={`ch-readout${signedIn ? '' : ' is-locked'}`}>
                  <div className="ch-reveal">
                    <div className="ch-rhead">
                      <div className="ch-rk">Collector Passport</div>
                      <div className="ch-serial">
                        {wallet ? shortWallet(wallet) : '—'}
                        <br />NET · ETH / ABS / MEGA
                      </div>
                    </div>
                    <div className="ch-scorelabel">Collector Score</div>
                    <div className="ch-score">{(signedIn ? displayScore : 0).toLocaleString()}</div>
                    <div className="ch-rankrow">
                      <span className="ch-rankbadge"><span className="ch-seal" />{rank}</span>
                      <span className="ch-walletchip">{wallet ? shortWallet(wallet) : '—'}</span>
                    </div>
                    <div className="ch-ladder">
                      <div className="ch-track"><div className="ch-fill" style={{ width: `${fillPct}%` }} /></div>
                      <div className="ch-marks">
                        {TIER_NAMES.map((name, i) => (
                          <div key={name} className={`ch-mark${tierIdx >= i ? ' hit' : ''}`}>
                            <span>{name}</span>
                            <b>{['1+', '5K', '25K', '100K'][i]}</b>
                          </div>
                        ))}
                      </div>
                      {toNext && <div className="ch-tonext">{toNext}</div>}
                    </div>
                  </div>
                  <div className="ch-veil">
                    <div>
                      <div className="ch-lk">Sealed</div>
                      <div className="ch-lh">Sign in to open your record</div>
                      <div className="ch-ls">a signature — never a transaction</div>
                    </div>
                  </div>
                </div>

                <div className="ch-trio">
                  <div className="ch-stat"><div className="ch-k">Assets</div><div className="ch-v">{dashboard?.breakdown.assetCount ?? 0}</div></div>
                  <div className="ch-stat"><div className="ch-k">Collections</div><div className="ch-v">{connectedCollections.length}</div></div>
                  <div className="ch-stat"><div className="ch-k">1 / 1s</div><div className="ch-v">{dashboard?.breakdown.oneOfOneCount ?? 0}</div></div>
                </div>
              </div>

              <div className="ch-side">
                <div className="ch-block">
                  <h3>Ledger <span className="ch-sub">count × weight</span></h3>
                  <div className="ch-ledger">
                    {(dashboard?.holdings.collections || []).map((c) => {
                      const has = c.count > 0;
                      return (
                        <div key={c.slug} className={`ch-lrow${has ? '' : ' zero'}`}>
                          <span className="ch-name"><span className="ch-swatch" style={{ background: SWATCH[c.slug] || '#c9c9cf' }} />{c.name}<span className="ch-kind">{c.kind}</span></span>
                          <span className="ch-math">
                            {signedIn
                              ? has
                                ? `${c.count} × ${c.weight.toLocaleString()} = ${c.score.toLocaleString()}`
                                : `${c.weight.toLocaleString()} each`
                              : '— — —'}
                          </span>
                        </div>
                      );
                    })}
                    {(dashboard?.holdings.collections || []).length === 0 && (
                      <>
                        {TUT_WEIGHTS.map(([name, kind, weight]) => (
                          <div key={name} className="ch-lrow zero">
                            <span className="ch-name"><span className="ch-swatch" style={{ background: '#c9c9cf' }} />{name}<span className="ch-kind">{kind}</span></span>
                            <span className="ch-math">— — —</span>
                          </div>
                        ))}
                      </>
                    )}
                    {dashboard ? (
                      <>
                        <div className="ch-sum"><span className="ch-lbl">Weighted base</span><span className="ch-val">{dashboard.breakdown.base.toLocaleString()}</span></div>
                        <div className="ch-sum"><span className="ch-lbl">Breadth bonus</span><span className="ch-val">+{dashboard.breakdown.breadthBonus.toLocaleString()}</span></div>
                        <div className="ch-sum"><span className="ch-lbl">Depth bonus</span><span className="ch-val">+{dashboard.breakdown.depthBonus.toLocaleString()}</span></div>
                        <div className="ch-sum total"><span className="ch-lbl">Collector Score</span><span className="ch-val">{dashboard.breakdown.calculatedScore.toLocaleString()}</span></div>
                      </>
                    ) : (
                      <div className="ch-sum total"><span className="ch-lbl">Collector Score</span><span className="ch-val">— — —</span></div>
                    )}
                  </div>
                </div>

                <div className="ch-block">
                  <h3>Verification</h3>
                  <div className="ch-steps">
                    {steps.map(([n, t, done]) => (
                      <div key={t} className={`ch-step${done ? ' done' : ''}`}>
                        <div className="ch-n">{n}</div>
                        <div className="ch-t">{t}{done ? ' ✓' : ''}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ch-block">
                  <h3>Discord role <span className="ch-sub">claim your standing</span></h3>
                  <div className="ch-disc">
                    <button
                      className="ch-btn blurple"
                      onClick={linkDiscord}
                      disabled={!session || status === 'discord' || status === 'assigning'}
                    >
                      {discordConnection ? 'Connected' : 'Connect Discord'}
                    </button>
                    <button
                      className="ch-btn navy"
                      onClick={signAndAssignRole}
                      disabled={!discordConnection || status === 'assigning' || status === 'discord'}
                    >
                      {status === 'assigning' ? 'Assigning…' : status === 'discord' ? 'Assigned' : 'Sign role'}
                    </button>
                  </div>
                  {discordResult?.ok && <div className="ch-note ok">Discord verified. Your collector role is live.</div>}
                  {discordConnection && !discordResult?.ok && (
                    <div className="ch-note info">Connected as {discordConnection.discordUsername}. Sign once to assign your role.</div>
                  )}
                  {error && <div className="ch-note err">{error}</div>}
                  <div className="ch-legal">
                    <a href="/security" target="_blank" rel="noreferrer">Security</a>
                    <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a>
                    <a href="/terms" target="_blank" rel="noreferrer">Terms</a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* -------- GALLERY -------- */}
          {activeTab === 'holdings' && (
            <div className="ch-gal">
              <div className="ch-rail">
                {!dashboard && !dashboardLoading && <div className="ch-railempty">Sign in on the Passport tab to load your owned tut™ works.</div>}
                {dashboardLoading && !dashboard && <div className="ch-railempty">Loading holdings…</div>}
                {dashboard && artworks.length === 0 && <div className="ch-railempty">No owned tut™ art returned for this wallet.</div>}
                {artworks.map((art) => {
                  const key = `${art.collectionSlug}-${art.tokenId}`;
                  return (
                    <button
                      key={key}
                      className="ch-thumb"
                      aria-current={selectedArtKey === key}
                      onClick={() => setSelectedArtKey(key)}
                    >
                      <span className="ch-thumbimg" style={art.image ? { backgroundImage: `url(${art.image})` } : undefined} />
                      <span className="ch-tt">{art.title}</span>
                    </button>
                  );
                })}
              </div>
              <div className="ch-viewer">
                <div className="ch-stage">
                  {selectedArt ? (
                    <div className="ch-art" style={selectedArt.image ? { backgroundImage: `url(${selectedArt.image})` } : undefined} />
                  ) : (
                    <div className="ch-stageempty">
                      <div className="ch-big">No wallet signed in</div>
                      <div>Verify on the Passport tab to reveal owned works</div>
                    </div>
                  )}
                </div>
                <div className="ch-meta">
                  <div className="ch-cell"><div className="ch-cl">Title</div><div className="ch-cv">{selectedArt?.title || '—'}</div></div>
                  <div className="ch-cell"><div className="ch-cl">Collection</div><div className="ch-cv">{selectedArt?.collection || '—'}</div></div>
                  <div className="ch-cell"><div className="ch-cl">Chain</div><div className="ch-cv">{selectedArt ? (CHAIN_BY_SLUG[selectedArt.collectionSlug] || 'Ethereum') : '—'}</div></div>
                  <div className="ch-cell"><div className="ch-cl">Score weight</div><div className="ch-cv acid">{selectedArt ? `+${selectedArt.weight.toLocaleString()}` : '—'}</div></div>
                </div>
                <a
                  className={`ch-viewbtn${selectedArt?.permalink ? '' : ' disabled'}`}
                  href={selectedArt?.permalink || undefined}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => { if (!selectedArt?.permalink) e.preventDefault(); }}
                >
                  ↗ View Original
                </a>
              </div>
            </div>
          )}

          {/* -------- SCORING -------- */}
          {activeTab === 'guide' && (
            <div className="ch-prov">
              <div>
                <h2 className="ch-h2">How the score is drawn</h2>
                <p className="ch-provlede">
                  Every point traces to a tut™ asset you hold on-chain — <em>no snapshots, no off-chain trust</em>. Weighted holdings form the base; collecting across the catalogue and holding in depth add bonuses.
                </p>
                <pre className="ch-formula">
{`score = Σ ( count × weight )      // base
      + n² × 250                // breadth, n = collections
      + depth milestones        // 3·5·10·25 assets`}
                </pre>
                <div className="ch-provcard" style={{ marginTop: 18 }}>
                  <h4>Depth milestones — cumulative</h4>
                  <div className="ch-bonus">
                    <div className="ch-b"><span className="ch-d">Hold ≥ 3 assets</span><span className="ch-bv">+500</span></div>
                    <div className="ch-b"><span className="ch-d">Hold ≥ 5 assets</span><span className="ch-bv">+1,500</span></div>
                    <div className="ch-b"><span className="ch-d">Hold ≥ 10 assets</span><span className="ch-bv">+5,000</span></div>
                    <div className="ch-b"><span className="ch-d">Hold ≥ 25 assets</span><span className="ch-bv">+15,000</span></div>
                  </div>
                </div>
              </div>
              <div className="ch-provcard">
                <h4>Collection weights</h4>
                {TUT_WEIGHTS.map(([name, kind, weight]) => (
                  <div key={name} className="ch-wrow"><span>{name}</span><span className="ch-wkind">{kind}</span><span className="ch-w">{weight.toLocaleString()}</span></div>
                ))}
                <h4 style={{ marginTop: 20 }}>Ranks</h4>
                <div className="ch-bonus">
                  <div className="ch-b"><span className="ch-d">Holder</span><span className="ch-bv">1 – 4,999</span></div>
                  <div className="ch-b"><span className="ch-d">Collector</span><span className="ch-bv">5,000 – 24,999</span></div>
                  <div className="ch-b"><span className="ch-d">Whale</span><span className="ch-bv">25,000 – 99,999</span></div>
                  <div className="ch-b"><span className="ch-d">Legend</span><span className="ch-bv">100,000 +</span></div>
                </div>
              </div>
            </div>
          )}

          {/* -------- RANKS -------- */}
          {activeTab === 'leaderboard' && (
            <div className="ch-ranks">
              <h2 className="ch-h2">Collector ranks</h2>
              <div className="ch-lb">
                <div className="ch-lbhead"><div>#</div><div>Wallet</div><div className="rt">Score</div><div className="rt">Tier</div></div>
                {leaderboardLoading && <div className="ch-lbempty">Checking leaderboard…</div>}
                {!leaderboardLoading && leaderboard.length === 0 && (
                  <div className="ch-lbempty">The public leaderboard isn’t indexed yet. Verify a wallet on the Passport tab for your live score.</div>
                )}
                {!leaderboardLoading && leaderboard.map((entry, i) => (
                  <div key={`${entry.wallet}-${i}`} className="ch-lbrow">
                    <div className="ch-rankn">{i + 1}</div>
                    <div className="ch-wal">{shortWallet(entry.wallet)}</div>
                    <div className="ch-sc">{entry.score.toLocaleString()}</div>
                    <div className="ch-tier">{entry.rank}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
