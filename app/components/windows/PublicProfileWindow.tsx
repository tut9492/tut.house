'use client';

import { useEffect, useState } from 'react';
import FullscreenFrame from './FullscreenFrame';
import { cdnImg } from '../../lib/img';

interface PublicProfileWindowProps {
  id: string;
  wallet: string;
  username: string;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
  zIndex: number;
}

type ArtRef = { tokenKey?: string; image: string; title: string; collection?: string; permalink?: string; weight?: number };
type Profile = { username: string; avatar: { image: string } | null; socialUrl: string | null; frame: ArtRef | null; gallery: ArtRef[] };
type Badge = { slug: string; name: string; count: number; image: string | null };

function socialLabel(url: string) {
  try { const u = new URL(url); return `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`; } catch { return url; }
}

const PP_CSS = `
.pp { --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace; --sans:"Segoe UI",-apple-system,Helvetica,Arial,sans-serif; max-width:1080px; margin:0 auto; display:flex; flex-direction:column; gap:22px; }
.pp .win { border:3px solid #000; border-radius:12px; background:#fff; overflow:hidden; box-shadow:4px 5px 0 0 rgba(20,16,30,.26), 0 16px 30px -14px rgba(30,20,45,.5); }
.pp .bar { display:flex; align-items:center; gap:8px; padding:9px 12px; border-bottom:3px solid #000; }
.pp .bar .t { font:700 12.5px/1 var(--mono); letter-spacing:.1em; text-transform:uppercase; color:#000; }
.pp .bar.lime { background:#cbf000; } .pp .bar.gray { background:#dcdcdc; }
.pp .bar.silver { background:linear-gradient(135deg,#dfe2e7,#fbfcfd 27%,#c4c9d2 55%,#eceef2 78%,#d3d7de); }
.pp .bar.gold { background:linear-gradient(135deg,#d6a02c,#f8dc7e 32%,#c69120 58%,#efc65a 80%,#d9a838); }
.pp .head { display:flex; align-items:center; gap:18px; padding:18px; }
.pp .av { width:96px; height:96px; border-radius:18px; border:2.5px solid #000; background:#f0efec center/cover no-repeat; flex:none; }
.pp .name { font:700 30px/1 var(--mono); letter-spacing:.01em; color:#161616; }
.pp .meta { font:700 12px/1 var(--mono); color:#6f8600; margin-top:8px; text-transform:uppercase; letter-spacing:.05em; }
.pp .social { display:inline-block; margin-top:8px; font:600 12px/1 var(--mono); color:#1d2532; text-decoration:none; border-bottom:1.5px solid rgba(29,37,50,.3); }
.pp .badges { display:flex; flex-wrap:wrap; gap:12px; padding:16px 18px; }
.pp .badge { position:relative; width:52px; height:52px; border-radius:50%; border:2px solid rgba(0,0,0,.4); background:#dcdce0 center/150% no-repeat; box-shadow:inset 0 -3px 6px rgba(0,0,0,.3); flex:none; }
.pp .badge .cnt { position:absolute; right:-4px; bottom:-4px; min-width:20px; height:20px; padding:0 5px; display:grid; place-items:center; border-radius:11px; border:2px solid #000; background:#161616; color:#fff; font:800 11px/1 ui-monospace,Menlo,monospace; }
/* Hover: badge grows and a name card reveals (matches the Hub). Panel goes overflow-visible so
   the enlarged badge and card aren't clipped. */
.pp .win.badges-win { overflow:visible; }
.pp .badge { transition:transform .18s cubic-bezier(.2,.8,.3,1); transform-origin:center bottom; z-index:1; }
.pp .badge:hover, .pp .badge:focus-visible { transform:scale(1.5); z-index:30; outline:none; }
.pp .badge:hover .cnt, .pp .badge:focus-visible .cnt { transform:scale(.72); }
.pp .badge .card { position:absolute; left:50%; bottom:calc(100% + 11px); transform:translate(-50%,6px); min-width:140px; max-width:190px; padding:8px 11px 9px; background:#fff; border:2.5px solid #000; border-radius:10px; box-shadow:4px 4px 0 0 rgba(20,16,30,.28); opacity:0; pointer-events:none; transition:opacity .16s ease, transform .16s ease; z-index:40; text-align:left; }
.pp .badge .card .nm { font:800 12.5px/1.15 ui-monospace,Menlo,monospace; color:#161616; }
.pp .badge .card .held { margin-top:5px; font:800 10.5px/1 ui-monospace,Menlo,monospace; color:#161616; }
.pp .badge .card::after { content:""; position:absolute; left:50%; top:100%; transform:translateX(-50%) rotate(45deg); margin-top:-6.5px; width:11px; height:11px; background:#fff; border-right:2.5px solid #000; border-bottom:2.5px solid #000; }
.pp .badge:hover .card, .pp .badge:focus-visible .card { opacity:1; transform:translate(-50%,0); }
@media (prefers-reduced-motion:reduce) { .pp .badge, .pp .badge .card, .pp .badge .cnt { transition:none; } }
.pp .frame-body { padding:20px; display:flex; flex-direction:column; align-items:center; background:#fff; }
.pp .frame-mat { background:#fff; padding:18px; border-radius:4px; box-shadow:0 20px 44px -20px rgba(0,0,0,.45), 0 0 0 1px #eee; }
.pp .frame-img { width:min(70vw,440px); height:min(46vh,440px); background:center/contain no-repeat; }
.pp .frame-cap { margin-top:12px; font:600 14px/1.2 var(--sans); color:#1a1a1a; text-align:center; }
.pp .gallery { display:flex; gap:18px; padding:18px; overflow-x:auto; }
.pp .g-frame { flex:none; width:190px; }
.pp .g-mat { background:#fff; padding:12px; border-radius:3px; box-shadow:0 14px 30px -16px rgba(0,0,0,.4), 0 0 0 1px #eee; }
.pp .g-img { width:100%; aspect-ratio:1/1; background:#fff center/contain no-repeat; }
.pp .g-cap { margin-top:8px; font:500 11px/1.3 var(--sans); color:#5a5a62; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pp .msg { text-align:center; color:#8a8a93; font:500 14px/1.5 var(--sans); padding:34px 16px; }
.pp .spin { width:32px; height:32px; border:3px solid #d8d8d8; border-bottom-color:#333; border-radius:50%; animation:pp-spin .8s linear infinite; margin:40px auto; }
@keyframes pp-spin { to { transform:rotate(360deg); } }
@media (max-width:640px){
  .pp { gap:16px; }
  .pp .head { flex-direction:column; align-items:flex-start; gap:12px; padding:14px; }
  .pp .av { width:80px; height:80px; }
  .pp .name { font-size:24px; }
  .pp .badges { gap:10px; padding:12px 14px; }
  .pp .badge { width:44px; height:44px; }
  .pp .frame-body { padding:14px; }
  .pp .frame-img { width:min(80vw,340px); height:min(50vh,340px); }
  .pp .gallery { padding:14px; gap:12px; }
  .pp .g-frame { width:150px; }
}
`;

