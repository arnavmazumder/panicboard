"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

type FocusMusicContextValue = {
  isPlaying: boolean;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  togglePlayback: () => Promise<void>;
  volume: number;
};

const FocusMusicContext = createContext<FocusMusicContextValue | null>(null);

export function FocusMusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(35);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
    audio.muted = muted;
  }, [muted, volume]);

  function setVolume(nextVolume: number) {
    setVolumeState(Math.max(0, Math.min(100, Math.round(nextVolume))));
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }

  const value = useMemo(
    () => ({ isPlaying, muted, setMuted, setVolume, togglePlayback, volume }),
    [isPlaying, muted, volume]
  );

  return (
    <FocusMusicContext.Provider value={value}>
      <audio
        ref={audioRef}
        loop
        preload="metadata"
        src="/audio/focus-lofi.mp3"
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
      {children}
    </FocusMusicContext.Provider>
  );
}

export function useFocusMusic() {
  const value = useContext(FocusMusicContext);
  if (!value) throw new Error("useFocusMusic must be used inside FocusMusicProvider");
  return value;
}
