'use client';

import { useEffect, useState } from 'react';
import AudioControls from '../audio/AudioControls';
import { cdnImg } from '../../lib/img';

interface ArtworkItem {
  id: string;
  title: string;
  src: string;
  collection?: string;
  chain?: string;
  technique?: string;
  permalink?: string;
}

interface CollectionWindowProps {
  id: string;
  title: string;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
  zIndex: number;
  openseaSlug?: string;
  limit?: number;
  prefetchedArtworks?: ArtworkItem[];
  onArtworksLoaded?: (slug: string, artworks: ArtworkItem[]) => void;
}

const CW_CSS = `
.collection-window {
  --mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;
  --sans:"Segoe UI",-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
  position:fixed; top:0; left:0; right:0; bottom:48px; padding:18px;
  background:#c3b8cb url(/assets/images/hubClouds.jpg) center/cover fixed no-repeat;
  font-family:var(--sans); -webkit-font-smoothing:antialiased;
}
.collection-window::before { content:""; position:fixed; top:0; left:0; right:0; bottom:48px; background:url(/assets/images/hubPink.jpg) center/cover no-repeat; opacity:.6; mix-blend-mode:multiply; pointer-events:none; }
.collection-window .cw-frame { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; border:3px solid #000; border-radius:13px; background:#fff; box-shadow:5px 6px 0 0 rgba(20,16,30,.26), 0 20px 40px -14px rgba(30,20,45,.5); overflow:hidden; }
.collection-window .cw-bar { display:flex; align-items:center; gap:12px; padding:11px 16px; border-bottom:3px solid #000; background:#cbf000; }
.collection-window .cw-t { font:700 15.5px/1 var(--mono); letter-spacing:.11em; color:#000; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.collection-window .cw-ct { font:700 10.5px/1 var(--mono); letter-spacing:.06em; color:#2b3a00; border:1.5px solid rgba(0,0,0,.35); border-radius:20px; padding:4px 10px; font-variant-numeric:tabular-nums; flex:none; }
.collection-window .cw-ctl { margin-left:auto; display:flex; gap:5px; flex:none; }
.collection-window .cw-chip { width:32px; height:32px; border:2.5px solid #000; border-radius:8px; background:#fff; box-shadow:2px 2px 0 0 rgba(20,16,30,.24); font:700 13px/1 var(--mono); display:grid; place-items:center; color:#000; padding:0; cursor:pointer; }
.collection-window .cw-chip:hover { filter:brightness(.94); }
.collection-window .cw-back { width:auto; gap:5px; padding:0 11px; display:flex; align-items:center; font:700 11px/1 var(--mono); letter-spacing:.06em; text-transform:uppercase; flex:none; }
.collection-window .cw-ctl { align-items:center; }
.collection-window .cw-stage { flex:1; position:relative; display:grid; place-items:center; padding:40px; min-height:0; background:#f4f2ee url(/assets/images/white-grain.jpg) center/cover no-repeat; }
.collection-window .cw-mat { background:#fff; padding:22px; border-radius:4px; box-shadow:0 26px 54px -22px rgba(0,0,0,.5), 0 0 0 1px #eee; max-height:100%; display:flex; }
.collection-window .cw-art { display:block; max-height:min(70vh,760px); max-width:80vw; width:auto; height:auto; object-fit:contain; border-radius:2px; cursor:pointer; }
.collection-window .cw-nav { position:absolute; top:50%; transform:translateY(-50%); width:52px; height:52px; border:3px solid #000; border-radius:12px; background:rgba(255,255,255,.92); display:grid; place-items:center; cursor:pointer; box-shadow:3px 3px 0 0 rgba(20,16,30,.24); font:700 22px/1 var(--sans); color:#000; padding:0; }
.collection-window .cw-nav:hover { background:#fff; }
.collection-window .cw-nav.prev { left:26px; }
.collection-window .cw-nav.next { right:26px; }
.collection-window .cw-cap { position:absolute; left:0; right:0; bottom:16px; text-align:center; font:600 12.5px/1 var(--mono); letter-spacing:.04em; color:#6a6a72; padding:0 80px; }
.collection-window .cw-msg { color:#8a8a93; font:400 14px/1.5 var(--sans); }
.collection-window .cw-spin { width:34px; height:34px; border:3px solid #d8d8d8; border-bottom-color:#333; border-radius:50%; animation:cw-spin .8s linear infinite; }
@keyframes cw-spin { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion:reduce){ .collection-window .cw-spin { animation-duration:1.6s; } }
`;

