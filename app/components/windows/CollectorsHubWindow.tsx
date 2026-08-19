'use client';

import { useState, useEffect, useRef } from 'react';
import { useLoginWithAbstract } from '@abstract-foundation/agw-react';
import { useAccount, useSignMessage } from 'wagmi';
import AudioControls from '../audio/AudioControls';
import { cdnImg } from '../../lib/img';
import DesignPageWizard, { type WizardArt } from './DesignPageWizard';
import type { CollectorProfile } from '@/app/lib/collectorProfile';

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


type ScoreCollection = {
  slug: string;
  name: string;
  kind: string;
  chain: string;
  weight: number;
  count: number;
  score: number;
  artworks: OwnedArtwork[];
  logo?: string;
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

// "https://x.com/tuteth_" -> "x.com/tuteth_" for a compact social chip.
function socialLabel(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return url;
  }
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

// AGW login is a Privy cross-app POPUP. In-app browsers (Discord/X/Telegram/Instagram/Facebook
// webviews) block window.open, so the popup can't open and Privy throws "Failed to initialize
// request". Detect those up front and guide the user to a real browser instead of a raw error.
function isRestrictedBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /(Discord|Twitter|FBAN|FBAV|FB_IAB|Instagram|Telegram|Line\/|MicroMessenger|GSA\/|Snapchat|TikTok|Musical)/i.test(ua);
}

// In-app webviews (Discord/X/Telegram/etc.) can't open the Privy popup at all — send them to a real browser.
const ABSTRACT_INAPP_MSG =
  'Abstract sign-in opens a secure popup that in-app browsers (Discord, X, Telegram, Instagram) block. Open tut.house in Safari or Chrome, then add Abstract.';
// Desktop Chrome/Brave (and Brave Shields) block the popup by default — the fix is to allow it, not switch browsers.
const ABSTRACT_POPUP_MSG =
  'Your browser blocked the Abstract sign-in popup. Allow pop-ups for tut.house — click the blocked-popup icon in the address bar (Brave: also lower Shields) — then press Add Abstract again.';

// Turn Privy/popup failures into something actionable instead of "Failed to initialize request".
// A blocked popup in a normal browser means "allow pop-ups"; in an in-app webview it means "open a real browser".
function friendlyAbstractError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err || '');
  if (/reject|cancel|denied|closed by user/i.test(msg)) return 'Abstract sign-in was cancelled.';
  if (/initialize request|pop-?up|window|blocked|timeout|open/i.test(msg)) {
    return isRestrictedBrowser() ? ABSTRACT_INAPP_MSG : ABSTRACT_POPUP_MSG;
  }
  return msg || 'Could not add Abstract wallet.';
}

