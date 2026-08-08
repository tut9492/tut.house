'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Row = { wallet: string; score: number; rank: string };

function shortWallet(w: string) {
  return w ? `${w.slice(0, 6)}…${w.slice(-4)}` : '';
}

const RANK_ORDER: Record<string, number> = { Legend: 4, Whale: 3, Collector: 2, Holder: 1, Unscored: 0 };

const PAGE_CSS = `
#lb-page {
  --mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;
  --sans:"Segoe UI",-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
  --ink:#141019; --blue:#a9c6e8; --olive:#6f8600; --label:#8a8a93; --hair:#ececec; --hair2:#e0e0e0;
  --shadow:4px 5px 0 0 rgba(20,16,30,.26), 0 16px 30px -12px rgba(30,20,45,.5);
  min-height:100vh; padding:34px 24px 70px; color:var(--ink);
  font-family:var(--sans); -webkit-font-smoothing:antialiased;
  background:
    radial-gradient(70% 50% at 18% 8%, rgba(255,246,250,.75), transparent 60%),
    radial-gradient(60% 45% at 82% 22%, rgba(240,224,236,.6), transparent 62%),
    radial-gradient(80% 55% at 60% 96%, rgba(196,206,226,.55), transparent 60%),
    radial-gradient(50% 40% at 40% 60%, rgba(255,255,255,.35), transparent 65%),
    linear-gradient(170deg,#c7c3d4 0%,#d4bcc6 42%,#c3b8cb 68%,#b7c1d3 100%);
}
#lb-page .lb-top { display:flex; align-items:center; justify-content:space-between; max-width:760px; margin:0 auto 22px; }
#lb-page .lb-wordmark { width:104px; height:46px; background-repeat:no-repeat; background-position:left center; background-size:contain; filter:brightness(0); }
#lb-page .lb-back { font:600 12.5px/1 var(--sans); color:#3a3a44; text-decoration:none; border:2.5px solid #000; border-radius:8px; background:#fff; padding:9px 14px; box-shadow:2px 2px 0 0 rgba(20,16,30,.22); }
#lb-page .lb-back:hover { background:#f4f4f2; }

#lb-page .win { max-width:760px; margin:0 auto; border:3px solid #000; border-radius:12px; background:#fff; box-shadow:var(--shadow); overflow:hidden; }
#lb-page .bar { display:flex; align-items:center; gap:10px; padding:11px 14px; border-bottom:3px solid #000; background:var(--blue); }
#lb-page .bar .t { font:700 15px/1 var(--mono); letter-spacing:.11em; color:#000; text-transform:uppercase; }
#lb-page .ctl { margin-left:auto; display:flex; gap:5px; }
#lb-page .ctl b { width:25px; height:21px; border:2.5px solid #000; border-radius:5px; background:#ededed; font:700 12px/1 var(--mono); display:grid; place-items:center; color:#000; }

#lb-page .lede { padding:16px 20px 4px; font:400 13.5px/1.55 var(--sans); color:#4a4a52; }
#lb-page .lede b { color:var(--ink); font-weight:600; }

#lb-page .lbhead, #lb-page .lbrow { display:grid; grid-template-columns:56px 1fr 118px auto; align-items:center; gap:10px; padding:13px 20px; }
#lb-page .lbhead { font:700 9px/1 var(--mono); letter-spacing:.12em; text-transform:uppercase; color:var(--label); border-bottom:2px solid #000; background:#f7f7f5; }
#lb-page .lbhead .rt, #lb-page .lbrow .rt { text-align:right; }
#lb-page .lbrow { border-bottom:1px solid var(--hair); font:500 15px/1 var(--sans); }
#lb-page .lbrow:last-child { border-bottom:none; }
#lb-page .rankn { font:800 17px/1 var(--mono); font-variant-numeric:tabular-nums; color:#20202a; }
#lb-page .rankn.m1 { color:#c79a20; }
#lb-page .rankn.m2 { color:#8f97a2; }
#lb-page .rankn.m3 { color:#b06a3a; }
#lb-page .wal { font:600 13.5px/1 var(--mono); color:#2a2a34; }
#lb-page .tier { justify-self:start; font:700 9px/1 var(--mono); letter-spacing:.06em; text-transform:uppercase; color:var(--label); border:1.5px solid var(--hair2); border-radius:5px; padding:4px 8px; }
#lb-page .stars { text-align:right; font:800 15px/1 var(--mono); color:var(--olive); font-variant-numeric:tabular-nums; }
#lb-page .lbrow.top { background:#fbfde8; }

#lb-page .empty { padding:34px 24px 40px; text-align:center; }
#lb-page .empty .badge { display:inline-block; font:700 9.5px/1 var(--mono); letter-spacing:.14em; text-transform:uppercase; color:var(--olive); border:1.5px solid #cfe0a0; background:#f4f8ec; border-radius:20px; padding:6px 12px; }
#lb-page .empty .msg { margin:16px auto 0; max-width:44ch; font:400 14px/1.6 var(--sans); color:#4a4a52; }
#lb-page .empty .cta { margin-top:20px; display:inline-block; font:600 13.5px/1 var(--sans); color:#fff; background:#1d2532; border:3px solid #000; border-radius:9px; padding:12px 22px; text-decoration:none; box-shadow:3px 3px 0 0 rgba(20,16,30,.24); }
#lb-page .empty .cta:hover { background:#171d28; }

#lb-page .foot { max-width:760px; margin:16px auto 0; text-align:center; font:400 12px/1.5 var(--sans); color:#5f5f68; }

@media (prefers-reduced-motion:reduce){ #lb-page * { transition-duration:.001ms !important; } }
`;

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/collectors/leaderboard?limit=100');
        const data = await res.json();
        if (cancelled) return;
        setRows(Array.isArray(data.leaderboard) ? data.leaderboard : []);
        setMessage(data.message || '');
      } catch {
        if (!cancelled) setMessage('Could not load the leaderboard right now.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sorted = [...rows].sort(
    (a, b) => b.score - a.score || (RANK_ORDER[b.rank] || 0) - (RANK_ORDER[a.rank] || 0),
  );

  return (
    <main id="lb-page">
      <style>{PAGE_CSS}</style>

      <div className="lb-top">
        <div className="lb-wordmark" style={{ backgroundImage: 'url(/assets/images/tutLogo.png)' }} aria-label="tut" />
        <Link href="/" className="lb-back">← tut.house</Link>
      </div>

      <div className="win">
        <div className="bar"><span className="t">Leaderboard</span><span className="ctl"><b>X</b><b>_</b></span></div>

        <div className="lede">
          The most decorated collectors of tut™ work, ranked by <b>Gold Stars</b> — weighted holdings,
          breadth across the catalogue, and depth of collection.
        </div>

        {loading ? (
          <div className="empty"><div className="msg">Loading the leaderboard…</div></div>
        ) : sorted.length ? (
          <>
            <div className="lbhead"><div>#</div><div>Wallet</div><div>Status</div><div className="rt">Stars</div></div>
            {sorted.map((row, i) => (
              <div key={`${row.wallet}-${i}`} className={`lbrow${i < 3 ? ' top' : ''}`}>
                <div className={`rankn${i < 3 ? ` m${i + 1}` : ''}`}>{i + 1}</div>
                <div className="wal">{shortWallet(row.wallet)}</div>
                <div className="tier">{row.rank}</div>
                <div className="stars">{row.score.toLocaleString()}</div>
              </div>
            ))}
          </>
        ) : (
          <div className="empty">
            <div className="badge">Indexing in progress</div>
            <div className="msg">{message || 'The public leaderboard is paused until tut™ asset scores are indexed across all collectors.'}</div>
            <Link href="/" className="cta">Check your score in the Collectors Hub →</Link>
          </div>
        )}
      </div>

      <div className="foot">Scores update as holdings change on-chain. Open the Collectors Hub on tut.house to verify your wallet.</div>
    </main>
  );
}
