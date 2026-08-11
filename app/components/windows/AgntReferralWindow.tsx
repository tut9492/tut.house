'use client';

import { useState, useRef, useEffect } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

interface AgntReferralWindowProps {
  id: string;
  title: string;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
  zIndex: number;
}

const perks = [
  {
    id: 'boosted-points',
    name: 'Boosted LB Points',
    description: 'Share your AGNT ref and earn boosted Leaderboard points for every friend who joins.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
  {
    id: 'early-bird',
    name: 'First 24h — x2',
    description: 'Every ref in the first 24 hours after launch counts double. Move early, stack faster.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    id: 'milestones',
    name: 'Milestone Multipliers',
    description: 'Hit ref milestones to unlock bigger multipliers on your Leaderboard points.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-6" />
      </svg>
    ),
  },
];

const milestones = [
  { refs: '5 refs', multiplier: '1.25x' },
  { refs: '10 refs', multiplier: '1.5x' },
  { refs: '25 refs', multiplier: '2x' },
  { refs: '50 refs', multiplier: '3x' },
];

export default function AgntReferralWindow({ title, onClose, isActive, onClick, zIndex }: AgntReferralWindowProps) {
  const isCompact = useIsMobile(1024);
  const [position, setPosition] = useState(() => ({
    x: Math.floor(Math.random() * (window.innerWidth - 1000)) + 50,
    y: Math.floor(Math.random() * (window.innerHeight - 650)) + 50,
  }));
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);

  const refLink = `https://tut.house/?ref=${encodeURIComponent(code.trim() || 'your-code')}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(refLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const handleShare = () => {
    const text = `AGNT Referral is LIVE 🚀\n\nShare your ref, get boosted LB points. First 24h refs are x2, and milestone multipliers stack on top.\n\nGrab yours:`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(refLink)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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

      <div className="px-6 pb-6 h-[calc(100%-56px)] bg-white overflow-auto">
        <div className="mt-8 mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-green-50 border border-green-100">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-600 text-xs font-medium tracking-wide">LIVE</span>
          </div>
          <h2 className="text-gray-800 text-xl font-medium mb-2">AGNT Referral Program</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Share your AGNT ref, climb the Leaderboard, and stack multipliers as you go.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {perks.map((perk) => (
            <div
              key={perk.id}
              className="p-5 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all cursor-default"
            >
              <div className="mb-3">{perk.icon}</div>
              <h3 className="text-gray-700 text-sm font-medium mb-1">{perk.name}</h3>
              <p className="text-gray-400 text-xs leading-relaxed">{perk.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl border border-gray-100">
            <h3 className="text-gray-700 text-sm font-medium mb-4">Your referral link</h3>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter your AGNT code or handle"
              className="w-full px-4 py-2.5 mb-3 rounded-lg border border-gray-200 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-400"
            />
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 mb-3 rounded-lg bg-gray-50 border border-gray-100">
              <span className="text-gray-500 text-xs truncate">{refLink}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              <button
                onClick={handleShare}
                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Share on X
              </button>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-gray-100">
            <h3 className="text-gray-700 text-sm font-medium mb-4">Milestone multipliers</h3>
            <div className="space-y-2">
              {milestones.map((m) => (
                <div
                  key={m.refs}
                  className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-100"
                >
                  <span className="text-gray-600 text-sm">{m.refs}</span>
                  <span className="text-gray-800 text-sm font-medium">{m.multiplier}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-300 text-xs mt-4 leading-relaxed">
              Multipliers apply to your Leaderboard points. First 24 hours after launch, every ref counts x2.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