// Must match the server's parseLinkMessage (LINK_MESSAGE_PREFIX + Primary/Linked/Timestamp/Nonce).
function buildLinkMessage(primary: string, linked: string) {
  const nonce =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return [
    'Add wallet to tut.house collector',
    `Primary: ${primary.toLowerCase()}`,
    `Linked: ${linked.toLowerCase()}`,
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

// Pretty chain names for the badge hover card.
const CHAIN_LABEL: Record<string, string> = { ethereum: 'Ethereum', abstract: 'Abstract', megaeth: 'MegaETH' };

// Collection accent (badge tint + gallery swatch), keyed by collection slug.
const SWATCH: Record<string, string> = {
  'kingtut-genesis': '#cbf000',
  'abstractions': '#c58aa8',
  'obsessive-cycles-of-fiber': '#e0b23a',
  'breadio': '#c86a4a',
  'tut-loudio': '#4a6f9c',
  'tut-editions': '#6f8a4a',
  'tut-tee': '#5ac57a',
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
  position:fixed; top:0; left:0; right:0; bottom:48px; overflow:hidden;
  padding:0; color:var(--ink);
  font-family:var(--sans); -webkit-font-smoothing:antialiased;
  background:#c3b8cb url(/assets/images/hubClouds.jpg) center/cover fixed no-repeat;
}
/* pink gradient layered ABOVE the clouds for the dusk effect */
#collectors-hub::before { content:""; position:fixed; top:0; left:0; right:0; bottom:48px; background:url(/assets/images/hubPink.jpg) center/cover no-repeat; opacity:.6; mix-blend-mode:multiply; pointer-events:none; z-index:0; }
/* the whole Hub, framed as one window on the dusk desktop */
#collectors-hub .ch-frame { position:absolute; top:16px; left:16px; right:16px; bottom:16px; z-index:1; display:flex; flex-direction:column; border:3px solid #000; border-radius:14px; box-shadow:5px 6px 0 0 rgba(20,16,30,.26), 0 20px 40px -14px rgba(30,20,45,.5); overflow:hidden; }
#collectors-hub .ch-titlebar { flex:none; display:flex; align-items:center; gap:12px; padding:11px 18px; border-bottom:3px solid #000; background:#fff; }
#collectors-hub .ch-wm-sm { width:44px; height:20px; background:url(/assets/images/tutLogo.png) left center/contain no-repeat; filter:brightness(0); flex:none; }
#collectors-hub .ch-winttl { font:700 14.5px/1 var(--mono); letter-spacing:.12em; text-transform:uppercase; color:#161616; }
#collectors-hub .ch-winctl { margin-left:auto; display:flex; align-items:center; gap:8px; }
#collectors-hub .ch-chip { width:32px; height:32px; border:2.5px solid #000; border-radius:8px; background:#fff; box-shadow:2px 2px 0 0 rgba(20,16,30,.24); font:700 13px/1 var(--mono); display:grid; place-items:center; color:#000; cursor:pointer; padding:0; }
#collectors-hub .ch-chip:hover { filter:brightness(.94); }
#collectors-hub .ch-framebody { flex:1; overflow-y:auto; padding:24px 28px 44px; }
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
/* metallic bars: silver (with a light shine) for Esteemed Works, gold for the Gallery */
#collectors-hub .w-silver .bar { background:linear-gradient(135deg,#dfe2e7 0%,#fbfcfd 27%,#c4c9d2 55%,#eceef2 78%,#d3d7de 100%); }
#collectors-hub .w-goldm .bar { background:linear-gradient(135deg,#d6a02c 0%,#f8dc7e 32%,#c69120 58%,#efc65a 80%,#d9a838 100%); }

#collectors-hub .desk { display:grid; grid-template-columns:352px 1fr; gap:22px; align-items:stretch; max-width:1180px; margin:0 auto; }
#collectors-hub .col-left { display:flex; flex-direction:column; gap:16px; }
/* Family Member + Status + Gold Stars + Badges — stacked like overlapping windows:
   each keeps its own border + rounded top corners and tucks under the one above,
   with a seam shadow so it reads as layered panes. */
#collectors-hub .stack { display:flex; flex-direction:column; }
/* Each panel: rounded TOP, straight bottom. The next panel down tucks up by >= the corner
   radius so it buries the square bottom corners of the panel above — that overlap is what
   makes the flat bottom read as "hidden under" the next window. */
#collectors-hub .stack > .win { border:3px solid #000; border-radius:10px 10px 0 0; box-shadow:var(--shadow), 0 -8px 16px -6px rgba(20,16,30,.5); }
#collectors-hub .stack > .win:first-child { box-shadow:var(--shadow); }
#collectors-hub .stack > .win:not(:first-child) { margin-top:-10px; }
/* the stack's outer bottom edge (last panel) gets rounded corners for a finished edge */
#collectors-hub .stack > .win:last-child { border-radius:10px 10px 12px 12px; }
#collectors-hub .stack > .win .bar { border-bottom:none; }
/* a bar that sits above a body (Family Member, Badges) keeps its divider; bar-only
   windows (Status, Gold Stars) don't */
#collectors-hub .stack > .win .bar:not(:only-child) { border-bottom:3px solid #000; }
#collectors-hub .col-right { min-width:0; display:flex; flex-direction:column; }
#collectors-hub .col-right > .win { flex:1; display:flex; flex-direction:column; }
#collectors-hub .full { grid-column:1 / -1; }
#collectors-hub .trio { display:grid; grid-template-columns:1.05fr 1.2fr 1fr; gap:22px; }
@media (max-width:880px){ #collectors-hub .desk { grid-template-columns:1fr; } #collectors-hub .trio { grid-template-columns:1fr; } }

/* FAMILY MEMBER */
#collectors-hub .fm-body { display:flex; flex-direction:column; align-items:flex-start; gap:12px; padding:16px 16px 18px; }
#collectors-hub .fm-pfp { position:relative; width:140px; height:140px; border-radius:20px; overflow:hidden; box-shadow:0 8px 20px -8px rgba(0,0,0,.42); }
#collectors-hub .ch-avatar { width:140px; height:140px; aspect-ratio:auto; border-radius:20px; background-size:cover; background-position:center; }
#collectors-hub .fm-pfp .ch-avatar { border-radius:0; }
#collectors-hub .ch-avatar.empty { background:transparent; box-shadow:none; border:2px dashed #cdcdcd; }
#collectors-hub .ch-avatar.loading { background:#ece9e4; animation:ch-pulse 1s ease-in-out infinite; }
@keyframes ch-pulse { 0%,100%{opacity:.65} 50%{opacity:.95} }
/* Edit / Sign out reveal on hovering the pfp */
#collectors-hub .fm-hover { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; background:rgba(20,16,30,.74); opacity:0; transition:opacity .15s; }
#collectors-hub .fm-pfp:hover .fm-hover { opacity:1; }
#collectors-hub .fm-hbtn { width:82%; border:2px solid #fff; border-radius:8px; background:#fff; color:#161616; font:700 10.5px/1 var(--sans); letter-spacing:.04em; text-transform:uppercase; padding:8px 10px; cursor:pointer; }
#collectors-hub .fm-hbtn.ghost { background:transparent; color:#fff; }
#collectors-hub .fm-hbtn:hover { filter:brightness(.92); }
#collectors-hub .fm-name { font:700 34px/1 var(--mono); letter-spacing:.01em; color:#161616; text-align:left; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
/* X + Discord as pills: colored logo box + the connected handle (truncated) */
#collectors-hub .fm-links { display:flex; flex-wrap:wrap; gap:10px; max-width:100%; }
#collectors-hub .fm-link { display:inline-flex; align-items:center; height:46px; border:2.5px solid #000; border-radius:12px; cursor:pointer; box-shadow:2px 2px 0 0 rgba(20,16,30,.24); padding:0; background:#fff; text-decoration:none; overflow:hidden; transition:filter .15s; }
#collectors-hub .fm-link .fm-ic { width:44px; height:44px; display:grid; place-items:center; flex:none; }
#collectors-hub .fm-link .fm-ic svg { width:22px; height:22px; }
#collectors-hub .fm-link.x .fm-ic svg { fill:#000; }
#collectors-hub .fm-link.disc .fm-ic { background:var(--blurple); }
#collectors-hub .fm-link.disc .fm-ic svg { fill:#fff; }
#collectors-hub .fm-link.disc.linked .fm-ic { background:#3a6b40; }
#collectors-hub .fm-link .fm-handle { padding:0 12px; font:700 12.5px/1 var(--mono); color:#161616; max-width:12ch; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
#collectors-hub .fm-link.unset { opacity:.35; box-shadow:none; cursor:default; }
#collectors-hub .fm-link:not(.unset):hover { filter:brightness(1.05); }
#collectors-hub .fm-err { font:600 10.5px/1.4 var(--sans); color:#9a3b3b; }
#collectors-hub .fm-signin { display:flex; flex-direction:column; align-items:center; gap:12px; }
#collectors-hub .fm-signin .sub { font:400 12.5px/1.5 var(--sans); color:var(--label); text-align:center; max-width:24ch; }
#collectors-hub .btn-navy { border:3px solid #000; border-radius:9px; background:var(--navy); color:#fff; font:600 13.5px/1 var(--sans); padding:12px 22px; cursor:pointer; box-shadow:3px 3px 0 0 rgba(20,16,30,.24); }
#collectors-hub .btn-navy:hover { background:#171d28; }
#collectors-hub .btn-navy:disabled { opacity:.6; cursor:default; }
/* Add-Abstract — icon-only pill (same size/style as .fm-link.disc), the official Abstract logo. */
#collectors-hub .fm-link.agw { background:#fff; }
#collectors-hub .fm-link.agw .fm-ic { padding:0; }
#collectors-hub .fm-link.agw .fm-ic img { width:100%; height:100%; object-fit:cover; display:block; }
#collectors-hub .fm-link.agw:disabled { cursor:default; }
#collectors-hub .fm-link.agw.loading { animation:agwPulse 1s ease-in-out infinite; }
@keyframes agwPulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
/* Add-EVM — link a second injected wallet (MetaMask/Rabby/hardware). */
#collectors-hub .fm-link.evm .fm-ic { background:#1c1830; }
#collectors-hub .fm-link.evm .fm-ic svg { fill:#fff; }
#collectors-hub .fm-link.evm.linked .fm-ic { background:#3a6b40; }
#collectors-hub .fm-link.evm:disabled { cursor:default; }
#collectors-hub .fm-link.evm.loading { animation:agwPulse 1s ease-in-out infinite; }
/* Linked-wallet chips — the full list of attached addresses, each removable. */
#collectors-hub .fm-linked-list { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; width:100%; }
#collectors-hub .fm-linked-chip { display:inline-flex; align-items:center; gap:6px; height:32px; padding:0 6px 0 10px; border:2px solid #000; border-radius:10px; background:#fff; box-shadow:2px 2px 0 0 rgba(20,16,30,.18); font:700 11.5px/1 var(--mono); color:#161616; }
#collectors-hub .fm-linked-chip .fm-x { display:grid; place-items:center; width:20px; height:20px; border:none; border-radius:6px; background:#eee; cursor:pointer; font:700 14px/1 var(--sans); color:#7a2020; }
#collectors-hub .fm-linked-chip .fm-x:hover { background:#e2b6b6; }
#collectors-hub .fm-linked-chip .fm-x:disabled { opacity:.4; cursor:default; }
/* Connect chips (Discord / Abstract) with a state caption underneath. */
#collectors-hub .fm-links { align-items:flex-start; }
#collectors-hub .fm-connect { display:flex; flex-direction:column; align-items:center; gap:5px; }
#collectors-hub .fm-cap { font:700 8.5px/1 var(--sans); letter-spacing:.06em; text-transform:uppercase; color:#9a9aa4; max-width:70px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:center; }
#collectors-hub .fm-cap.on { color:#2aa862; }
#collectors-hub .fm-link.x:disabled { opacity:.35; cursor:default; box-shadow:none; }
#collectors-hub .fm-cap.pending { color:#c98a1e; }
#collectors-hub .fm-social { font:600 11.5px/1 var(--mono); color:var(--navy); text-decoration:none; border-bottom:1.5px solid rgba(29,37,50,.3); padding-bottom:1px; max-width:22ch; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
#collectors-hub .fm-social:hover { border-bottom-color:var(--navy); }
#collectors-hub .fm-edit { margin-top:6px; padding:9px 18px; font-size:12.5px; }
#collectors-hub .fm-signout { margin-top:2px; background:none; border:none; font:600 10.5px/1 var(--sans); letter-spacing:.04em; text-transform:uppercase; color:var(--label); cursor:pointer; padding:4px; }
#collectors-hub .fm-signout:hover { color:var(--ink); }

/* STATUS / GOLD STARS slim bars */
#collectors-hub .stars-num { font-variant-numeric:tabular-nums; }

/* BADGES */
#collectors-hub .badges { display:flex; flex-wrap:wrap; gap:13px; padding:16px 15px 18px; justify-content:space-between; }
#collectors-hub .ch-badge { width:70px; height:70px; border-radius:50%; position:relative; flex:none; border:2px solid rgba(0,0,0,.35); box-shadow:inset 0 2px 4px rgba(255,255,255,.65), inset 0 -4px 8px rgba(0,0,0,.4), 0 3px 6px rgba(0,0,0,.34); }
/* zoom the art past the circle so no source-image white edges show inside the badge */
#collectors-hub .ch-badge i { position:absolute; inset:4px; border-radius:50%; background-size:150%; background-position:center; border:1.5px solid rgba(0,0,0,.25); }
#collectors-hub .ch-badge .lock { position:absolute; inset:0; display:none; place-items:center; font-size:20px; }
#collectors-hub .ch-badge.locked { filter:grayscale(1) brightness(.92); opacity:.5; }
#collectors-hub .ch-badge.locked .lock { display:grid; }
/* Held-count pill — how many of this collection the collector holds. */
#collectors-hub .ch-badge .cnt { position:absolute; right:-4px; bottom:-4px; min-width:22px; height:22px; padding:0 6px; display:grid; place-items:center; border-radius:12px; border:2px solid #000; background:#161616; color:#fff; font:800 11.5px/1 var(--mono); box-shadow:0 1px 3px rgba(0,0,0,.4); }
/* Hover: badge grows and a name card reveals (approved mockup). Panel goes overflow-visible so
   neither the enlarged badge nor the card is clipped by the window edge. */
#collectors-hub .badges-win { overflow:visible; }
#collectors-hub .ch-badge { transition:transform .18s cubic-bezier(.2,.8,.3,1); transform-origin:center bottom; z-index:1; }
#collectors-hub .ch-badge:hover, #collectors-hub .ch-badge:focus-visible { transform:scale(1.5); z-index:30; outline:none; }
#collectors-hub .ch-badge.locked:hover, #collectors-hub .ch-badge.locked:focus-visible { opacity:.85; filter:grayscale(.4) brightness(.98); }
#collectors-hub .ch-badge:hover .cnt, #collectors-hub .ch-badge:focus-visible .cnt { transform:scale(.72); }
#collectors-hub .ch-badge .card { position:absolute; left:50%; bottom:calc(100% + 12px); transform:translate(-50%,6px); min-width:150px; max-width:200px; padding:9px 12px 10px; background:#fff; border:2.5px solid #000; border-radius:11px; box-shadow:4px 4px 0 0 rgba(20,16,30,.28); opacity:0; pointer-events:none; transition:opacity .16s ease, transform .16s ease; z-index:40; text-align:left; }
#collectors-hub .ch-badge .card .nm { font:800 13px/1.15 var(--mono); letter-spacing:.01em; color:#161616; }
#collectors-hub .ch-badge .card .meta { margin-top:3px; font:600 10.5px/1.2 var(--mono); letter-spacing:.06em; text-transform:uppercase; color:#7a7a7a; }
#collectors-hub .ch-badge .card .held { margin-top:6px; display:inline-flex; align-items:center; gap:5px; font:800 11px/1 var(--mono); color:#161616; }
#collectors-hub .ch-badge .card .held .k { width:8px; height:8px; border-radius:2px; border:1px solid #000; }
#collectors-hub .ch-badge .card::after { content:""; position:absolute; left:50%; top:100%; transform:translateX(-50%) rotate(45deg); margin-top:-7px; width:12px; height:12px; background:#fff; border-right:2.5px solid #000; border-bottom:2.5px solid #000; }
#collectors-hub .ch-badge:hover .card, #collectors-hub .ch-badge:focus-visible .card { opacity:1; transform:translate(-50%,0); }
@media (prefers-reduced-motion:reduce) { #collectors-hub .ch-badge, #collectors-hub .ch-badge .card, #collectors-hub .ch-badge .cnt { transition:none; } }

/* ESTEEMED WORKS */
#collectors-hub .esteem-body { flex:1; display:flex; flex-direction:column; padding:18px 22px 18px; background:linear-gradient(#fff,#fbfbfa); }
#collectors-hub .ch-mat { background:#fff; padding:20px; border-radius:4px; box-shadow:0 20px 44px -20px rgba(0,0,0,.45), 0 0 0 1px #eee; display:flex; align-items:center; justify-content:center; }
#collectors-hub .ch-art { width:100%; aspect-ratio:4/5; border-radius:2px; background-size:cover; background-position:center; background-color:#efeae2; }
/* Feature piece: the frame height is set by the left profile stack (grid stretch); the mat
   grows to fill it and the art uses background-size:contain, so ANY aspect ratio (square,
   2:3, landscape…) shows in full, centered, and never cropped. */
#collectors-hub .esteem-cap { flex:none; }
#collectors-hub .esteem-empty { margin:auto; }
#collectors-hub .col-right > .win .esteem-body .ch-mat { flex:1; min-height:0; }
#collectors-hub .ch-art.hero { width:100%; height:100%; aspect-ratio:auto; background-size:contain; background-repeat:no-repeat; background-position:center; background-color:transparent; }
#collectors-hub .esteem-cap { display:flex; justify-content:space-between; align-items:baseline; gap:12px; margin-top:14px; padding:0 2px; }
#collectors-hub .esteem-cap .ti { font:600 15px/1.25 var(--sans); color:#1a1a1a; }
#collectors-hub .esteem-cap .wt { font:700 12px/1 var(--mono); color:var(--olive); white-space:nowrap; }
#collectors-hub .esteem-empty { text-align:center; color:var(--label); font-size:13px; padding:40px 10px; }

/* GALLERY */
#collectors-hub .gallery { display:flex; gap:20px; padding:22px; overflow-x:auto; background:linear-gradient(#fff,#fcfcfb); }
#collectors-hub .gal-frame { flex:none; width:210px; text-decoration:none; }
#collectors-hub .gal-frame .ch-mat { padding:14px; }
#collectors-hub .gal-frame .cap { font:500 11.5px/1.3 var(--sans); color:#5a5a62; margin-top:9px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
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
@media (max-width:640px){
  #collectors-hub .ch-frame { top:8px; left:8px; right:8px; bottom:8px; border-radius:12px; }
  #collectors-hub .ch-titlebar { padding:9px 12px; gap:8px; }
  #collectors-hub .ch-winttl { font-size:12px; letter-spacing:.06em; }
  #collectors-hub .ch-winctl { gap:6px; }
  #collectors-hub .ch-winctl .ch-chip[aria-hidden="true"] { display:none; }
  #collectors-hub .ch-chip { width:30px; height:30px; }
  #collectors-hub .ch-framebody { padding:14px 12px 40px; overflow-x:hidden; }
  #collectors-hub .desk { gap:16px; }
  #collectors-hub .fm-name { font-size:26px; }
  #collectors-hub .fm-pfp, #collectors-hub .ch-avatar { width:120px; height:120px; }
  #collectors-hub .badges { gap:10px; padding:14px 12px; justify-content:flex-start; }
  #collectors-hub .ch-badge { width:58px; height:58px; }
  /* keep every inner grid within the viewport so nothing forces a sideways scroll */
  #collectors-hub .trio > *, #collectors-hub .pair > *, #collectors-hub .disc-btns > *, #collectors-hub .steps > *, #collectors-hub .wrow > *, #collectors-hub .lbrow > *, #collectors-hub .lbhead > * { min-width:0; }
  #collectors-hub .formula { font-size:10.5px; }
}
`;

export default function CollectorsHubWindow({ onClose, onClick, zIndex }: CollectorsHubWindowProps) {
  const [wallet, setWallet] = useState('');
  const [session, setSession] = useState<CollectorSession | null>(null);
  const [discordConnection, setDiscordConnection] = useState<DiscordConnection | null>(null);
  const [discordResult, setDiscordResult] = useState<DiscordResult | null>(null);
  const [discordLinked, setDiscordLinked] = useState(false);        // persisted (survives reloads)
  const [discordLinkedName, setDiscordLinkedName] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'signing' | 'verified' | 'discord_connected' | 'assigning' | 'discord'>('idle');
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState<CollectorDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [profile, setProfile] = useState<CollectorProfile | null>(null);
  const [profileStoreReady, setProfileStoreReady] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Abstract Global Wallet (AGW) sign-in — a smart-contract wallet via its own SDK, parallel to the
  // window.ethereum path. Its ERC-1271 signature is verified server-side by /api/collectors/session.
  const { login: agwLogin, logout: agwLogout } = useLoginWithAbstract();
  const { address: agwAddress, isConnected: agwConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [agwPending, setAgwPending] = useState(false);
  const [evmPending, setEvmPending] = useState(false);   // linking a second injected EVM wallet
  const [unlinking, setUnlinking] = useState('');        // address currently being removed
  const [linkedWallets, setLinkedWallets] = useState<string[]>([]);
  const agwFinishing = useRef(false);
  const discordAssigning = useRef(false);

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

  const loadProfile = async (selectedWallet: string) => {
    try {
      const res = await fetch(`/api/collectors/profile?wallet=${encodeURIComponent(selectedWallet)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { profile?: CollectorProfile | null; storeEnabled?: boolean };
      setProfileStoreReady(!!data.storeEnabled);
      if (data.profile) setProfile(data.profile);
    } catch {
      // Profile is optional chrome — a load failure never blocks the Hub.
    } finally {
      // Mark loaded so the avatar renders only once we know the real image (no fallback flash).
      setProfileLoaded(true);
    }
  };

  const loadLinked = async (primary: string) => {
    try {
      const res = await fetch(`/api/collectors/link?wallet=${encodeURIComponent(primary)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { linkedWallets?: string[] };
      setLinkedWallets(Array.isArray(data.linkedWallets) ? data.linkedWallets : []);
    } catch {
      // Linked wallets are additive chrome — a load failure never blocks the Hub.
    }
  };

  // Persisted Discord state so the card shows "connected" across reloads (not just in-session).
  const loadDiscordStatus = async (primary: string) => {
    try {
      const res = await fetch(`/api/discord/status?wallet=${encodeURIComponent(primary)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { connected?: boolean; discordUsername?: string | null };
      setDiscordLinked(!!data.connected);
      if (data.discordUsername) setDiscordLinkedName(data.discordUsername);
    } catch {
      // Non-blocking chrome.
    }
  };

  // Restore the signed-in view across reloads: we remember the verified wallet locally and
  // re-hydrate profile + score from public reads (no re-signing needed just to view).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('tut_collector_wallet');
    if (!stored || !/^0x[a-fA-F0-9]{40}$/.test(stored)) return;
    const w = stored.toLowerCase();
    setWallet(w);
    setSession({ wallet: w, score: 0, rank: 'Unscored', discordLink: '/api/discord/link' });
    void loadCollectorDashboard(w);
    void loadProfile(w);
    void loadLinked(w);
    void loadDiscordStatus(w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mobile / popup-blocked OAuth returns via a full-page redirect (no window.opener), so the
  // Discord code arrives on the URL instead of via postMessage. Pick it up so the auto-sign
  // effect can finish the role grant — otherwise the user lands "connected but no role, no link".
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('discord_code');
    const discordUserId = params.get('discord_uid');
    if (!code || !discordUserId) return;
    setDiscordConnection({
      type: 'tut_discord_connected',
      ok: true,
      code,
      discordUserId,
      discordUsername: params.get('discord_name') || '',
    });
    setStatus('discord_connected');
    // Scrub the one-time code from the URL so a refresh can't replay a spent token.
    ['discord_code', 'discord_uid', 'discord_name'].forEach((k) => params.delete(k));
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
  }, []);

  const signOut = () => {
    if (typeof window !== 'undefined') window.localStorage.removeItem('tut_collector_wallet');
    if (agwConnected) { try { agwLogout(); } catch { /* best-effort */ } }
    setAgwPending(false);
    setEvmPending(false);
    setUnlinking('');
    setLinkedWallets([]);
    setDiscordLinked(false);
    setDiscordLinkedName('');
    setSession(null);
    setWallet('');
    setDashboard(null);
    setProfile(null);
    setDiscordConnection(null);
    setDiscordResult(null);
    setStatus('idle');
    setError('');
  };

  // Verify the primary EVM wallet's signature with the backend, then hydrate the signed-in view.
  const submitProof = async (selected: string, message: string, signature: `0x${string}`) => {
    const res = await fetch('/api/collectors/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: selected, message, signature }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Could not verify collector score.');

    setSession(data);
    if (typeof window !== 'undefined') window.localStorage.setItem('tut_collector_wallet', selected);
    setStatus('verified');
    await loadCollectorDashboard(selected);
    void loadProfile(selected);
    void loadLinked(selected);
    void loadDiscordStatus(selected);
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

      await submitProof(selected, message, signature);
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Wallet verification failed.');
    }
  };

  // Once the AGW connects, sign a link message (bound to the signed-in primary) and attach it so its
  // Abstract holdings fold into the score. Guarded so it runs once per attempt (the effect below may
  // fire on the same state change a direct call already handled).
  const linkAgw = async (address: string) => {
    if (agwFinishing.current) return;
    agwFinishing.current = true;
    try {
      const primary = (session?.wallet || wallet).toLowerCase();
      const linked = address.toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(primary)) throw new Error('Sign in with your main wallet first, then add Abstract.');
      if (primary === linked) throw new Error('That Abstract wallet is already your primary wallet.');
      setStatus('signing');
      const message = buildLinkMessage(primary, linked);
      const signature = await signMessageAsync({ message });
      const res = await fetch('/api/collectors/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primary, linked, message, signature, chain: 'abstract' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not add Abstract wallet.');
      setLinkedWallets(Array.isArray(data.linkedWallets) ? data.linkedWallets : []);
      setStatus('verified');
      await loadCollectorDashboard(primary); // recompute combined EVM + Abstract score/holdings
    } catch (err) {
      setStatus(session ? 'verified' : 'idle');
      setError(friendlyAbstractError(err));
    } finally {
      setAgwPending(false);
      agwFinishing.current = false;
      try { if (agwConnected) agwLogout(); } catch { /* reset AGW connection for the next add */ }
    }
  };

  const addAbstract = async () => {
    if (!session) { setError('Sign in with your main wallet first, then add Abstract.'); return; }
    // In-app browsers can't open the Privy popup — tell the user before it fails with a raw error.
    if (isRestrictedBrowser()) { setError(ABSTRACT_INAPP_MSG); return; }
    setError('');
    setAgwPending(true);
    setStatus('connecting');
    try {
      if (agwConnected && agwAddress) {
        await linkAgw(agwAddress);
        return;
      }
      await agwLogin(); // opens the AGW modal; the effect below links once an address arrives
    } catch (err) {
      setAgwPending(false);
      setStatus(session ? 'verified' : 'idle');
      setError(friendlyAbstractError(err));
    }
  };

  // After agwLogin() connects, useAccount() surfaces the address on a later render — do the linking
  // here rather than racing the login() promise against the hook update.
  useEffect(() => {
    if (agwPending && agwConnected && agwAddress && !agwFinishing.current) {
      void linkAgw(agwAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agwPending, agwConnected, agwAddress]);

  // Link an additional injected EVM wallet (a second MetaMask/Rabby account, a hardware wallet, etc.)
  // so its holdings fold into the combined score. We open the wallet's account picker so the user can
  // pick a DIFFERENT account than the primary; that account signs the bind message, and the backend
  // verifies it (EOA ecrecover, or ERC-1271 for smart wallets) before attaching it.
  const addEvmWallet = async () => {
    if (!session) { setError('Sign in with your main wallet first, then add another wallet.'); return; }
    if (!window.ethereum) { setError('No EVM wallet found. Open this with MetaMask, Rabby, or another wallet.'); return; }
    const primary = (session.wallet || wallet).toLowerCase();
    setError('');
    setEvmPending(true);
    setStatus('connecting');
    try {
      // Force the account picker so the user can choose an account other than the primary.
      try {
        await window.ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
      } catch { /* not all wallets support this — fall back to eth_requestAccounts */ }
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const linked = (accounts?.[0] || '').toLowerCase();
      if (!linked) throw new Error('Wallet connection cancelled.');
      if (linked === primary) throw new Error('That’s already your primary wallet — switch to a different account in your wallet, then try again.');
      if (linkedWallets.includes(linked)) throw new Error('That wallet is already linked.');

      setStatus('signing');
      const message = buildLinkMessage(primary, linked);
      const signature = (await window.ethereum.request({
        method: 'personal_sign',
        params: [message, linked],
      })) as `0x${string}`;

      const res = await fetch('/api/collectors/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primary, linked, message, signature, chain: 'ethereum' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not link wallet.');
      setLinkedWallets(Array.isArray(data.linkedWallets) ? data.linkedWallets : []);
      setStatus('verified');
      await loadCollectorDashboard(primary); // recompute combined holdings/score across all wallets
    } catch (err) {
      setStatus(session ? 'verified' : 'idle');
      setError(err instanceof Error ? err.message : 'Could not link wallet.');
    } finally {
      setEvmPending(false);
    }
  };

  // Unlink a wallet (AGW or EVM). The PRIMARY wallet signs a standard collector proof to authorize it,
  // so removal can't be forged from the linked side. We surface the account picker so the user can
  // select the primary if their wallet is currently on a different account.
  const unlinkWallet = async (linked: string) => {
    if (!session) return;
    if (!window.ethereum) { setError('Connect your primary wallet to remove a linked wallet.'); return; }
    const primary = (session.wallet || wallet).toLowerCase();
    setError('');
    setUnlinking(linked);
    try {
      try {
        await window.ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
      } catch { /* fall back to eth_requestAccounts */ }
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const active = (accounts?.[0] || '').toLowerCase();
      if (active !== primary) throw new Error(`Switch to your primary wallet (${shortWallet(primary)}) to remove a linked wallet.`);

      const message = buildMessage(primary);
      const signature = (await window.ethereum.request({
        method: 'personal_sign',
        params: [message, primary],
      })) as `0x${string}`;

      const res = await fetch('/api/collectors/link', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primary, linked, message, signature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not unlink wallet.');
      setLinkedWallets(Array.isArray(data.linkedWallets) ? data.linkedWallets : []);
      await loadCollectorDashboard(primary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unlink wallet.');
    } finally {
      setUnlinking('');
    }
  };

  // A successful in-session Discord verify is now persisted server-side — reflect it as connected.
  useEffect(() => {
    if (discordResult?.ok) setDiscordLinked(true);
  }, [discordResult]);

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
    if (discordAssigning.current) return;
    discordAssigning.current = true;
    setError('');
    setStatus('assigning');

    try {
      if (!window.ethereum) throw new Error('No wallet found.');
      // Restored sessions have no live wallet connection — wake the provider before signing.
      try { await window.ethereum.request({ method: 'eth_requestAccounts' }); } catch { /* sign will surface real errors */ }
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
    } finally {
      discordAssigning.current = false;
    }
  };

  // Auto-sign the role assignment the instant the OAuth popup connects, so the two-step flow is
  // seamless and the short-lived Discord token can't expire in the gap. Manual click still works.
  useEffect(() => {
    if (discordConnection?.code && wallet && !discordResult?.ok && !discordAssigning.current) {
      void signAndAssignRole();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discordConnection, wallet]);

  const signedIn = !!session;
  const artworks = dashboard?.holdings.assets.artworks || [];
  const topArt = artworks.length ? [...artworks].sort((a, b) => b.weight - a.weight)[0] : null;
  // The collector's chosen feature piece + curated gallery win; otherwise fall back to the
  // auto picks (highest-scoring piece, and the full collection).
  const frameArt = profile?.frame || topArt;
  const galleryArt = profile?.gallery && profile.gallery.length ? profile.gallery : artworks;
  const displayName = profile?.username || shortWallet(wallet);
  const avatarImage = profile?.avatar?.image || '/assets/images/aboutProfilePicture.png';
  const xHandle = (() => {
    if (!profile?.socialUrl) return '';
    try { return new URL(profile.socialUrl).pathname.replace(/^\/+|\/+$/g, ''); } catch { return ''; }
  })();
  const discordHandle = discordConnection?.discordUsername || discordLinkedName || '';
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

  // Signed-out sign-in is EVM-only (AGW is an additive link shown only when signed in).
  const busy = status === 'connecting' || status === 'signing';
  const walletActionLabel =
    status === 'connecting' ? 'Connecting…' : status === 'signing' ? 'Check wallet…' : 'Sign in with wallet';

  const goldStars = signedIn ? displayScore.toLocaleString() : '—';

  // Discord affordance (now a single icon under the pfp, no full card).
  const discordDone = discordLinked || !!discordResult?.ok || status === 'discord';
  const discordAction = discordConnection ? signAndAssignRole : linkDiscord;
  const discordCap = discordDone
    ? 'Role active'
    : status === 'assigning'
      ? 'Signing…'
      : discordConnection
        ? 'Sign to assign role'
        : 'Connect Discord';
  // Short caption under the chip. The middle "sign to finish" state must be visible — Discord is a
  // two-step flow (authorize in the popup, then sign to assign the role, which is what persists).
  const discordPending = !discordDone && (status === 'assigning' || !!discordConnection);
  const discordCapShort = discordDone
    ? 'connected'
    : status === 'assigning'
      ? 'signing…'
      : discordConnection
        ? 'sign to finish'
        : 'connect now';

  return (
    <>
    <div id="collectors-hub" className={signedIn ? '' : 'sealed'} style={{ zIndex }} onClick={onClick}>
      <style>{HUB_CSS}</style>

      <div className="ch-frame">
        <div className="ch-titlebar">
          <span className="ch-wm-sm" aria-label="tut" />
          <span className="ch-winttl">Collectors Hub</span>
          <span className="ch-winctl">
            <AudioControls />
            <span className="ch-chip" aria-hidden="true">_</span>
            <button className="ch-chip window-controls" onClick={onClose} aria-label="Close">X</button>
          </span>
        </div>
        <div className="ch-framebody">

      <div className="desk">
        {/* ================= LEFT COLUMN ================= */}
        <div className="col-left">

          <div className="stack">
          {/* FAMILY MEMBER */}
          <div className="win w-lime">
            <div className="bar"><span className="t">Family Member</span><span className="ctl"><b>_</b><b>X</b></span></div>
            <div className="fm-body">
              {signedIn ? (
                <>
                  <div className="fm-pfp">
                    <div className={`ch-avatar${profileLoaded ? '' : ' loading'}`} style={profileLoaded ? { backgroundImage: `url(${cdnImg(avatarImage, 384)})` } : undefined} />
                    <div className="fm-hover">
                      {profileStoreReady && (
                        <button className="fm-hbtn" onClick={() => setWizardOpen(true)}>{profile ? 'Edit page' : 'Design page'}</button>
                      )}
                      <button className="fm-hbtn ghost" onClick={signOut}>Sign out</button>
                    </div>
                  </div>
                  <div className="fm-name">{displayName}</div>
                  <div className="fm-links">
                    <div className="fm-connect">
                      {profile?.socialUrl ? (
                        <a className="fm-link x" href={profile.socialUrl} target="_blank" rel="noopener noreferrer nofollow" title={socialLabel(profile.socialUrl)} aria-label={socialLabel(profile.socialUrl)}>
                          <span className="fm-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg></span>
                        </a>
                      ) : (
                        // Unset X isn't an OAuth connect — it's a link set on your page. Make the chip
                        // open the page editor so it's actionable, not a dead grey square.
                        <button className="fm-link x" onClick={() => setWizardOpen(true)} disabled={!profileStoreReady} title="Add your X — opens your page editor" aria-label="Add your X link">
                          <span className="fm-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg></span>
                        </button>
                      )}
                      <span className={`fm-cap${profile?.socialUrl ? ' on' : ''}`}>{profile?.socialUrl ? (xHandle || 'connected') : 'add X'}</span>
                    </div>
                    <div className="fm-connect">
                      <button
                        className={`fm-link disc${discordDone ? ' linked' : ''}`}
                        onClick={discordAction}
                        disabled={discordDone || status === 'assigning'}
                        title={discordCap}
                        aria-label={discordCap}
                      >
                        <span className="fm-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.445.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.371-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.245.198.372.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.955 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.419-2.157 2.419z" /></svg></span>
                      </button>
                      <span className={`fm-cap${discordDone ? ' on' : discordPending ? ' pending' : ''}`}>{discordCapShort}</span>
                    </div>
                    {/* Add AGW: link an Abstract Global Wallet so its Abstract-chain holdings fold into the score. */}
                    <div className="fm-connect">
                      <button
                        className={`fm-link agw${linkedWallets.length ? ' linked' : ''}${agwPending ? ' loading' : ''}`}
                        onClick={addAbstract}
                        disabled={agwPending}
                        title={linkedWallets.length ? `${linkedWallets.length} Abstract wallet${linkedWallets.length > 1 ? 's' : ''} added — add another` : 'Add your Abstract Global Wallet to include its assets'}
                        aria-label="Add Abstract wallet"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <span className="fm-ic"><img src="/assets/images/abstract-logo.png" alt="Abstract" /></span>
                      </button>
                      <span className={`fm-cap${linkedWallets.length ? ' on' : ''}`}>{agwPending ? 'connecting…' : linkedWallets.length ? 'connected' : 'connect now'}</span>
                    </div>
                    {/* Add EVM: link another injected wallet (a second account / hardware wallet) so its holdings fold in. */}
                    <div className="fm-connect">
                      <button
                        className={`fm-link evm${linkedWallets.length ? ' linked' : ''}${evmPending ? ' loading' : ''}`}
                        onClick={addEvmWallet}
                        disabled={evmPending}
                        title="Link another EVM wallet to include its assets"
                        aria-label="Add another EVM wallet"
                      >
                        <span className="fm-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H17a1 1 0 0 1 0 2H5.5a.5.5 0 0 0 0 1H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 14.5v-8Zm13 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" /></svg></span>
                      </button>
                      <span className={`fm-cap${evmPending ? ' pending' : ''}`}>{evmPending ? 'connecting…' : 'add wallet'}</span>
                    </div>
                  </div>
                  {linkedWallets.length > 0 && (
                    <div className="fm-linked-list">
                      {linkedWallets.map((lw) => (
                        <span className="fm-linked-chip" key={lw}>
                          {shortWallet(lw)}
                          <button
                            className="fm-x"
                            onClick={() => unlinkWallet(lw)}
                            disabled={unlinking === lw}
                            title="Unlink this wallet"
                            aria-label={`Unlink ${shortWallet(lw)}`}
                          >{unlinking === lw ? '…' : '×'}</button>
                        </span>
                      ))}
                    </div>
                  )}
                  {error && <div className="fm-err">{error}</div>}
                </>
              ) : (
                <div className="fm-signin">
                  <div className="ch-avatar empty" />
                  <div className="sub">Sign with the wallet that holds your tut™ work — a signature, never a transaction. Add an Abstract wallet after to include its assets.</div>
                  <button className="btn-navy" onClick={connectAndVerify} disabled={busy}>
                    {walletActionLabel}
                  </button>
                  {error && <div className="note err">{error}</div>}
                </div>
              )}
            </div>
          </div>

          {/* STATUS */}
          <div className="win w-pink">
            <div className="bar"><span className="t">Status — {statusLabel}</span><span className="ctl"><b>_</b><b>X</b></span></div>
          </div>

          {/* GOLD STARS */}
          <div className="win w-gold mute">
            <div className="bar"><span className="t">Gold Stars ⭐ — <span className="stars-num">{goldStars}</span></span><span className="ctl"><b>_</b><b>X</b></span></div>
          </div>

          {/* BADGES */}
          <div className="win w-gray mute badges-win">
            <div className="bar"><span className="t">Badges</span><span className="ctl"><b>_</b><b>X</b></span></div>
            <div className="badges">
              {(badgeCollections || []).map((c) => {
                const owned = c.count > 0;
                const img = c.artworks?.[0]?.image || c.logo;
                const tint = SWATCH[c.slug] || '#c9c9cf';
                const chainName = CHAIN_LABEL[c.chain] || c.chain;
                const meta = chainName && chainName.toLowerCase() !== c.kind.toLowerCase() ? `${c.kind} · ${chainName}` : c.kind;
                return (
                  <div key={c.slug} tabIndex={0} className={`ch-badge${owned ? '' : ' locked'}`} title={`${c.name}${owned ? ` · ×${c.count}` : ''}`}>
                    <i style={owned && img ? { backgroundImage: `url(${cdnImg(img, 128)})` } : { background: `radial-gradient(circle at 35% 30%, ${tint}, rgba(0,0,0,.5))` }} />
                    <span className="lock">🔒</span>
                    {owned && <b className="cnt">{c.count}</b>}
                    <div className="card">
                      <div className="nm">{c.name}</div>
                      <div className="meta">{owned ? meta : 'Not held yet'}</div>
                      {owned && <div className="held"><span className="k" style={{ background: tint }} />{c.count} held</div>}
                    </div>
                  </div>
                );
              })}
              {!badgeCollections &&
                Object.entries(SWATCH).map(([slug, tint]) => (
                  <div key={slug} className="ch-badge locked" title="Sign in to reveal">
                    <i style={{ background: `radial-gradient(circle at 35% 30%, ${tint}, rgba(0,0,0,.5))` }} />
                    <span className="lock">🔒</span>
                    <div className="card"><div className="nm">Sign in to reveal</div></div>
                  </div>
                ))}
            </div>
          </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN — ESTEEMED WORKS ================= */}
        <div className="col-right">
          <div className="win w-silver mute">
            <div className="bar"><span className="t">Esteemed Works</span><span className="ctl"><b>_</b><b>X</b></span></div>
            <div className="esteem-body">
              {frameArt ? (
                <>
                  <div className="ch-mat">
                    <div className="ch-art hero" style={frameArt.image ? { backgroundImage: `url(${cdnImg(frameArt.image, 640)})` } : undefined} />
                  </div>
                  <div className="esteem-cap"><span className="ti">{frameArt.title}</span></div>
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
          <div className="win w-goldm mute">
            <div className="bar"><span className="t">Gallery of Fine Art</span><span className="ctl"><b>_</b><b>X</b></span></div>
            {galleryArt.length ? (
              <div className="gallery">
                {galleryArt.map((a, i) => (
                  <a
                    key={`${a.collectionSlug}-${a.title}-${i}`}
                    className="gal-frame"
                    href={a.permalink || undefined}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => { if (!a.permalink) e.preventDefault(); }}
                  >
                    <div className="ch-mat"><div className="ch-art" style={a.image ? { backgroundImage: `url(${cdnImg(a.image, 384)})` } : undefined} /></div>
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

      </div>

      <div className="hub-footer">
        <a href="/security" target="_blank" rel="noreferrer">Security</a>
        <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a>
        <a href="/terms" target="_blank" rel="noreferrer">Terms</a>
      </div>

        </div>
      </div>
    </div>

    {wizardOpen && signedIn && (
      <DesignPageWizard
        wallet={wallet}
        artworks={artworks as WizardArt[]}
        existing={profile}
        onClose={() => setWizardOpen(false)}
        onSaved={(p) => { setProfile(p); setWizardOpen(false); }}
      />
    )}
    </>
  );
}
