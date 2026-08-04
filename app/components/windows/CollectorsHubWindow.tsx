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
      className="fixed bg-white overflow-hidden transition-shadow"
      style={{ top: 0, left: 0, right: 0, bottom: '48px', zIndex }}
      onClick={onClick}
    >
      <button
        className="absolute top-4 right-4 w-3 h-3 bg-red-500 hover:bg-red-600 rounded-full z-10 window-controls"
        onClick={onClose}
      />

      <div
        className="px-6 py-4 select-none bg-white"
        style={{ borderBottom: '1px solid #F3F4F6' }}
      >
        <span className="text-gray-600 text-sm font-normal">{title}</span>
      </div>

      <div className="h-[calc(100%-57px)] bg-white overflow-auto">
        <div className="border-b border-gray-100 bg-white px-6 py-8 lg:px-10 lg:py-10 text-gray-800">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-gray-400">Collectors Hub</div>
              <h2 className="mt-3 text-5xl md:text-7xl font-medium leading-none tracking-normal text-gray-800">
                tut<span className="align-super text-[0.38em]">™</span> Collector Score
              </h2>
              <p className="mt-5 max-w-3xl text-sm md:text-base leading-relaxed text-gray-500">
                Sign in with the wallet that holds your tut™ work to see your score, owned art, and Discord role status.
              </p>
            </div>
            <button
              onClick={connectAndVerify}
              disabled={status === 'connecting' || status === 'signing'}
              className="rounded-lg bg-slate-800 hover:bg-slate-900 px-8 py-3 text-sm font-medium text-white transition-colors disabled:opacity-60"
            >
              {walletActionLabel}
            </button>
          </div>
        </div>

        <div className="px-6 pb-10 lg:px-10">
        <div className="flex flex-wrap gap-2 pt-6 pb-4">
          {([
            ['verify', 'Dashboard'],
            ['holdings', 'Art'],
            ['guide', 'Scoring'],
          ] as Array<[HubTab, string]>).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab ? 'bg-slate-800 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'verify' && (
          <div className="grid gap-5 pt-3 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              {topArt ? (
                <div className="h-72 border-b border-gray-100 bg-gray-100 bg-cover bg-center" style={{ backgroundImage: `url(${topArt.image})` }} />
              ) : (
                <div className="grid h-72 place-items-center border-b border-gray-100 bg-gray-50">
                  <div className="text-center">
                    <div className="text-[11px] uppercase tracking-[0.28em] text-gray-400">Wallet Required</div>
                    <div className="mt-3 text-3xl font-medium text-gray-800">Sign in to reveal holdings</div>
                  </div>
                </div>
              )}

              <div className="p-5 lg:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-gray-400">Score</div>
                    <div className="mt-1 text-6xl font-medium leading-none text-gray-800">{session ? session.score.toLocaleString() : '0'}</div>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-right">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Rank</div>
                    <div className="text-xl font-medium text-gray-700">{session?.rank || 'Unsigned'}</div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-gray-100 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Assets</div>
                    <div className="mt-1 text-2xl font-medium text-gray-800">{dashboard?.breakdown.assetCount || 0}</div>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Collections</div>
                    <div className="mt-1 text-2xl font-medium text-gray-800">{connectedCollections.length}</div>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Wallet</div>
                    <div className="mt-2 font-mono text-xs text-gray-600">{wallet ? shortWallet(wallet) : 'Not signed'}</div>
                  </div>
                </div>

                {dashboardLoading && (
                  <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-500">
                    Loading holdings and score breakdown...
                  </div>
                )}
                {error && (
                  <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.24em] text-gray-400">Sign In</div>
                <h3 className="mt-2 text-3xl font-medium leading-none text-gray-800">Connect your collector wallet</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">
                  A wallet signature proves address ownership. It is not a transaction and cannot move assets.
                </p>
                <button
                  onClick={connectAndVerify}
                  disabled={status === 'connecting' || status === 'signing'}
                  className="mt-5 w-full rounded-lg bg-slate-800 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-60"
                >
                  {walletActionLabel}
                </button>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.24em] text-gray-400">Discord</div>
                <h3 className="mt-2 text-2xl font-medium leading-none text-gray-800">Claim collector role</h3>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={linkDiscord}
                    disabled={!session || status === 'discord' || status === 'assigning'}
                    className="rounded-lg bg-[#5865F2] px-3 py-3 text-xs font-medium text-white transition-colors hover:brightness-95 disabled:opacity-40"
                  >
                    {discordConnection ? 'Connected' : 'Connect Discord'}
                  </button>
                  <button
                    onClick={signAndAssignRole}
                    disabled={!discordConnection || status === 'assigning' || status === 'discord'}
                    className="rounded-lg bg-slate-800 px-3 py-3 text-xs font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-40"
                  >
                    {status === 'assigning' ? 'Assigning...' : status === 'discord' ? 'Assigned' : 'Sign Role'}
                  </button>
                </div>
                {discordResult?.ok && <div className="mt-4 rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-800">Discord verified. Your collector role is live.</div>}
                {discordConnection && !discordResult?.ok && (
                  <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
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
                  <div key={String(label)} className={`rounded-xl border p-3 text-sm font-medium ${done ? 'border-slate-800 bg-slate-800 text-white' : 'border-gray-100 bg-white text-gray-500'}`}>
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
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="text-[11px] tracking-[0.24em] uppercase text-gray-400 mb-3">Your Art</div>
                <h2 className="text-4xl font-medium leading-none mb-4 text-gray-800">Holdings Gallery</h2>
                {!wallet && (
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Sign in with your wallet on the Dashboard tab to load your tut™ holdings.
                  </p>
                )}
                {wallet && dashboardLoading && (
                  <p className="text-sm text-gray-500">Loading holdings...</p>
                )}
                {wallet && !dashboardLoading && !dashboard && (
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Holdings will appear here after wallet verification.
                  </p>
                )}
                {dashboard && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-gray-100 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-1">Amount</div>
                        <div className="text-3xl font-medium text-gray-800">{dashboard.holdings.assets.count}</div>
                      </div>
                      <div className="rounded-xl border border-gray-100 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-1">Score</div>
                        <div className="text-3xl font-medium text-gray-800">{dashboard.score.toLocaleString()}</div>
                      </div>
                      <div className="rounded-xl border border-gray-100 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-1">Rank</div>
                        <div className="text-lg font-medium text-gray-800">{dashboard.rank}</div>
                      </div>
                      <div className="rounded-xl border border-gray-100 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-1">1/1s</div>
                        <div className="text-lg font-medium text-gray-800">{dashboard.breakdown.oneOfOneCount}</div>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2">Collections</div>
                      <div className="space-y-2">
                        {dashboard.holdings.collections.map((collection) => (
                          <div key={collection.slug} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-sm">
                            <span className={collection.count > 0 ? 'text-gray-800 font-medium' : 'text-gray-400'}>{collection.name}</span>
                            <span className="font-mono text-xs text-gray-500">
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

            <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
              <div className="border-b border-gray-100 bg-gray-50 text-gray-500 p-3 text-[10px] uppercase tracking-[0.16em]">
                Owned Works
              </div>
              <div className="max-h-[520px] overflow-auto p-4">
                {!dashboard && (
                  <div className="grid min-h-[360px] place-items-center text-center text-sm text-gray-500">
                    <div>
                      <div className="text-2xl font-medium text-gray-800">No wallet signed in</div>
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
                        className="rounded-xl border border-gray-100 bg-white text-gray-800 overflow-hidden transition-all hover:border-gray-200 hover:shadow-sm"
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
                          <div className="truncate text-xs font-medium">{art.title}</div>
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
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="text-[11px] tracking-[0.24em] uppercase text-gray-400 mb-3">tut™ Scores</div>
              <h2 className="text-4xl font-medium leading-none mb-4 text-gray-800">Collector Leaderboard</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Wallet dashboards are live now. A public leaderboard needs a tut™ asset snapshot/indexer so every collector can be ranked from the same collection-only score model.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-100 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-1">Shown</div>
                  <div className="text-2xl font-medium text-gray-800">{leaderboard.length}</div>
                </div>
                <div className="rounded-xl border border-gray-100 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-1">Top Score</div>
                  <div className="text-2xl font-medium text-gray-800">{leaderboard[0]?.score.toLocaleString() || '0'}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
              <div className="grid grid-cols-[56px_1fr_110px_90px] border-b border-gray-100 bg-gray-50 text-gray-500 text-[10px] uppercase tracking-[0.16em]">
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
                    className="grid grid-cols-[56px_1fr_110px_90px] border-b border-gray-100 text-sm items-center text-gray-700"
                  >
                    <div className="p-3 font-medium">{index + 1}</div>
                    <div className="p-3 font-mono truncate">{shortWallet(entry.wallet)}</div>
                    <div className="p-3 text-right font-medium">{entry.score.toLocaleString()}</div>
                    <div className="p-3 text-right text-xs uppercase">{entry.rank}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-5 pt-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="text-[11px] tracking-[0.24em] uppercase text-gray-400 mb-3">Score</div>
              <h2 className="text-3xl font-medium leading-none mb-4 text-gray-800">What Counts</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Collector Score is calculated from tut™ assets shown on this site. Higher-weight 1/1s and genesis works create the base, with small bonuses for collecting across multiple tut™ collections and holding more works.
              </p>
              <div className="mt-4 rounded-xl bg-gray-50 text-gray-600 p-3 font-mono text-xs">
                score = weighted tut™ assets + breadth bonus + depth bonus
              </div>
              {dashboard && (
                <div className="mt-5 rounded-xl border border-gray-100 bg-white p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-3">Your Breakdown</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-500">Weighted assets</div>
                    <div className="text-right font-medium text-gray-800">{dashboard.breakdown.base.toLocaleString()}</div>
                    <div className="text-gray-500">Breadth bonus</div>
                    <div className="text-right font-medium text-gray-800">+{dashboard.breakdown.breadthBonus.toLocaleString()}</div>
                    <div className="text-gray-500">Depth bonus</div>
                    <div className="text-right font-medium text-gray-800">+{dashboard.breakdown.depthBonus.toLocaleString()}</div>
                    <div className="border-t border-gray-100 pt-2 font-medium text-gray-800">Total</div>
                    <div className="border-t border-gray-100 pt-2 text-right font-medium text-gray-800">{dashboard.breakdown.calculatedScore.toLocaleString()}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="text-[11px] tracking-[0.24em] uppercase text-gray-400 mb-3">Equation</div>
              <h2 className="text-3xl font-medium leading-none mb-4 text-gray-800">The Math</h2>
              <div className="space-y-2 text-sm text-gray-500">
                <p>Tut Genesis: 25,000 points each.</p>
                <p>Abstractions: 5,000 points each.</p>
                <p>OCF: 1,000 points each.</p>
                <p>Breadio on MegaETH: 500 points each.</p>
                <p>Tut Loudio: 100 points each.</p>
                <p>tut™ Editions: 50 points each.</p>
                <p>Breadth bonus: unique collections squared * 250.</p>
                <p>Depth bonus: +500 at 3 assets, +1,500 at 5, +5,000 at 10, +15,000 at 25.</p>
              </div>
              <div className="mt-5 rounded-xl border border-green-100 bg-green-50 p-3 text-sm leading-relaxed text-green-800">
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