export default function PublicProfileWindow({ wallet, username, onClose, onClick, zIndex }: PublicProfileWindowProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [score, setScore] = useState(0);
  const [tier, setTier] = useState('');
  const [badges, setBadges] = useState<Badge[]>([]);
  const [frameArt, setFrameArt] = useState<ArtRef | null>(null);
  const [gallery, setGallery] = useState<ArtRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pr, hr] = await Promise.all([
          fetch(`/api/collectors/profile?wallet=${encodeURIComponent(wallet)}`).then((r) => r.json()).catch(() => null),
          fetch(`/api/collectors/holdings?wallet=${encodeURIComponent(wallet)}`).then((r) => r.json()).catch(() => null),
        ]);
        if (cancelled) return;
        const p: Profile | null = pr?.profile || null;
        setProfile(p);
        const cols = hr?.breakdown?.collections || [];
        const owned = cols.filter((c: { count: number }) => c.count > 0);
        const allArt: ArtRef[] = owned.flatMap((c: { artworks?: ArtRef[] }) => c.artworks || []);
        setBadges(owned.map((c: { slug: string; name: string; count: number; artworks?: { image: string }[]; logo?: string }) => ({
          slug: c.slug, name: c.name, count: c.count, image: c.artworks?.[0]?.image || c.logo || null,
        })));
        setScore(hr?.score || 0);
        setTier(hr?.rank || '');
        const topArt = allArt.length ? [...allArt].sort((a, b) => (b.weight || 0) - (a.weight || 0))[0] : null;
        setFrameArt(p?.frame || topArt);
        setGallery(p?.gallery && p.gallery.length ? p.gallery : allArt);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [wallet]);

  const name = profile?.username || username;
  const avatar = profile?.avatar?.image;

  return (
    <FullscreenFrame title={`${name} · Collector`} onClose={onClose} onClick={onClick} zIndex={zIndex} onBack={onClose}>
      <style>{PP_CSS}</style>
      <div className="pp">
        {loading ? (
          <div className="spin" />
        ) : (
          <>
            <div className="win">
              <div className="bar lime"><span className="t">Collector</span></div>
              <div className="head">
                <div className="av" style={avatar ? { backgroundImage: `url(${cdnImg(avatar, 128)})` } : undefined} />
                <div>
                  <div className="name">{name}</div>
                  <div className="meta">{tier || 'Unscored'} · {score.toLocaleString()} ★</div>
                  {profile?.socialUrl && (
                    <a className="social" href={profile.socialUrl} target="_blank" rel="noopener noreferrer nofollow">↗ {socialLabel(profile.socialUrl)}</a>
                  )}
                </div>
              </div>
            </div>

            {badges.length > 0 && (
              <div className="win badges-win">
                <div className="bar gray"><span className="t">Badges</span></div>
                <div className="badges">
                  {badges.map((b) => (
                    <div key={b.slug} className="badge" tabIndex={0} style={b.image ? { backgroundImage: `url(${cdnImg(b.image, 96)})` } : undefined} title={`${b.name} · ×${b.count}`}>
                      <b className="cnt">{b.count}</b>
                      <div className="card">
                        <div className="nm">{b.name}</div>
                        <div className="held">{b.count} held</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {frameArt && (
              <div className="win">
                <div className="bar silver"><span className="t">Esteemed Works</span></div>
                <div className="frame-body">
                  <div className="frame-mat"><div className="frame-img" style={frameArt.image ? { backgroundImage: `url(${cdnImg(frameArt.image, 640)})` } : undefined} /></div>
                  <div className="frame-cap">{frameArt.title}</div>
                </div>
              </div>
            )}

            {gallery.length > 0 && (
              <div className="win">
                <div className="bar gold"><span className="t">Gallery of Fine Art</span></div>
                <div className="gallery">
                  {gallery.map((a, i) => (
                    <a key={`${a.title}-${i}`} className="g-frame" href={a.permalink || undefined} target="_blank" rel="noreferrer" onClick={(e) => { if (!a.permalink) e.preventDefault(); }}>
                      <div className="g-mat"><div className="g-img" style={a.image ? { backgroundImage: `url(${cdnImg(a.image, 384)})` } : undefined} /></div>
                      <div className="g-cap">{a.title}{a.collection ? ` · ${a.collection}` : ''}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {!profile && badges.length === 0 && <div className="msg">This collector hasn’t set up a page yet.</div>}
          </>
        )}
      </div>
    </FullscreenFrame>
  );
}
