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

export default function CollectorsHubWindow({ title, onClose, isActive, onClick, zIndex }: CollectorsHubWindowProps) {
  const isCompact = useIsMobile(1024);
  const [position, setPosition] = useState(() => ({
    x: Math.floor(Math.random() * (window.innerWidth - 1000)) + 50,
    y: Math.floor(Math.random() * (window.innerHeight - 650)) + 50,
  }));
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [wallet, setWallet] = useState('');
  const [session, setSession] = useState<CollectorSession | null>(null);
  const [discordResult, setDiscordResult] = useState<DiscordResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'signing' | 'verified' | 'discord'>('idle');
  const [error, setError] = useState('');
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
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
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
      const data = event.data as DiscordResult;
      if (data?.type !== 'tut_discord_verified') return;
      setDiscordResult(data);
      if (data.ok) {
        setStatus('discord');
        setError('');
      } else {
        setError(data.error || 'Discord linked, but role assignment needs attention.');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const connectAndVerify = async () => {
    setError('');
    setDiscordResult(null);
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
          : { top: position.y, left: position.x, width: '1000px', height: '650px', zIndex }
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

      <div className="px-6 pb-6 h-full bg-[#f7f2e8] overflow-auto">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-5 pt-6">
          <div className="border-2 border-black bg-white p-5 shadow-[6px_6px_0_#111]">
            <div className="text-[11px] tracking-[0.24em] uppercase text-gray-500 mb-3">Collector Score</div>
            <h2 className="text-3xl md:text-5xl leading-none font-black text-black mb-4">TU Holder Verification</h2>
            <p className="text-sm md:text-base text-gray-700 leading-relaxed mb-6 max-w-xl">
              Connect the wallet that holds your collector score, sign once, then link Discord to receive your TU role.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={connectAndVerify}
                disabled={status === 'connecting' || status === 'signing'}
                className="border-2 border-black bg-black text-white px-4 py-3 text-sm font-bold uppercase disabled:opacity-60"
              >
                {status === 'connecting'
                  ? 'Connecting...'
                  : status === 'signing'
                    ? 'Waiting for signature...'
                    : session
                      ? 'Refresh Score'
                      : 'Connect Wallet'}
              </button>
              <button
                onClick={linkDiscord}
                disabled={!session || status === 'discord'}
                className="border-2 border-black bg-[#5865F2] text-white px-4 py-3 text-sm font-bold uppercase disabled:opacity-40"
              >
                {status === 'discord' ? 'Discord Verified' : 'Verify Discord'}
              </button>
            </div>

            {error && (
              <div className="mt-5 border-2 border-red-500 bg-red-50 text-red-700 p-3 text-sm">
                {error}
              </div>
            )}
            {discordResult?.ok && (
              <div className="mt-5 border-2 border-green-600 bg-green-50 text-green-800 p-3 text-sm">
                Discord verified. Your collector role is live.
              </div>
            )}
          </div>

          <div className="border-2 border-black bg-white p-5">
            <div className="text-[11px] tracking-[0.24em] uppercase text-gray-500 mb-4">Live Readout</div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="border border-gray-200 p-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2">Wallet</div>
                <div className="font-mono text-sm text-black break-all">{wallet ? shortWallet(wallet) : 'Not connected'}</div>
              </div>
              <div className="border border-gray-200 p-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2">Rank</div>
                <div className="text-sm font-bold text-black">{session?.rank || 'Pending'}</div>
              </div>
            </div>

            <div className="border-2 border-black bg-black text-white p-5 mb-5">
              <div className="text-[10px] uppercase tracking-[0.22em] text-gray-400 mb-2">Collector Score</div>
              <div className="text-5xl font-black leading-none">{session ? session.score.toLocaleString() : '0'}</div>
            </div>

            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <span>Wallet signed</span>
                <span className="font-bold text-black">{session ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <span>Discord linked</span>
                <span className="font-bold text-black">{discordResult?.ok ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Role status</span>
                <span className="font-bold text-black">
                  {discordResult?.ok ? 'Assigned' : session ? 'Ready' : 'Waiting'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
