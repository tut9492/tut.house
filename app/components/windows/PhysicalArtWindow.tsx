'use client';

import FullscreenFrame from './FullscreenFrame';

interface PhysicalArtWindowProps {
  id: string;
  title: string;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
  zIndex: number;
}

// Physical / RWA pieces. `cover` = product photo (add as available); `href` = where to buy/view.
const PIECES: { id: string; name: string; cover?: string; href?: string }[] = [
  { id: 'rwa-f-001', name: 'TUT™ RWA F-001', cover: '/assets/images/rwa-f-001.webp', href: 'https://www.dyli.io/drop/18580-tuttm-rwa-f-001' },
];

const PA_CSS = `
.pa { --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace; --sans:"Segoe UI",-apple-system,Helvetica,Arial,sans-serif; max-width:1080px; margin:0 auto; }
.pa .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:26px; }
.pa .card { border:3px solid #000; border-radius:12px; background:#fff; overflow:hidden; box-shadow:4px 5px 0 0 rgba(20,16,30,.26), 0 16px 30px -14px rgba(30,20,45,.5); text-decoration:none; transition:transform .14s ease, box-shadow .14s ease; }
.pa a.card { cursor:pointer; }
.pa a.card:hover { transform:translateY(-3px); box-shadow:5px 7px 0 0 rgba(20,16,30,.28), 0 22px 38px -14px rgba(30,20,45,.55); }
.pa .card-bar { display:flex; align-items:center; gap:8px; padding:9px 12px; border-bottom:3px solid #000; background:#cbf000; }
.pa .card-t { font:700 12.5px/1 var(--mono); letter-spacing:.08em; text-transform:uppercase; color:#000; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pa .card-dot { margin-left:auto; width:11px; height:11px; border-radius:50%; background:#ec5f56; border:1.5px solid rgba(0,0,0,.4); flex:none; }
.pa .card-art { aspect-ratio:1/1; background-color:#fff; background-repeat:no-repeat; background-position:center; background-size:contain; background-origin:content-box; padding:16px; display:grid; place-items:center; }
.pa .card-art .ph { font:700 12px/1.4 var(--sans); color:#b7b1a6; text-align:center; padding:12px; }
`;

export default function PhysicalArtWindow({ title, onClose, onClick, zIndex }: PhysicalArtWindowProps) {
  return (
    <FullscreenFrame title={title} onClose={onClose} onClick={onClick} zIndex={zIndex}>
      <style>{PA_CSS}</style>
      <div className="pa">
        <div className="grid">
          {PIECES.map((p) => {
            const inner = (
              <>
                <div className="card-bar"><span className="card-t">{p.name}</span><span className="card-dot" aria-hidden="true" /></div>
                <div className="card-art" style={p.cover ? { backgroundImage: `url(${p.cover})` } : undefined}>
                  {!p.cover && <span className="ph">{p.name}</span>}
                </div>
              </>
            );
            return p.href ? (
              <a key={p.id} className="card" href={p.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title={p.name}>
                {inner}
              </a>
            ) : (
              <div key={p.id} className="card" title={p.name}>{inner}</div>
            );
          })}
        </div>
      </div>
    </FullscreenFrame>
  );
}
