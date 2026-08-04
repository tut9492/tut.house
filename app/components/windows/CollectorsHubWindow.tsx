'use client';

import { useState, useRef, useEffect } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

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

const DESKTOP_WINDOW_WIDTH = 1120;
const DESKTOP_WINDOW_HEIGHT = 720;
const DESKTOP_WINDOW_MARGIN = 16;

function clampWindowPosition(x: number, y: number) {
  if (typeof window === 'undefined') return { x, y };
  const maxX = Math.max(DESKTOP_WINDOW_MARGIN, window.innerWidth - DESKTOP_WINDOW_WIDTH - DESKTOP_WINDOW_MARGIN);
  const maxY = Math.max(DESKTOP_WINDOW_MARGIN, window.innerHeight - DESKTOP_WINDOW_HEIGHT - 80);
  return {
    x: Math.min(Math.max(DESKTOP_WINDOW_MARGIN, x), maxX),
    y: Math.min(Math.max(DESKTOP_WINDOW_MARGIN, y), maxY),
  };
}

export default function CollectorsHubWindow({ title, onClose, isActive, onClick, zIndex }: CollectorsHubWindowProps) {
  const isCompact = useIsMobile(1024);
  const [position, setPosition] = useState(() =>
    clampWindowPosition(
      Math.floor(Math.random() * Math.max(1, window.innerWidth - DESKTOP_WINDOW_WIDTH - DESKTOP_WINDOW_MARGIN * 2)) + DESKTOP_WINDOW_MARGIN,
      Math.floor(Math.random() * Math.max(1, window.innerHeight - DESKTOP_WINDOW_HEIGHT - 96)) + DESKTOP_WINDOW_MARGIN,
    ),
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
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
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-controls')) return;
    if (isCompact) return;

    onClick();
    setIsDragging(true);
    const rect = windowRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  useEffect(() => {
    if (isCompact) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition(clampWindowPosition(e.clientX - dragOffset.x, e.clientY - dragOffset.y));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, isCompact]);

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

  const connectedCollections = dashboard?.holdings.collections.filter((collection) => collection.count > 0) || [];
  const topArt = dashboard?.holdings.assets.artworks[0];
  const signedIn = !!session;
  const walletActionLabel =
    status === 'connecting'
      ? 'Connecting...'
      : status === 'signing'
        ? 'Check wallet...'
        : signedIn
          ? 'Refresh Wallet'
          : 'Sign In With Wallet';

  return (
    <div
      ref={windowRef}
      className={`${isCompact ? 'fixed' : 'absolute'} bg-white rounded-2xl shadow-2xl overflow-hidden transition-shadow ${
        isActive ? 'shadow-2xl' : 'opacity-95'
      }`}
      style={
        isCompact
          ? {
              top: '12px',
              left: '12px',
              right: '12px',
              bottom: '60px',
              zIndex,
            }
          : {
              top: position.y,
              left: position.x,
              width: `${DESKTOP_WINDOW_WIDTH}px`,
              maxWidth: `calc(100vw - ${DESKTOP_WINDOW_MARGIN * 2}px)`,
              height: `${DESKTOP_WINDOW_HEIGHT}px`,
              zIndex,
            }
      }
      onClick={onClick}
    >
      <button
        className="absolute top-4 right-4 w-3 h-3 bg-red-500 hover:bg-red-600 rounded-full z-10 window-controls"
        onClick={onClose}
      />

      <div
        className="px-6 py-4 cursor-move select-none"
        onMouseDown={handleMouseDown}
        style={{ borderBottom: '1px solid #F3F4F6' }}
      >
        <span className="text-gray-600 text-sm font-normal">{title}</span>
      </div>

      <div className="h-full bg-[#f7f2e8] overflow-auto">
        <div className="border-b-2 border-black bg-black px-6 py-5 text-white">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-[#d6c7a4]">Collectors Hub</div>
              <h2 className="mt-2 text-4xl md:text-6xl font-black leading-none">
                tut<span className="align-super text-[0.38em]">™</span> Collector Score
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-300">
                Sign in with the wallet that holds your tut™ work to see your score, owned art, and Discord role status.
              </p>
            </div>
            <button
              onClick={connectAndVerify}
              disabled={status === 'connecting' || status === 'signing'}
              className="border-2 border-white bg-white px-5 py-3 text-sm font-black uppercase text-black disabled:opacity-60"
            >
              {walletActionLabel}
            </button>
          </div>
        </div>

        <div className="px-6 pb-6">
        <div className="flex flex-wrap gap-2 pt-5 pb-2">
          {([
            ['verify', 'Dashboard'],
            ['holdings', 'Art'],
            ['guide', 'Scoring'],
          ] as Array<[HubTab, string]>).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-2 border-black px-4 py-2 text-xs font-bold uppercase ${
                activeTab === tab ? 'bg-black text-white' : 'bg-white text-black'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'verify' && (
          <div className="grid gap-5 pt-3 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="border-2 border-black bg-white shadow-[6px_6px_0_#111]">
              {topArt ? (
                <div className="h-56 border-b-2 border-black bg-gray-100 bg-cover bg-center" style={{ backgroundImage: `url(${topArt.image})` }} />
              ) : (
                <div className="grid h-56 place-items-center border-b-2 border-black bg-[#eadfc8]">
                  <div className="text-center">
                    <div className="text-[11px] uppercase tracking-[0.28em] text-gray-500">Wallet Required</div>
                    <div className="mt-2 text-3xl font-black">Sign in to reveal holdings</div>
                  </div>
                </div>
              )}

              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-gray-500">Score</div>
                    <div className="mt-1 text-6xl font-black leading-none">{session ? session.score.toLocaleString() : '0'}</div>
                  </div>
                  <div className="border-2 border-black px-4 py-3 text-right">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Rank</div>
                    <div className="text-xl font-black">{session?.rank || 'Unsigned'}</div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="border border-gray-200 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Assets</div>
                    <div className="mt-1 text-2xl font-black">{dashboard?.breakdown.assetCount || 0}</div>
                  </div>
                  <div className="border border-gray-200 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Collections</div>
                    <div className="mt-1 text-2xl font-black">{connectedCollections.length}</div>
                  </div>
                  <div className="border border-gray-200 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Wallet</div>
                    <div className="mt-2 font-mono text-xs">{wallet ? shortWallet(wallet) : 'Not signed'}</div>
                  </div>
                </div>

                {dashboardLoading && (
                  <div className="mt-5 border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                    Loading holdings and score breakdown...
                  </div>
                )}
                {error && (
                  <div className="mt-5 border-2 border-red-500 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className="border-2 border-black bg-white p-5">
                <div className="text-[11px] uppercase tracking-[0.24em] text-gray-500">Sign In</div>
                <h3 className="mt-2 text-3xl font-black leading-none">Connect your collector wallet</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-700">
                  A wallet signature proves address ownership. It is not a transaction and cannot move assets.
                </p>
                <button
                  onClick={connectAndVerify}
                  disabled={status === 'connecting' || status === 'signing'}
                  className="mt-5 w-full border-2 border-black bg-black px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-60"
                >
                  {walletActionLabel}
                </button>
              </div>

              <div className="border-2 border-black bg-white p-5">
                <div className="text-[11px] uppercase tracking-[0.24em] text-gray-500">Discord</div>
                <h3 className="mt-2 text-2xl font-black leading-none">Claim collector role</h3>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={linkDiscord}
                    disabled={!session || status === 'discord' || status === 'assigning'}
                    className="border-2 border-black bg-[#5865F2] px-3 py-3 text-xs font-black uppercase text-white disabled:opacity-40"
                  >
                    {discordConnection ? 'Connected' : 'Connect Discord'}
                  </button>
                  <button
                    onClick={signAndAssignRole}
                    disabled={!discordConnection || status === 'assigning' || status === 'discord'}
                    className="border-2 border-black bg-[#2c7a3f] px-3 py-3 text-xs font-black uppercase text-white disabled:opacity-40"
                  >
                    {status === 'assigning' ? 'Assigning...' : status === 'discord' ? 'Assigned' : 'Sign Role'}
                  </button>
                </div>
                {discordResult?.ok && <div className="mt-4 border border-green-600 bg-green-50 p-3 text-sm text-green-800">Discord verified. Your collector role is live.</div>}
                {discordConnection && !discordResult?.ok && (
                  <div className="mt-4 border border-[#5865F2] bg-blue-50 p-3 text-sm text-blue-800">
                    Connected as {discordConnection.discordUsername}. Sign once to assign your role.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Wallet', !!wallet],
                  ['Score', !!session],
                  ['Discord', !!discordConnection || !!discordResult?.ok],
                  ['Role', !!discordResult?.ok],
                ].map(([label, done]) => (
                  <div key={String(label)} className={`border-2 border-black p-3 text-sm font-bold ${done ? 'bg-black text-white' : 'bg-white text-black'}`}>
                    {label}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                <a href="/security" target="_blank" rel="noreferrer" className="underline">Security</a>
                <a href="/privacy" target="_blank" rel="noreferrer" className="underline">Privacy</a>
                <a href="/terms" target="_blank" rel="noreferrer" className="underline">Terms</a>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'holdings' && (
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-5 pt-3">
            <div className="space-y-5">
              <div className="border-2 border-black bg-white p-5 shadow-[6px_6px_0_#111]">
                <div className="text-[11px] tracking-[0.24em] uppercase text-gray-500 mb-3">Your Art</div>
                <h2 className="text-4xl font-black leading-none mb-4">Holdings Gallery</h2>
                {!wallet && (
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Sign in with your wallet on the Dashboard tab to load your tut™ holdings.
                  </p>
                )}
                {wallet && dashboardLoading && (
                  <p className="text-sm text-gray-500">Loading holdings...</p>
                )}
                {wallet && !dashboardLoading && !dashboard && (
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Holdings will appear here after wallet verification.
                  </p>
                )}
                {dashboard && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="border border-gray-200 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-1">Amount</div>
                        <div className="text-3xl font-black">{dashboard.holdings.assets.count}</div>
                      </div>
                      <div className="border border-gray-200 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-1">Score</div>
                        <div className="text-3xl font-black">{dashboard.score.toLocaleString()}</div>
                      </div>
                      <div className="border border-gray-200 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-1">Rank</div>
                        <div className="text-lg font-black">{dashboard.rank}</div>
                      </div>
                      <div className="border border-gray-200 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-1">1/1s</div>
                        <div className="text-lg font-black">{dashboard.breakdown.oneOfOneCount}</div>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2">Collections</div>
                      <div className="space-y-2">
                        {dashboard.holdings.collections.map((collection) => (
                          <div key={collection.slug} className="flex items-center justify-between border border-gray-200 px-3 py-2 text-sm">
                            <span className={collection.count > 0 ? 'text-black font-bold' : 'text-gray-500'}>{collection.name}</span>
                            <span className="font-mono text-xs">
                              {collection.count > 0
                                ? `${collection.count} * ${collection.weight.toLocaleString()} = ${collection.score.toLocaleString()}`
                                : `${collection.weight.toLocaleString()} each`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="border-2 border-black bg-white overflow-hidden">
              <div className="border-b-2 border-black bg-black text-white p-3 text-[10px] uppercase tracking-[0.16em]">
                Owned Works
              </div>
              <div className="max-h-[520px] overflow-auto p-4">
                {!dashboard && (
                  <div className="grid min-h-[360px] place-items-center text-center text-sm text-gray-500">
                    <div>
                      <div className="text-2xl font-black text-black">No wallet signed in</div>
                      <p className="mt-2">Use Dashboard to sign in and reveal owned works.</p>
                    </div>
                  </div>
                )}
                {dashboard && dashboard.holdings.assets.artworks.length === 0 && (
                  <div className="text-sm text-gray-500">
                    No owned tut™ assets returned for this wallet.
                  </div>
                )}
                {dashboard && dashboard.holdings.assets.artworks.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {dashboard.holdings.assets.artworks.map((art) => (
                      <a
                        key={`${art.collectionSlug}-${art.tokenId}`}
                        href={art.permalink || undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="border border-gray-200 bg-white text-black hover:border-black"
                      >
                        <div className="aspect-square bg-gray-100 overflow-hidden">
                          {art.image ? (
                            <div
                              aria-label={art.title}
                              className="h-full w-full bg-cover bg-center"
                              role="img"
                              style={{ backgroundImage: `url(${art.image})` }}
                            />
                          ) : (
                            <div className="grid h-full place-items-center text-xs text-gray-400">No image</div>
                          )}
                        </div>
                        <div className="p-2">
                          <div className="truncate text-xs font-bold">{art.title}</div>
                          <div className="text-[10px] text-gray-500">{art.collection} · #{art.tokenId}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-5 pt-3">
            <div className="border-2 border-black bg-white p-5 shadow-[6px_6px_0_#111]">
              <div className="text-[11px] tracking-[0.24em] uppercase text-gray-500 mb-3">tut™ Scores</div>
              <h2 className="text-4xl font-black leading-none mb-4">Collector Leaderboard</h2>
              <p className="text-sm text-gray-700 leading-relaxed">
                Wallet dashboards are live now. A public leaderboard needs a tut™ asset snapshot/indexer so every collector can be ranked from the same collection-only score model.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="border border-gray-200 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-1">Shown</div>
                  <div className="text-2xl font-black">{leaderboard.length}</div>
                </div>
                <div className="border border-gray-200 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-1">Top Score</div>
                  <div className="text-2xl font-black">{leaderboard[0]?.score.toLocaleString() || '0'}</div>
                </div>
              </div>
            </div>

            <div className="border-2 border-black bg-white overflow-hidden">
              <div className="grid grid-cols-[56px_1fr_110px_90px] border-b-2 border-black bg-black text-white text-[10px] uppercase tracking-[0.16em]">
                <div className="p-3">#</div>
                <div className="p-3">Wallet</div>
                <div className="p-3 text-right">Score</div>
                <div className="p-3 text-right">Rank</div>
              </div>
              <div className="max-h-[430px] overflow-auto">
                {leaderboardLoading && <div className="p-5 text-sm text-gray-500">Checking leaderboard...</div>}
                {!leaderboardLoading && leaderboard.length === 0 && (
                  <div className="p-5 text-sm text-gray-500">
                    tut™ collector leaderboard is not indexed yet. Verify a wallet and use Holdings for the live personal score.
                  </div>
                )}
                {!leaderboardLoading && leaderboard.map((entry, index) => (
                  <div
                    key={`${entry.wallet}-${index}`}
                    className="grid grid-cols-[56px_1fr_110px_90px] border-b border-gray-200 text-sm items-center"
                  >
                    <div className="p-3 font-bold">{index + 1}</div>
                    <div className="p-3 font-mono truncate">{shortWallet(entry.wallet)}</div>
                    <div className="p-3 text-right font-bold">{entry.score.toLocaleString()}</div>
                    <div className="p-3 text-right text-xs uppercase">{entry.rank}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-5 pt-3">
            <div className="border-2 border-black bg-white p-5 shadow-[6px_6px_0_#111]">
              <div className="text-[11px] tracking-[0.24em] uppercase text-gray-500 mb-3">Score</div>
              <h2 className="text-3xl font-black leading-none mb-4">What Counts</h2>
              <p className="text-sm text-gray-700 leading-relaxed">
                Collector Score is calculated from tut™ assets shown on this site. Higher-weight 1/1s and genesis works create the base, with small bonuses for collecting across multiple tut™ collections and holding more works.
              </p>
              <div className="mt-4 border-2 border-black bg-black text-white p-3 font-mono text-xs">
                score = weighted tut™ assets + breadth bonus + depth bonus
              </div>
              {dashboard && (
                <div className="mt-5 border-2 border-black bg-white p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-3">Your Breakdown</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-500">Weighted assets</div>
                    <div className="text-right font-bold">{dashboard.breakdown.base.toLocaleString()}</div>
                    <div className="text-gray-500">Breadth bonus</div>
                    <div className="text-right font-bold">+{dashboard.breakdown.breadthBonus.toLocaleString()}</div>
                    <div className="text-gray-500">Depth bonus</div>
                    <div className="text-right font-bold">+{dashboard.breakdown.depthBonus.toLocaleString()}</div>
                    <div className="border-t border-gray-200 pt-2 font-black">Total</div>
                    <div className="border-t border-gray-200 pt-2 text-right font-black">{dashboard.breakdown.calculatedScore.toLocaleString()}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="border-2 border-black bg-white p-5">
              <div className="text-[11px] tracking-[0.24em] uppercase text-gray-500 mb-3">Equation</div>
              <h2 className="text-3xl font-black leading-none mb-4">The Math</h2>
              <div className="space-y-2 text-sm text-gray-700">
                <p>Tut Genesis: 25,000 points each.</p>
                <p>Abstractions: 5,000 points each.</p>
                <p>OCF: 1,000 points each.</p>
                <p>Breadio on MegaETH: 500 points each.</p>
                <p>Tut Loudio: 100 points each.</p>
                <p>tut™ Editions: 50 points each.</p>
                <p>Breadth bonus: unique collections squared * 250.</p>
                <p>Depth bonus: +500 at 3 assets, +1,500 at 5, +5,000 at 10, +15,000 at 25.</p>
              </div>
              <div className="mt-5 border-2 border-[#2c7a3f] bg-green-50 p-3 text-sm leading-relaxed text-green-900">
                The hub uses read-only score checks, Discord identify, and wallet message signatures. No approvals, payments, passwords, or private keys.
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