export default function CollectionWindow({
  title,
  onClose,
  onClick,
  zIndex,
  openseaSlug,
  limit,
  prefetchedArtworks,
  onArtworksLoaded,
}: CollectionWindowProps) {
  const [artworks, setArtworks] = useState<ArtworkItem[]>(prefetchedArtworks ?? []);
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(!(prefetchedArtworks && prefetchedArtworks.length > 0));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prefetchedArtworks && prefetchedArtworks.length > 0) {
      setArtworks(prefetchedArtworks);
      setIsLoading(false);
    }
  }, [prefetchedArtworks]);

  useEffect(() => {
    const fetchArtworks = async () => {
      if (!openseaSlug) {
        setIsLoading(false);
        return;
      }
      const skipFetch = prefetchedArtworks && prefetchedArtworks.length > 0
        && openseaSlug !== 'abstractions'
        && openseaSlug !== 'tut-loudio';
      if (skipFetch) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);

        const url = `/api/opensea/collection?slug=${openseaSlug}${limit != null ? `&limit=${limit}` : ''}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Failed to fetch collection');
        }

        const data = await response.json();
        if (data.artworks && data.artworks.length > 0) {
          setArtworks(data.artworks);
          setIndex(0);
          if (openseaSlug) onArtworksLoaded?.(openseaSlug, data.artworks);
        }
      } catch (err) {
        console.error('Error fetching artworks:', err);
        setError('Failed to load collection');
      } finally {
        setIsLoading(false);
      }
    };

    fetchArtworks();
    // Intentionally omit prefetchedArtworks so we only fetch once per slug/limit.
    // Re-running when prefetchedArtworks changed caused a second request that could fail (e.g. rate limit)
    // and was making NFTs disappear for Abstractions and Tut Loudio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openseaSlug, limit]);

  const total = artworks.length;
  const current = total > 0 ? artworks[Math.min(index, total - 1)] : null;
  const go = (delta: number) => setIndex((i) => (i + delta + total) % total);

  const openOriginal = () => {
    if (current?.permalink) window.open(current.permalink, '_blank');
  };

  return (
    <div className="collection-window" style={{ zIndex }} onClick={onClick}>
      <style>{CW_CSS}</style>

      <div className="cw-frame">
        <div className="cw-bar">
          <button className="cw-chip cw-back window-controls" onClick={onClose} aria-label="Back" title="Back to collections">‹ Back</button>
          <span className="cw-t">{title}</span>
          {total > 0 && <span className="cw-ct">{index + 1} / {total}</span>}
          <span className="cw-ctl">
            <AudioControls />
            <span className="cw-chip" aria-hidden="true">_</span>
            <button className="cw-chip window-controls" onClick={onClose} aria-label="Close">X</button>
          </span>
        </div>

        <div className="cw-stage">
          {isLoading ? (
            <div className="cw-spin" />
          ) : error ? (
            <div className="cw-msg">{error}</div>
          ) : current ? (
            <>
              {total > 1 && (
                <button className="cw-nav prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous">‹</button>
              )}
              <div className="cw-mat">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={current.src}
                  className="cw-art"
                  src={cdnImg(current.src, 1080)}
                  alt={current.title}
                  title={current.permalink ? 'View original ↗' : current.title}
                  loading="eager"
                  onClick={(e) => { e.stopPropagation(); openOriginal(); }}
                />
              </div>
              {total > 1 && (
                <button className="cw-nav next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next">›</button>
              )}
              <div className="cw-cap">{current.title}</div>
            </>
          ) : (
            <div className="cw-msg">No works to show.</div>
          )}
        </div>
      </div>
    </div>
  );
}
