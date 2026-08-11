'use client';

import AudioControls from '../audio/AudioControls';
import { cdnImg } from '../../lib/img';

export interface GalleryCollection {
  id: string;
  name: string;
  cover?: string;
  /** When set, the card links out instead of opening an in-app collection viewer. */
  href?: string;
  /** Renders a gold, shining "Coming Soon" placeholder card. */
  comingSoon?: boolean;
}

interface Props {
  id: string;
  title: string;
  collections: GalleryCollection[];
  onOpen: (id: string) => void;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
  zIndex: number;
  /** Covers still loading (prefetch not done) — show shimmer skeletons. */
  loading?: boolean;
}

const GFW_CSS = `
.gfw {
  --mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;
  --sans:"Segoe UI",-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
  position:fixed; top:0; left:0; right:0; bottom:48px; padding:18px;
  background:#c3b8cb url(/assets/images/hubClouds.jpg) center/cover fixed no-repeat;
  font-family:var(--sans); -webkit-font-smoothing:antialiased;
}
.gfw::before { content:""; position:fixed; top:0; left:0; right:0; bottom:48px; background:url(/assets/images/hubPink.jpg) center/cover no-repeat; opacity:.6; mix-blend-mode:multiply; pointer-events:none; }
.gfw .gfw-frame { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; border:3px solid #000; border-radius:13px; background:#fff; box-shadow:5px 6px 0 0 rgba(20,16,30,.26), 0 20px 40px -14px rgba(30,20,45,.5); overflow:hidden; }
.gfw .gfw-bar { flex:none; display:flex; align-items:center; gap:12px; padding:10px 16px; border-bottom:3px solid #000; background:#cbf000; }
.gfw .gfw-t { font:700 15.5px/1 var(--mono); letter-spacing:.11em; color:#000; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.gfw .gfw-ctl { margin-left:auto; display:flex; align-items:center; gap:8px; flex:none; }
.gfw .gfw-chip { width:32px; height:32px; border:2.5px solid #000; border-radius:8px; background:#fff; box-shadow:2px 2px 0 0 rgba(20,16,30,.24); font:700 13px/1 var(--mono); display:grid; place-items:center; color:#000; padding:0; cursor:pointer; }
.gfw .gfw-chip:hover { filter:brightness(.94); }
.gfw .gfw-body { flex:1; overflow-y:auto; padding:26px; background:#141019 url(/assets/images/digital-art-bg.jpg) center/cover no-repeat; }
.gfw .gfw-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:26px; max-width:1180px; margin:0 auto; }
.gfw .card { display:block; border:3px solid #000; border-radius:12px; background:#fff; overflow:hidden; cursor:pointer; text-decoration:none; color:inherit; box-shadow:4px 5px 0 0 rgba(20,16,30,.26), 0 16px 30px -14px rgba(30,20,45,.5); transition:transform .14s ease, box-shadow .14s ease; }
.gfw .card:hover { transform:translateY(-3px); box-shadow:5px 7px 0 0 rgba(20,16,30,.28), 0 22px 38px -14px rgba(30,20,45,.55); }
.gfw .card-bar { display:flex; align-items:center; gap:8px; padding:9px 12px; border-bottom:3px solid #000; background:#cbf000; }
.gfw .card.soon { cursor:default; }
.gfw .card.soon .card-bar { background:linear-gradient(135deg,#d6a02c 0%,#f8dc7e 32%,#c69120 58%,#efc65a 80%,#d9a838 100%); }
.gfw .card-t { font:700 12.5px/1 var(--mono); letter-spacing:.08em; text-transform:uppercase; color:#000; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.gfw .card-dot { margin-left:auto; width:11px; height:11px; border-radius:50%; background:#ec5f56; border:1.5px solid rgba(0,0,0,.4); flex:none; }
/* Full artwork, contained and centered (never cropped), with a white mat padding so the
   piece never touches the card frame. */
.gfw .card-art { aspect-ratio:1/1; background:#fff; padding:16px; display:grid; place-items:center; }
.gfw .card-img { width:100%; height:100%; background:center/contain no-repeat; }
.gfw .card-skel { width:100%; height:100%; border-radius:6px; background:linear-gradient(100deg,#efeae2 30%,#f7f4ee 50%,#efeae2 70%); background-size:200% 100%; animation:gfw-shimmer 1.3s ease-in-out infinite; }
@keyframes gfw-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
.gfw .card-art .ph { font:700 12px/1.4 var(--sans); color:#b7b1a6; text-align:center; padding:12px; }
@media (max-width:640px){
  .gfw { padding:8px; }
  .gfw .gfw-bar { padding:8px 10px; gap:8px; }
  .gfw .gfw-t { font-size:12px; }
  .gfw .gfw-ctl { gap:6px; }
  .gfw .gfw-chip { width:30px; height:30px; }
  .gfw .gfw-ctl .gfw-chip[aria-hidden="true"] { display:none; }
  .gfw .gfw-body { padding:14px 10px; }
  .gfw .gfw-grid { grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:14px; }
}
`;

export default function GalleryFolderWindow({ title, collections, onOpen, onClose, onClick, zIndex, loading }: Props) {
  return (
    <div className="gfw" style={{ zIndex }} onClick={onClick}>
      <style>{GFW_CSS}</style>
      <div className="gfw-frame">
        <div className="gfw-bar">
          <span className="gfw-t">{title}</span>
          <span className="gfw-ctl">
            <AudioControls />
            <span className="gfw-chip" aria-hidden="true">_</span>
            <button className="gfw-chip window-controls" onClick={onClose} aria-label="Close">X</button>
          </span>
        </div>
        <div className="gfw-body">
          <div className="gfw-grid">
            {collections.map((c) => {
              if (c.comingSoon) {
                return (
                  <div key={c.id} className="card soon" title="Coming soon">
                    <div className="card-bar"><span className="card-t">Coming Soon</span></div>
                    <div className="cs-art"><span className="cs-text">Coming Soon</span><span className="cs-shine" /></div>
                  </div>
                );
              }
              const inner = (
                <>
                  <div className="card-bar">
                    <span className="card-t">{c.name}</span>
                                      </div>
                  <div className="card-art">
                    {c.cover
                      ? <div className="card-img" style={{ backgroundImage: `url(${cdnImg(c.cover, 640)})` }} />
                      : loading
                        ? <div className="card-skel" />
                        : <span className="ph">{c.name}</span>}
                  </div>
                </>
              );
              return c.href ? (
                <a key={c.id} className="card" href={c.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title={c.name}>
                  {inner}
                </a>
              ) : (
                <div key={c.id} className="card" onClick={(e) => { e.stopPropagation(); onOpen(c.id); }} title={c.name}>
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
