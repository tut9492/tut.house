'use client';

import { useEffect, useRef, useState } from 'react';

const TRACKS = [
  { src: '/music/need-some1.mp3', title: 'DEGO — Need Some1' },
  { src: '/music/azure-flute.mp3', title: 'Benno — Azure Flute' },
  { src: '/music/lights-go-down.mp3', title: 'Duce Williams — Lights Go Down' },
];

export default function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);

  // Load (and, if already playing, auto-play) whenever the track advances.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = TRACKS[index].src;
    if (playing) audio.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const handleEnded = () => setIndex((i) => (i + 1) % TRACKS.length);

  return (
    <>
      <audio ref={audioRef} onEnded={handleEnded} preload="none" />
      <button
        onClick={toggle}
        aria-label={playing ? 'Stop music' : 'Play music'}
        title={playing ? `Now playing — ${TRACKS[index].title}` : 'Play music'}
        className="absolute top-6 right-6 lg:top-8 lg:right-8 z-30 grid h-11 w-11 place-items-center rounded-lg border-[2.5px] border-black bg-white shadow-[2px_2px_0_0_rgba(20,16,30,0.24)] transition hover:brightness-95"
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect width="14" height="14" rx="2" fill="#000" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ marginLeft: 2 }}><path d="M4 3l9 5-9 5z" fill="#000" /></svg>
        )}
      </button>
    </>
  );
}
