'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

const TRACKS = [
  { src: '/music/eill-fraction.mp3', title: 'Eill — Fraction' },
  { src: '/music/azure-flute.mp3', title: 'Benno — Azure Flute' },
  { src: '/music/lights-go-down.mp3', title: 'Duce Williams — Lights Go Down' },
];

type AudioState = { playing: boolean; title: string; toggle: () => void; skip: () => void };

const AudioCtx = createContext<AudioState | null>(null);

export function useAudio(): AudioState {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error('useAudio must be used within AudioProvider');
  return ctx;
}

// Single shared <audio> element + play/skip state, so the controls can be rendered in the
// desktop AND inside each fullscreen window without spawning multiple players.
export function AudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);

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

  const skip = () => setIndex((i) => (i + 1) % TRACKS.length);
  const handleEnded = () => setIndex((i) => (i + 1) % TRACKS.length);

  return (
    <AudioCtx.Provider value={{ playing, title: TRACKS[index].title, toggle, skip }}>
      {children}
      <audio ref={audioRef} onEnded={handleEnded} preload="none" />
    </AudioCtx.Provider>
  );
}
