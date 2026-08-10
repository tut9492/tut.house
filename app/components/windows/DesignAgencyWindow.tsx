'use client';

import FullscreenFrame from './FullscreenFrame';

interface DesignAgencyWindowProps {
  id: string;
  title: string;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
  zIndex: number;
}

// Teams/clients Tut has done go-to-market work for. `cover` = showcase art (Tut is sharing
// these — fill in as they arrive); `href` links to the project when known.
const TEAMS: { id: string; name: string; cover?: string; href?: string }[] = [
  { id: 'betman69', name: 'betman69', cover: '/assets/images/betman.png', href: 'https://x.com/betmangenesis69' },
  { id: 'agntsocial', name: 'AGNT Social', cover: '/assets/images/agnt-logo.png', href: 'https://agnt.social' },
  { id: 'breadio', name: 'Breadio', cover: 'https://breadio.tuthopium.store/logo.jpg', href: 'https://breadio.tuthopium.store' },
  { id: 'tutloudio', name: 'Tut Loudio', cover: '/assets/images/tutloudio.png' },
];

const SERVICES = ['Art', 'Marketing', 'Websites', 'On-chain creation'];

const AGENCY_CSS = `
.agency { --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace; --sans:"Segoe UI",-apple-system,Helvetica,Arial,sans-serif; max-width:1080px; margin:0 auto; display:flex; flex-direction:column; gap:24px; }
.agency .win { border:3px solid #000; border-radius:12px; background:#fff; overflow:hidden; box-shadow:4px 5px 0 0 rgba(20,16,30,.26), 0 16px 30px -14px rgba(30,20,45,.5); }
.agency .bar { display:flex; align-items:center; gap:8px; padding:9px 12px; border-bottom:3px solid #000; background:#cbf000; }
.agency .bar .t { font:700 12.5px/1 var(--mono); letter-spacing:.1em; text-transform:uppercase; color:#000; }
.agency .bar .dot { margin-left:auto; width:11px; height:11px; border-radius:50%; background:#ec5f56; border:1.5px solid rgba(0,0,0,.4); flex:none; }
.agency .writeup { padding:26px 26px 24px; }
.agency .writeup h2 { font:800 26px/1.1 var(--sans); color:#161616; margin:0 0 10px; letter-spacing:-.01em; }
.agency .writeup p { font:400 15px/1.6 var(--sans); color:#43434c; margin:0 0 18px; max-width:60ch; }
.agency .svc { display:flex; flex-wrap:wrap; gap:9px; margin-bottom:20px; }
.agency .svc span { font:700 11px/1 var(--mono); letter-spacing:.06em; text-transform:uppercase; color:#2b3a00; border:2px solid #000; border-radius:20px; padding:8px 14px; background:#eaf7b0; }
.agency .cta { display:inline-flex; border:3px solid #000; border-radius:9px; background:#1d2532; color:#fff; font:600 13.5px/1 var(--sans); padding:12px 22px; cursor:pointer; box-shadow:3px 3px 0 0 rgba(20,16,30,.24); }
.agency .cta:hover { background:#171d28; }
.agency .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:22px; }
.agency .card { border:3px solid #000; border-radius:12px; background:#fff; overflow:hidden; box-shadow:4px 5px 0 0 rgba(20,16,30,.26), 0 16px 30px -14px rgba(30,20,45,.5); transition:transform .14s ease, box-shadow .14s ease; }
.agency a.card { cursor:pointer; text-decoration:none; }
.agency a.card:hover { transform:translateY(-3px); box-shadow:5px 7px 0 0 rgba(20,16,30,.28), 0 22px 38px -14px rgba(30,20,45,.55); }
.agency .card-bar { display:flex; align-items:center; gap:8px; padding:9px 12px; border-bottom:3px solid #000; background:#cbf000; }
.agency .card-t { font:700 12.5px/1 var(--mono); letter-spacing:.08em; text-transform:uppercase; color:#000; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.agency .card-dot { margin-left:auto; width:11px; height:11px; border-radius:50%; background:#ec5f56; border:1.5px solid rgba(0,0,0,.4); flex:none; }
.agency .card-art { aspect-ratio:1/1; background-color:#fff; background-repeat:no-repeat; background-position:center; background-size:contain; background-origin:content-box; padding:16px; display:grid; place-items:center; }
.agency .card-art .ph { font:700 12px/1.4 var(--sans); color:#b7b1a6; text-align:center; padding:12px; }
`;

export default function DesignAgencyWindow({ title, onClose, onClick, zIndex }: DesignAgencyWindowProps) {
  return (
    <FullscreenFrame title={title} onClose={onClose} onClick={onClick} zIndex={zIndex}>
      <style>{AGENCY_CSS}</style>
      <div className="agency">
        {/* WRITE-UP */}
        <div className="win">
          <div className="bar"><span className="t">Tut Agency</span><span className="dot" aria-hidden="true" /></div>
          <div className="writeup">
            <h2>Full go-to-market for teams who need eyes on their product.</h2>
            <p>
              Tut Agency is a complete go-to-market service for teams looking to get eyes on their
              product. Tut does everything — art, marketing, websites, and on-chain creation — so a
              project can launch and grow from one place.
            </p>
            <div className="svc">
              {SERVICES.map((s) => <span key={s}>{s}</span>)}
            </div>
            <button
              className="cta"
              onClick={(e) => { e.stopPropagation(); window.open('https://x.com/Tuteth_', '_blank', 'noopener,noreferrer'); }}
            >
              Get in Touch ↗
            </button>
          </div>
        </div>

        {/* TEAMS */}
        <div className="grid">
          {TEAMS.map((team) => {
            const inner = (
              <>
                <div className="card-bar"><span className="card-t">{team.name}</span><span className="card-dot" aria-hidden="true" /></div>
                <div className="card-art" style={team.cover ? { backgroundImage: `url(${team.cover})` } : undefined}>
                  {!team.cover && <span className="ph">{team.name}</span>}
                </div>
              </>
            );
            return team.href ? (
              <a key={team.id} className="card" href={team.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title={team.name}>
                {inner}
              </a>
            ) : (
              <div key={team.id} className="card" title={team.name}>{inner}</div>
            );
          })}
        </div>
      </div>
    </FullscreenFrame>
  );
}
