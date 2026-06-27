import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Play, Pause, Disc3 } from 'lucide-react';
import * as engine from '../lib/jukeboxEngine';

interface AuroJukeboxProps {
  onAudioData: (amplitude: number, active: boolean) => void;
  agentCount?: number;
  forcePause?: boolean;
}

export const AuroJukebox: React.FC<AuroJukeboxProps> = ({ onAudioData, agentCount = 8, forcePause }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [trackTitle, setTrackTitle] = useState('');
  const [playerState, setPlayerState] = useState<'loading' | 'ready' | 'error'>('loading');

  const animFrameRef = useRef<number>(0);
  const barsRef = useRef<HTMLDivElement>(null);
  const isPlayingRef = useRef(false);
  const lastGainUpdateRef = useRef(0);

  useEffect(() => {
    engine.init();
  }, []);

  useEffect(() => {
    const s = engine.getState();
    setIsPlaying(s.isPlaying);
    setTrackTitle(s.trackTitle);
    setPlayerState(s.playerState);
    isPlayingRef.current = s.isPlaying;

    return engine.subscribe(() => {
      const s2 = engine.getState();
      setIsPlaying(s2.isPlaying);
      setTrackTitle(s2.trackTitle);
      setPlayerState(s2.playerState);
      isPlayingRef.current = s2.isPlaying;
    });
  }, []);

  const togglePlay = useCallback(() => {
    engine.togglePlay();
  }, []);

  useEffect(() => {
    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      const barEl = barsRef.current;
      const playing = isPlayingRef.current;
      const ctx = engine.getAudioContext();
      const analyser = engine.getAnalyser();
      const freqData = engine.getFreqData();
      const voices = engine.getVoices();

      if (ctx && analyser && freqData) {
        const now = performance.now() / 1000;
        if (now - lastGainUpdateRef.current > 0.5) {
          lastGainUpdateRef.current = now;
          if (playing) {
            const targets = voices.map(v =>
              Math.max(0.04, Math.min(0.7, v.currentGain + (Math.random() - 0.5) * 0.25))
            );
            voices.forEach((v, i) => {
              v.currentGain = targets[i];
              v.gain.gain.setTargetAtTime(targets[i], ctx.currentTime, 0.15);
            });
          }
        }
      }

      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
      }

      const bandCount = 8;
      const totalBins = freqData ? freqData.length : 0;
      const binsPerBand = totalBins / bandCount;
      const bandValues: number[] = [];

      if (totalBins > 0 && freqData) {
        for (let b = 0; b < bandCount; b++) {
          const start = Math.floor(b * binsPerBand);
          const end = Math.floor((b + 1) * binsPerBand);
          let sum = 0;
          for (let i = start; i < end; i++) sum += freqData[i] / 255;
          bandValues.push(sum / (end - start));
        }
      } else {
        for (let b = 0; b < bandCount; b++) bandValues.push(0);
      }

      if (barEl) {
        for (let i = 0; i < bandCount; i++) {
          const bar = barEl.children[i] as HTMLElement;
          if (bar) {
            const h = Math.max(2, bandValues[i] * 20);
            bar.style.height = `${h}px`;
          }
        }
      }

      const amp = playing
        ? bandValues.reduce((s, v) => s + v, 0) / bandCount
        : 0;

      onAudioData(amp, playing);
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [onAudioData]);

  useEffect(() => {
    if (forcePause) {
      engine.pause();
    }
  }, [forcePause]);

  return (
    <>
      <div className="flex md:hidden items-center gap-1 pointer-events-auto">
        {!expanded ? (
          <>
            <button
              onClick={togglePlay}
              disabled={playerState === 'loading'}
              className="flex items-center justify-center w-7 h-7 hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default shrink-0"
            >
              {isPlaying ? (
                <Pause className="w-2.5 h-2.5 text-[#D4FF00] fill-current" />
              ) : (
                <Play className="w-2.5 h-2.5 text-neutral-400 fill-current" />
              )}
            </button>
            {isPlaying && (
              <button
                onClick={() => setExpanded(true)}
                className="text-[7px] font-mono text-[#D4FF00]/80 hover:text-[#D4FF00] transition-colors cursor-pointer bg-transparent border-0 whitespace-nowrap animate-pulse"
              >
                {agentCount} agents listening & working
              </button>
            )}
            {!isPlaying && playerState === 'loading' && (
              <span className="text-[7px] font-mono text-neutral-600">loading...</span>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => setExpanded(false)}
              className="text-[7px] font-mono text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer bg-transparent border-0 mr-0.5 shrink-0"
            >
              ←
            </button>
            <Disc3 className={`w-3 h-3 text-[#D4FF00] shrink-0 ${isPlaying ? 'animate-spin' : ''}`} />
            <div ref={barsRef} className="flex items-end gap-[1.5px] h-[20px]">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[3px] bg-[#D4FF00]/70 transition-all duration-75"
                  style={{ height: '2px', opacity: isPlaying ? 1 : 0.12 }}
                />
              ))}
            </div>
            <button
              onClick={togglePlay}
              disabled={playerState === 'loading'}
              className="flex items-center justify-center w-7 h-7 hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default shrink-0"
            >
              {isPlaying ? (
                <Pause className="w-2.5 h-2.5 text-[#D4FF00] fill-current" />
              ) : (
                <Play className="w-2.5 h-2.5 text-neutral-400 fill-current" />
              )}
            </button>
            {isPlaying && (
              <span className="text-[7px] font-mono text-[#D4FF00]/80 whitespace-nowrap animate-pulse">
                {agentCount} agents listening & working
              </span>
            )}
          </>
        )}
      </div>

      <div className="hidden md:flex items-center gap-2 pointer-events-auto max-w-[400px]">
        <Disc3 className={`w-3 h-3 text-[#D4FF00] shrink-0 ${isPlaying ? 'animate-spin' : ''}`} />

        <div className="flex flex-col leading-tight min-w-0">
          <span
            className="text-[8px] font-mono text-neutral-500 tracking-wider whitespace-nowrap"
            title="Auro Jukebox — the late-night soundtrack for agents qualifying your leads."
          >
            Auro Jukebox
          </span>
          {trackTitle && (
            <span className="text-[7px] font-mono text-neutral-400 truncate max-w-[140px]">
              {trackTitle}
            </span>
          )}
          {isPlaying && (
            <span className="text-[7px] font-mono text-[#D4FF00]/80 tracking-wider whitespace-nowrap animate-pulse">
              {agentCount} agents listening & working
            </span>
          )}
        </div>

        <div ref={barsRef} className="flex items-end gap-[1.5px] h-[20px] self-center">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="w-[3px] bg-[#D4FF00]/70 transition-all duration-75"
              style={{ height: '2px', opacity: isPlaying ? 1 : 0.12 }}
            />
          ))}
        </div>

        <button
          onClick={togglePlay}
          disabled={playerState === 'loading'}
          className="flex items-center justify-center w-7 h-7 hover:bg-white/[0.06] transition-colors cursor-pointer group disabled:opacity-40 disabled:cursor-default shrink-0 self-center"
        >
          {isPlaying ? (
            <Pause className="w-2.5 h-2.5 text-[#D4FF00] fill-current" />
          ) : (
            <Play className="w-2.5 h-2.5 text-neutral-400 fill-current group-hover:text-[#D4FF00]" />
          )}
        </button>

        {playerState === 'loading' && (
          <span className="text-[7px] font-mono text-neutral-600 self-center">loading...</span>
        )}
      </div>
    </>
  );
};
