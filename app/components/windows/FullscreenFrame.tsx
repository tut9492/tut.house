'use client';

import type { ReactNode } from 'react';
import AudioControls from '../audio/AudioControls';

// The standard fullscreen window chrome: dusk desktop backdrop, framed white window, titlebar
// with the title, shared music controls, and a close button. Body is scrollable.
interface Props {
  title: string;
  onClose: () => void;
  onClick: () => void;
  zIndex: number;
  onBack?: () => void;
  /** Override the titlebar background (e.g. a gold gradient for the leaderboard). */
  barBg?: string;
  /** Override the body background (e.g. a gradient image behind the content). */
  bodyBg?: string;
  children: ReactNode;
}

const FSW_CSS = `
.fsw {
  --mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;
  --sans:"Segoe UI",-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
  position:fixed; top:0; left:0; right:0; bottom:48px; padding:18px;
  background:#c3b8cb url(/assets/images/hubClouds.jpg) center/cover fixed no-repeat;
  font-family:var(--sans); -webkit-font-smoothing:antialiased;
}
.fsw::before { content:""; position:fixed; top:0; left:0; right:0; bottom:48px; background:url(/assets/images/hubPink.jpg) center/cover no-repeat; opacity:.6; mix-blend-mode:multiply; pointer-events:none; }
.fsw .fsw-frame { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; border:3px solid #000; border-radius:13px; background:#fff; box-shadow:5px 6px 0 0 rgba(20,16,30,.26), 0 20px 40px -14px rgba(30,20,45,.5); overflow:hidden; }
.fsw .fsw-bar { flex:none; display:flex; align-items:center; gap:12px; padding:10px 16px; border-bottom:3px solid #000; background:#cbf000; }
.fsw .fsw-t { font:700 15.5px/1 var(--mono); letter-spacing:.11em; color:#000; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fsw .fsw-ctl { margin-left:auto; display:flex; align-items:center; gap:8px; flex:none; }
.fsw .fsw-chip { width:32px; height:32px; border:2.5px solid #000; border-radius:8px; background:#fff; box-shadow:2px 2px 0 0 rgba(20,16,30,.24); font:700 13px/1 var(--mono); display:grid; place-items:center; color:#000; padding:0; cursor:pointer; }
.fsw .fsw-chip:hover { filter:brightness(.94); }
.fsw .fsw-back { width:auto; gap:5px; padding:0 11px; display:flex; align-items:center; font:700 11px/1 var(--mono); letter-spacing:.06em; text-transform:uppercase; }
.fsw .fsw-body { flex:1; overflow-y:auto; padding:32px 26px; background:linear-gradient(#fbfbfa,#f4f2ee); }
.fsw .fsw-inner { max-width:1080px; margin:0 auto; }
.fsw .fsw-center { min-height:100%; display:grid; place-items:center; text-align:center; }
`;

export default function FullscreenFrame({ title, onClose, onClick, zIndex, onBack, barBg, bodyBg, children }: Props) {
  return (
    <div className="fsw" style={{ zIndex }} onClick={onClick}>
      <style>{FSW_CSS}</style>
      <div className="fsw-frame">
        <div className="fsw-bar" style={barBg ? { background: barBg } : undefined}>
          {onBack && (
            <button className="fsw-chip fsw-back window-controls" onClick={onBack} aria-label="Back" title="Back">‹ Back</button>
          )}
          <span className="fsw-t">{title}</span>
          <span className="fsw-ctl">
            <AudioControls />
            <span className="fsw-chip" aria-hidden="true">_</span>
            <button className="fsw-chip window-controls" onClick={onClose} aria-label="Close">X</button>
          </span>
        </div>
        <div className="fsw-body" style={bodyBg ? { background: bodyBg } : undefined}>{children}</div>
      </div>
    </div>
  );
}
