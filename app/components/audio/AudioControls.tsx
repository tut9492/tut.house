'use client';

import { useAudio } from './AudioProvider';

// Play/stop + skip buttons wired to the shared AudioProvider. Drop into the desktop or any
// window titlebar; pass a className to position it.
export default function AudioControls({ className = '' }: { className?: string }) {
  const { playing, title, toggle, skip } = useAudio();
  const btn =
    'grid h-8 w-8 place-items-center rounded-lg border-[2.5px] border-black bg-white shadow-[2px_2px_0_0_rgba(20,16,30,0.24)] transition hover:brightness-95';

  return (
    <div className={`flex gap-2 ${className}`}>
      <button
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        aria-label={playing ? 'Stop music' : 'Play music'}
        title={playing ? `Now playing — ${title}` : 'Play music'}
        className={btn}
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><rect width="14" height="14" rx="2" fill="#000" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" style={{ marginLeft: 2 }}><path d="M4 3l9 5-9 5z" fill="#000" /></svg>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); skip(); }}
        aria-label="Skip to next track"
        title="Skip track"
        className={btn}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l6 5-6 5z" fill="#000" /><rect x="10.4" y="3" width="2.4" height="10" rx="1" fill="#000" /></svg>
      </button>
    </div>
  );
}
