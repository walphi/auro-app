import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Play, Pause, Disc3 } from 'lucide-react';

interface AuroJukeboxProps {
  onAudioData: (amplitude: number, active: boolean) => void;
  agentCount?: number;
  forcePause?: boolean;
}

const PLAYLIST_ID = 'PLyThIJvLwidGwYBuarWc33_XriJ6WM2XJ';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | null;
  }
}

const playerId = `auro-youtube-player-${Math.random().toString(36).slice(2, 8)}`;

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
  freq: number;
  gainBase: number;
  currentGain: number;
}

export const AuroJukebox: React.FC<AuroJukeboxProps> = ({ onAudioData, agentCount = 8, forcePause }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [trackTitle, setTrackTitle] = useState('');
  const [playerState, setPlayerState] = useState<'loading' | 'ready' | 'error'>('loading');

  const playerRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const barsRef = useRef<HTMLDivElement>(null);
  const isPlayingRef = useRef(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const freqDataRef = useRef<Uint8Array | null>(null);
  const voicesRef = useRef<Voice[]>([]);
  const lastGainUpdateRef = useRef(0);
  const lastVideoIdRef = useRef('');

  function initAudio() {
    if (ctxRef.current) return;
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const freqData = new Uint8Array(analyser.frequencyBinCount);

      const voiceConfigs = [
        { freq: 55, gainBase: 0.45 },
        { freq: 110, gainBase: 0.35 },
        { freq: 220, gainBase: 0.38 },
        { freq: 440, gainBase: 0.28 },
        { freq: 880, gainBase: 0.22 },
        { freq: 1760, gainBase: 0.16 },
        { freq: 3520, gainBase: 0.12 },
        { freq: 7040, gainBase: 0.08 },
      ];

      const voices: Voice[] = voiceConfigs.map(cfg => {
        const osc = ctx.createOscillator();
        osc.type = cfg.freq < 500 ? 'sawtooth' : 'sine';
        osc.frequency.value = cfg.freq;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(analyser);
        osc.start();
        return { osc, gain, ...cfg, currentGain: 0 };
      });

      // Do NOT connect analyser to destination — silent
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      freqDataRef.current = freqData;
      voicesRef.current = voices;
      lastGainUpdateRef.current = 0;
    } catch (e) {
      console.error('AuroJukebox AudioContext init error:', e);
    }
  }

  function resumeAudioVoices(playing: boolean) {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    voicesRef.current.forEach(v => {
      v.gain.gain.cancelScheduledValues(ctx.currentTime);
      if (playing) {
        v.gain.gain.setValueAtTime(0, ctx.currentTime);
      } else {
        v.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      }
    });
  }

  function rampVoices(ctx: AudioContext, targetGains: number[], timeConstant: number) {
    voicesRef.current.forEach((v, i) => {
      v.currentGain = targetGains[i];
      v.gain.gain.setTargetAtTime(targetGains[i], ctx.currentTime, timeConstant);
    });
  }

  const togglePlay = useCallback(() => {
    initAudio();
    if (!playerRef.current) return;
    try {
      const state = playerRef.current.getPlayerState();
      if (state === 1) {
        playerRef.current.pauseVideo();
      } else {
        resumeAudioVoices(true);
        playerRef.current.playVideo();
      }
    } catch (e) {
      console.error('AuroJukebox togglePlay:', e);
    }
  }, []);

  useEffect(() => {
    let destroyed = false;

    const onReady = () => {
      if (destroyed) return;
      setPlayerState('ready');
    };

    const onStateChange = (event: any) => {
      if (destroyed) return;
      if (event.data === 1) {
        isPlayingRef.current = true;
        setIsPlaying(true);
        try {
          const data = playerRef.current?.getVideoData();
          if (data?.title) setTrackTitle(data.title);
          if (data?.video_id && data.video_id !== lastVideoIdRef.current) {
            lastVideoIdRef.current = data.video_id;
            trackTransition();
          }
        } catch (_) { /* ignore */ }
      } else if (event.data === 2 || event.data === 0) {
        isPlayingRef.current = false;
        setIsPlaying(false);
        resumeAudioVoices(false);
      } else if (event.data === -1) {
        try {
          const data = playerRef.current?.getVideoData();
          if (data?.title) setTrackTitle(data.title);
        } catch (_) { /* ignore */ }
      }
    };

    let transitionTimer: ReturnType<typeof setTimeout> | null = null;

    function trackTransition() {
      const ctx = ctxRef.current;
      if (!ctx) return;
      const silents = voicesRef.current.map(() => 0);
      rampVoices(ctx, silents, 0.02);
      if (transitionTimer) clearTimeout(transitionTimer);
      transitionTimer = setTimeout(() => {
        if (!destroyed && isPlayingRef.current) {
          const ctx2 = ctxRef.current;
          if (ctx2) {
            const restored = voicesRef.current.map(v => v.gainBase * (0.6 + Math.random() * 0.4));
            rampVoices(ctx2, restored, 0.6);
          }
        }
      }, 400);
    }

    const initPlayer = () => {
      if (destroyed || playerRef.current) return;
      if (!window.YT?.Player) {
        setTimeout(initPlayer, 300);
        return;
      }
      try {
        playerRef.current = new window.YT.Player(playerId, {
          height: '200',
          width: '200',
          playerVars: {
            listType: 'playlist',
            list: PLAYLIST_ID,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            autoplay: 0,
            rel: 0,
          },
          events: { onReady, onStateChange },
        });
      } catch (e) {
        console.error('AuroJukebox init error:', e);
        if (!destroyed) setPlayerState('error');
      }
    };

    if (typeof window.YT === 'undefined' || typeof window.YT.Player === 'undefined') {
      window.onYouTubeIframeAPIReady = () => {
        if (!destroyed) initPlayer();
      };
      if (!document.querySelector('script[src*="iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    } else {
      initPlayer();
    }

    return () => {
      destroyed = true;
      isPlayingRef.current = false;
      cancelAnimationFrame(animFrameRef.current);
      if (transitionTimer) clearTimeout(transitionTimer);
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (_) { /* ignore */ }
        playerRef.current = null;
      }
      voicesRef.current.forEach(v => {
        try { v.osc.stop(); } catch (_) { /* ignore */ }
      });
      voicesRef.current = [];
      if (ctxRef.current) {
        try { ctxRef.current.close(); } catch (_) { /* ignore */ }
        ctxRef.current = null;
      }
      analyserRef.current = null;
      freqDataRef.current = null;
    };
  }, []);

  // Pause playback when an external video takes priority
  useEffect(() => {
    if (forcePause && isPlayingRef.current) {
      try {
        playerRef.current?.pauseVideo();
      } catch (_) {}
      resumeAudioVoices(false);
    }
  }, [forcePause]);

  // Animation loop: read AnalyserNode + random-walk voice gains
  useEffect(() => {
    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      const barEl = barsRef.current;
      const playing = isPlayingRef.current;
      const ctx = ctxRef.current;
      const analyser = analyserRef.current;
      const freqData = freqDataRef.current;

      if (ctx && analyser && freqData) {
        // Random-walk voice gains for organic feel
        const now = performance.now() / 1000;
        if (now - lastGainUpdateRef.current > 0.5) {
          lastGainUpdateRef.current = now;
          if (playing) {
            const targets = voicesRef.current.map(v =>
              Math.max(0.04, Math.min(0.7, v.currentGain + (Math.random() - 0.5) * 0.25))
            );
            rampVoices(ctx, targets, 0.15);
          }
        }
      }

      // Read FFT data
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

      // Update visualizer bars
      if (barEl) {
        for (let i = 0; i < bandCount; i++) {
          const bar = barEl.children[i] as HTMLElement;
          if (bar) {
            const h = Math.max(2, bandValues[i] * 20);
            bar.style.height = `${h}px`;
          }
        }
      }

      // Overall amplitude for WebGL grass
      const amp = playing
        ? bandValues.reduce((s, v) => s + v, 0) / bandCount
        : 0;

      onAudioData(amp, playing);
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [onAudioData]);

  return (
    <>
      <div
        id={playerId}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          width: '200px',
          height: '200px',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Mobile compact pill */}
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

      {/* Desktop expanded bar */}
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
