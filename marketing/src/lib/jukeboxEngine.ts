const PLAYLIST_ID = 'PLyThIJvLwidGwYBuarWc33_XriJ6WM2XJ';
const PLAYER_ID = 'auro-jukebox-player';

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
  freq: number;
  gainBase: number;
  currentGain: number;
}

let initialized = false;
let player: any = null;
let audioCtx: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let freqDataArr: Uint8Array | null = null;
let voiceList: Voice[] = [];
let lastVideoIdValue = '';
let isMusicPlaying = false;
let trackTitle = '';
let playerLoadingState: 'loading' | 'ready' | 'error' = 'loading';

const stateListeners = new Set<() => void>();

function notify() {
  stateListeners.forEach(fn => fn());
}

export function subscribe(fn: () => void): () => void {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}

export function getState() {
  return { isPlaying: isMusicPlaying, trackTitle, playerState: playerLoadingState };
}

export function getAnalyser(): AnalyserNode | null {
  return analyserNode;
}

export function getFreqData(): Uint8Array | null {
  return freqDataArr;
}

export function getVoices(): Voice[] {
  return voiceList;
}

export function getAudioContext(): AudioContext | null {
  return audioCtx;
}

function initAudioContext() {
  if (audioCtx) return;
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

    audioCtx = ctx;
    analyserNode = analyser;
    freqDataArr = freqData;
    voiceList = voices;
  } catch (e) {
    console.error('JukeboxEngine init error:', e);
  }
}

function resumeVoices(playing: boolean) {
  const ctx = audioCtx;
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  voiceList.forEach(v => {
    v.gain.gain.cancelScheduledValues(ctx.currentTime);
    if (playing) {
      v.gain.gain.setValueAtTime(0, ctx.currentTime);
    } else {
      v.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    }
  });
}

function internalRampVoices(ctx: AudioContext, targetGains: number[], timeConstant: number) {
  voiceList.forEach((v, i) => {
    v.currentGain = targetGains[i];
    v.gain.gain.setTargetAtTime(targetGains[i], ctx.currentTime, timeConstant);
  });
}

export function togglePlay() {
  initAudioContext();
  if (!player) return;
  try {
    const state = player.getPlayerState();
    if (state === 1) {
      player.pauseVideo();
    } else {
      resumeVoices(true);
      player.playVideo();
    }
  } catch (e) {
    console.error('JukeboxEngine togglePlay:', e);
  }
}

export function pause() {
  if (!player) return;
  try {
    const state = player.getPlayerState();
    if (state === 1) {
      player.pauseVideo();
    }
  } catch (_) {}
  resumeVoices(false);
}

function trackTransition() {
  const ctx = audioCtx;
  if (!ctx) return;
  const silents = voiceList.map(() => 0);
  internalRampVoices(ctx, silents, 0.02);
  setTimeout(() => {
    if (isMusicPlaying && audioCtx) {
      const restored = voiceList.map(v => v.gainBase * (0.6 + Math.random() * 0.4));
      internalRampVoices(audioCtx, restored, 0.6);
    }
  }, 400);
}

function createPlayerDiv() {
  if (!document.getElementById(PLAYER_ID)) {
    const div = document.createElement('div');
    div.id = PLAYER_ID;
    div.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:200px;height:200px;opacity:0;pointer-events:none;';
    document.body.appendChild(div);
  }
}

export function init() {
  if (initialized) return;
  initialized = true;

  createPlayerDiv();
  initAudioContext();

  const onReady = () => {
    playerLoadingState = 'ready';
    notify();
    try {
      player?.setShuffle(true);
      const pl = player?.getPlaylist();
      if (pl && pl.length > 0) {
        const randomIndex = Math.floor(Math.random() * pl.length);
        player.cuePlaylist({ listType: 'playlist', list: PLAYLIST_ID, index: randomIndex });
      }
    } catch (_) {}
  };

  const onStateChange = (event: any) => {
    if (event.data === 1) {
      isMusicPlaying = true;
      notify();
      try {
        const data = player?.getVideoData();
        if (data?.title) {
          trackTitle = data.title;
          notify();
        }
        if (data?.video_id && data.video_id !== lastVideoIdValue) {
          lastVideoIdValue = data.video_id;
          trackTransition();
        }
      } catch (_) {}
    } else if (event.data === 2) {
      isMusicPlaying = false;
      notify();
      resumeVoices(false);
    } else if (event.data === 0) {
      isMusicPlaying = false;
      notify();
      resumeVoices(false);
      setTimeout(() => {
        try {
          if (player && player.getPlayerState() === 0) {
            player.setShuffle(true);
            player.playVideo();
          }
        } catch (_) {}
      }, 200);
    } else if (event.data === -1) {
      try {
        const data = player?.getVideoData();
        if (data?.title) {
          trackTitle = data.title;
          notify();
        }
      } catch (_) {}
    }
  };

  const initPlayer = () => {
    if (player) return;
    if (!window.YT?.Player) {
      setTimeout(initPlayer, 300);
      return;
    }
    try {
      player = new window.YT.Player(PLAYER_ID, {
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
      console.error('JukeboxEngine init error:', e);
      playerLoadingState = 'error';
      notify();
    }
  };

  if (typeof window.YT === 'undefined' || typeof window.YT.Player === 'undefined') {
    window.onYouTubeIframeAPIReady = () => {
      initPlayer();
    };
    if (!document.querySelector('script[src*="iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  } else {
    initPlayer();
  }
}
