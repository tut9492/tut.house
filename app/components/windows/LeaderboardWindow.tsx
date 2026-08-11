'use client';

import { useEffect, useState } from 'react';
import FullscreenFrame from './FullscreenFrame';

interface LeaderboardWindowProps {
  id: string;
  title: string;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
  zIndex: number;
  onOpenProfile?: (wallet: string, username: string) => void;
}

type Badge = { slug: string; name: string; count: number; image: string | null };
type Entry = { rank: number; username: string; wallet: string; avatar: string | null; score: number; tier: string; badges: Badge[] };

const LB_CSS = `
.lb { --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace; --sans:"Segoe UI",-apple-system,Helvetica,Arial,sans-serif; max-width:920px; margin:0 auto; }
.lb-head { display:grid; grid-template-columns:56px 60px 1fr auto auto; align-items:center; gap:16px; padding:6px 16px 12px; font:700 9.5px/1 var(--mono); letter-spacing:.11em; text-transform:uppercase; color:#8a8a93; }
.lb-row { display:grid; grid-template-columns:56px 60px 1fr auto auto; align-items:center; gap:16px; padding:12px 16px; border:3px solid #000; border-radius:12px; background:#fff; margin-bottom:12px; box-shadow:3px 4px 0 0 rgba(20,16,30,.22); }
.lb-row.top1 { background:linear-gradient(#fffdf0,#fff); }
.lb-rank { font:800 22px/1 var(--mono); color:#161616; font-variant-numeric:tabular-nums; text-align:center; }
.lb-row.top1 .lb-rank { color:#c99700; } .lb-row.top2 .lb-rank { color:#8a8a93; } .lb-row.top3 .lb-rank { color:#b5713a; }
.lb-av { width:54px; height:54px; border-radius:12px; border:2.5px solid #000; background:#f0efec center/cover no-repeat; flex:none; }
.lb-main { min-width:0; }
.lb-name { font:700 17px/1.1 var(--mono); color:#161616; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.lb-tier { font:600 11px/1 var(--sans); color:#6f8600; text-transform:uppercase; letter-spacing:.06em; margin-top:5px; }
.lb-badges { display:flex; gap:6px; }
.lb-badge { width:30px; height:30px; border-radius:50%; border:2px solid rgba(0,0,0,.5); background:#dcdce0 center/150% no-repeat; box-shadow:inset 0 -2px 4px rgba(0,0,0,.3); flex:none; }
.lb-score { font:800 18px/1 var(--mono); color:#161616; font-variant-numeric:tabular-nums; text-align:right; white-space:nowrap; }
.lb-score .st { color:#6f8600; }
.lb-msg { text-align:center; color:#8a8a93; font:500 14px/1.6 var(--sans); padding:48px 16px; }
.lb-spin { width:34px; height:34px; border:3px solid #d8d8d8; border-bottom-color:#333; border-radius:50%; animation:lb-spin .8s linear infinite; margin:48px auto; }
@keyframes lb-spin { to { transform:rotate(360deg); } }
@media (max-width:640px){ .lb-head, .lb-row { grid-template-columns:40px 48px 1fr auto; } .lb-badges { display:none; } }
`;

export default function LeaderboardWindow({ title, onClose, onClick, zIndex, onOpenProfile }: LeaderboardWindowProps) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/collectors/leaderboard?limit=50');
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Could not load the leaderboard.');
        if (!cancelled) setEntries(data.leaderboard || []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the leaderboard.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <FullscreenFrame title={title} onClose={onClose} onClick={onClick} zIndex={zIndex} barBg="linear-gradient(135deg,#d6a02c 0%,#f8dc7e 32%,#c69120 58%,#efc65a 80%,#d9a838 100%)" bodyBg="url(/assets/images/leaderboard-bg.jpg) center/cover no-repeat">
      <style>{LB_CSS}</style>
      <div className="lb">
        {entries === null && !error && <div className="lb-spin" />}
        {error && <div className="lb-msg">{error}</div>}
        {entries && entries.length === 0 && (
          <div className="lb-msg">No collectors have set up a page yet. Sign in on Collectors Hub and design yours to claim the top spot.</div>
        )}
        {entries && entries.length > 0 && (
          <>
            <div className="lb-head">
              <div style={{ textAlign: 'center' }}>#</div>
              <div />
              <div>Collector</div>
              <div>Badges</div>
              <div style={{ textAlign: 'right' }}>Score</div>
            </div>
            {entries.map((e) => (
              <div
                key={e.wallet}
                className={`lb-row${e.rank <= 3 ? ` top${e.rank}` : ''}`}
                onClick={(ev) => { ev.stopPropagation(); onOpenProfile?.(e.wallet, e.username); }}
                style={{ cursor: 'pointer' }}
                title={`View ${e.username}'s profile`}
              >
                <div className="lb-rank">{e.rank}</div>
                <div className="lb-av" style={e.avatar ? { backgroundImage: `url(${e.avatar})` } : undefined} />
                <div className="lb-main">
                  <div className="lb-name">{e.username}</div>
                  <div className="lb-tier">{e.tier}</div>
                </div>
                <div className="lb-badges">
                  {e.badges.map((b) => (
                    <div
                      key={b.slug}
                      className="lb-badge"
                      style={b.image ? { backgroundImage: `url(${b.image})` } : undefined}
                      title={`${b.name} · ×${b.count}`}
                    />
                  ))}
                </div>
                <div className="lb-score">{e.score.toLocaleString()} <span className="st">★</span></div>
              </div>
            ))}
          </>
        )}
      </div>
    </FullscreenFrame>
  );
}
