/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Activity, Music, Upload, Play, Pause, Volume2, Info, RotateCcw } from 'lucide-react';

// 驱动源模式
type DriverMode = 'audio-fft' | 'interactive' | 'external';

// 预设主题
type PresetKey = 'red-gold' | 'green-mountain' | 'cyan-purple' | 'monochrome';

interface ColorTheme {
  primary: string;
  secondary: string;
  accent: string;
  brightStar: string;
}

const PRESETS: Record<PresetKey, ColorTheme> = {
  'red-gold': {
    primary: 'rgba(239, 68, 68, ',
    secondary: 'rgba(234, 179, 8, ',
    accent: 'rgba(249, 115, 22, ',
    brightStar: '#fffbeb',
  },
  'green-mountain': {
    primary: 'rgba(16, 185, 129, ',
    secondary: 'rgba(6, 182, 212, ',
    accent: 'rgba(234, 179, 8, ',
    brightStar: '#e0f2fe',
  },
  'cyan-purple': {
    primary: 'rgba(6, 182, 212, ',
    secondary: 'rgba(168, 85, 247, ',
    accent: 'rgba(236, 72, 153, ',
    brightStar: '#ffffff',
  },
  'monochrome': {
    primary: 'rgba(248, 250, 252, ',
    secondary: 'rgba(148, 163, 184, ',
    accent: 'rgba(71, 85, 105, ',
    brightStar: '#ffffff',
  },
};

// 辅助色彩采样函数：全息量子点阵色彩映射
function getHoloColor(rawNormX: number, alpha: number): string {
  const normX = Math.max(0, Math.min(1, rawNormX));
  let r: number, g: number, b: number;
  if (normX < 0.25) {
    const t = normX / 0.25;
    r = Math.round(236 + t * (139 - 236));
    g = Math.round(72 + t * (92 - 72));
    b = Math.round(153 + t * (246 - 153));
  } else if (normX < 0.55) {
    const t = (normX - 0.25) / 0.3;
    r = Math.round(139 + t * (6 - 139));
    g = Math.round(92 + t * (182 - 92));
    b = Math.round(246 + t * (212 - 246));
  } else if (normX < 0.8) {
    const t = (normX - 0.55) / 0.25;
    r = Math.round(6 + t * (234 - 6));
    g = Math.round(182 + t * (179 - 182));
    b = Math.round(212 + t * (8 - 212));
  } else {
    const t = Math.min(1.0, (normX - 0.8) / 0.2);
    r = Math.round(234 + t * (255 - 234));
    g = Math.round(179 + t * (255 - 179));
    b = Math.round(8 + t * (255 - 8));
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 示范音乐文件源（取自 minge 目录）
const DEMO_AUDIO_URL = '/minge/' + encodeURIComponent('大别山民歌《八月桂花遍地开》.mp3');
const DEMO_AUDIO_FALLBACK = '/' + encodeURIComponent('大别山民歌《八月桂花遍地开》.mp3');

// 凝聚态情绪粒子类
class MoodSwarmParticle {
  angle: number = 0;
  radius: number = 0;
  x: number = 0;
  y: number = 0;
  vx: number = 0;
  vy: number = 0;
  size: number = 1;
  life: number = 100;
  maxLife: number = 100;
  speedMult: number = 0.02;

  constructor(initX: number, initY: number) {
    this.reset(initX, initY);
  }

  reset(initX: number, initY: number) {
    this.angle = Math.random() * Math.PI * 2;
    this.radius = Math.random() * 80 + 10;
    this.x = initX + Math.cos(this.angle) * this.radius;
    this.y = initY + Math.sin(this.angle) * this.radius;
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = (Math.random() - 0.5) * 1.5;
    this.size = Math.random() * 2.2 + 0.6;
    this.life = Math.random() * 100 + 100;
    this.maxLife = this.life;
    this.speedMult = Math.random() * 0.03 + 0.01;
  }

  update(targetX: number, targetY: number, audioEnergy: number, audioBass: number, speed: number) {
    this.life--;
    if (this.life <= 0) {
      this.life = Math.random() * 100 + 100;
      this.maxLife = this.life;
      this.radius = Math.random() * 60 + 5;
    }

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const pullForce = (0.018 + audioEnergy * 0.01) * Math.min(dist, 150);
    this.vx += (dx / (dist + 0.1)) * pullForce;
    this.vy += (dy / (dist + 0.1)) * pullForce;

    this.angle += this.speedMult * speed;
    const orbitTargetX = targetX + Math.cos(this.angle) * (this.radius * (1.0 + audioBass * 0.4));
    const orbitTargetY = targetY + Math.sin(this.angle) * (this.radius * (1.0 + audioBass * 0.4));

    this.vx += (orbitTargetX - this.x) * 0.05 * speed;
    this.vy += (orbitTargetY - this.y) * 0.05 * speed;

    this.vx *= 0.88;
    this.vy *= 0.88;

    this.x += this.vx;
    this.y += this.vy;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    currentVal: number,
    currentAr: number,
    treble: number,
    energy: number,
    globalTime: number
  ) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const alpha = Math.min(1.0, this.life / 30);

    let r: number, g: number, b: number;
    if (currentVal >= 0 && currentAr >= 0) {
      // Q1：激情/高昂 - 金黄色
      r = 245;
      g = Math.round(180 + Math.sin(globalTime * 0.1) * 30);
      b = 30;
    } else if (currentVal < 0 && currentAr >= 0) {
      // Q2：紧张/悲壮 - 烈焰红
      r = 239;
      g = Math.round(68 + Math.cos(globalTime * 0.1) * 40);
      b = 40;
    } else if (currentVal < 0 && currentAr < 0) {
      // Q3：悲怆/沉思 - 蓝紫色
      r = 139;
      g = 50;
      b = 240;
    } else {
      // Q4：宁静/安详 - 革命青绿
      r = 16;
      g = 185;
      b = 129;
    }

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.9})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * (1.0 + treble * 0.8), 0, Math.PI * 2);
    ctx.fill();

    if (this.size > 1.8 && energy > 0.6) {
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.15})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

declare global {
  interface Window {
    setRussellMood?: (valence: number, arousal: number) => void;
  }
}

export default function App() {
  // DOM Refs
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const emotionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const beatCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rhythmCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  // States
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [driverMode, setDriverMode] = useState<DriverMode>('audio-fft');
  const [trackTitle, setTrackTitle] = useState<string>('{ 大别山民歌《八月桂花遍地开》 }');
  const [trackSubtitle, setTrackSubtitle] = useState<string>(
    '大别山经典民歌原声 · 待机就绪（点击播放示范音乐或上传本地音频）'
  );
  const [liveStatus, setLiveStatus] = useState<string>('STANDBY');
  const [driverStatusText, setDriverStatusText] = useState<string>('罗素情绪环解调中...');
  const [toastMessage, setToastMessage] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);
  const [fpsText, setFpsText] = useState<string>('60 FPS');

  // Real-time parameters display
  const [hudValence, setHudValence] = useState<string>('0.00');
  const [hudArousal, setHudArousal] = useState<string>('0.00');
  const [bassVal, setBassVal] = useState<string>('0.00');
  const [midVal, setMidVal] = useState<string>('0.00');
  const [trebleVal, setTrebleVal] = useState<string>('0.00');
  const [energyVal, setEnergyVal] = useState<string>('0.00');

  // Sliders
  const [volume, setVolume] = useState<number>(0.7);
  const [sensitivity, setSensitivity] = useState<number>(1.2);
  const [speedMult, setSpeedMult] = useState<number>(1.0);

  // Internal mutable state refs to avoid React render lag in 60 FPS animation
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const uploadedAudioRef = useRef<HTMLAudioElement | null>(null);
  const demoAudioRef = useRef<HTMLAudioElement | null>(null);
  const demoSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioTypeRef = useRef<'none' | 'demo' | 'file'>('none');
  const isPlayingRef = useRef<boolean>(false);
  const driverModeRef = useRef<DriverMode>('audio-fft');
  const presetRef = useRef<PresetKey>('red-gold');
  const volumeRef = useRef<number>(0.7);
  const sensitivityRef = useRef<number>(1.2);
  const speedMultRef = useRef<number>(1.0);

  // Synth state
  const synthIntervalRef = useRef<NodeJS.Timeout | number | null>(null);
  const synthStepRef = useRef<number>(0);
  const synthTempo = 115;

  // Analysis & Math State
  const moodCoordRef = useRef({
    valence: 0.0,
    arousal: 0.0,
    targetValence: 0.0,
    targetArousal: 0.0,
  });
  const moodHistoryRef = useRef<{ x: number; y: number }[]>([]);
  const rmsHistoryRef = useRef<number[]>([]);
  const onsetHistoryRef = useRef<number[]>([]);
  const prevEnergyRef = useRef<number>(0);
  const prevFreqDataRef = useRef<Uint8Array | null>(null);
  const onsetEnvelopeRef = useRef<number>(0);
  const smoothBandwidthHzRef = useRef<number>(2200);
  const smoothCentroidHzRef = useRef<number>(1800);
  const beatAnimValueRef = useRef<number>(0);
  const globalTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const particlesRef = useRef<MoodSwarmParticle[]>([]);
  const isMouseDownRef = useRef<boolean>(false);

  // Holographic wave structures for RMS
  const waveBlobsRef = useRef([
    { x: 80, y: 50, rx: 60, ry: 40, vx: 0.15, vy: 0.08, color: 'rgba(10, 45, 245, 0.28)' },
    { x: 180, y: 90, rx: 50, ry: 50, vx: -0.1, vy: 0.12, color: 'rgba(139, 24, 235, 0.25)' },
    { x: 120, y: 70, rx: 45, ry: 45, vx: 0.08, vy: -0.1, color: 'rgba(235, 45, 150, 0.22)' },
  ]);
  const colHeightsRef = useRef<number[]>([]);
  const localWaveParticlesRef = useRef<
    {
      colIdx: number;
      targetRatio: number;
      size: number;
      vibrationSpeed: number;
      pulsePhase: number;
    }[]
  >([]);

  // Sync ref values
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    driverModeRef.current = driverMode;
  }, [driverMode]);
  useEffect(() => {
    volumeRef.current = volume;
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(volume, audioCtxRef.current.currentTime);
    }
  }, [volume]);
  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);
  useEffect(() => {
    speedMultRef.current = speedMult;
  }, [speedMult]);

  // Toast trigger
  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    const t = setTimeout(() => setShowToast(false), 3200);
    return () => clearTimeout(t);
  }, []);

  // Initialize Web Audio
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const gainNode = ctx.createGain();
      gainNode.gain.value = volumeRef.current;

      gainNode.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      gainNodeRef.current = gainNode;
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  // Stop Demo
  const stopDemoTrack = useCallback(() => {
    if (synthIntervalRef.current) {
      clearTimeout(synthIntervalRef.current as NodeJS.Timeout);
      synthIntervalRef.current = null;
    }
    if (demoAudioRef.current) {
      demoAudioRef.current.pause();
    }
    if (audioTypeRef.current === 'demo') {
      setIsPlaying(false);
      setLiveStatus('PAUSED');
    }
  }, []);

  // Synth Step Trigger for { 八月桂花遍地开 }
  const triggerSynthStep = useCallback((step: number, time: number) => {
    const audioCtx = audioCtxRef.current;
    const gainNode = gainNodeRef.current;
    if (!audioCtx || !gainNode) return;

    // 战鼓 (Kick)
    if (step % 4 === 0) {
      const osc = audioCtx.createOscillator();
      const kickGain = audioCtx.createGain();
      osc.connect(kickGain);
      kickGain.connect(gainNode);

      osc.frequency.setValueAtTime(140, time);
      osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.35);

      kickGain.gain.setValueAtTime(1.3, time);
      kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

      osc.start(time);
      osc.stop(time + 0.35);
    }

    // 铜钹/沙锤 (Hats)
    if (step % 4 === 2 || step === 15) {
      const bufferSize = audioCtx.sampleRate * 0.08;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = audioCtx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 6000;

      const hatGain = audioCtx.createGain();
      noiseNode.connect(filter);
      filter.connect(hatGain);
      hatGain.connect(gainNode);

      hatGain.gain.setValueAtTime(0.25, time);
      hatGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

      noiseNode.start(time);
      noiseNode.stop(time + 0.08);
    }

    // 大别山红色旋律五声音阶
    const pentatonic = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
    let playMelody = false;
    let noteIndex = 0;
    let duration = 0.25;

    if (step === 0) {
      noteIndex = 5;
      playMelody = true;
      duration = 0.35;
    } else if (step === 2) {
      noteIndex = 4;
      playMelody = true;
      duration = 0.18;
    } else if (step === 4) {
      noteIndex = 5;
      playMelody = true;
      duration = 0.35;
    } else if (step === 6) {
      noteIndex = 7;
      playMelody = true;
      duration = 0.18;
    } else if (step === 8) {
      noteIndex = 6;
      playMelody = true;
      duration = 0.35;
    } else if (step === 10) {
      noteIndex = 5;
      playMelody = true;
      duration = 0.18;
    } else if (step === 12) {
      noteIndex = 4;
      playMelody = true;
      duration = 0.35;
    } else if (step === 14) {
      noteIndex = 3;
      playMelody = true;
      duration = 0.18;
    }

    if (playMelody) {
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const filter = audioCtx.createBiquadFilter();
      const melodyGain = audioCtx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sine';

      const targetFreq = pentatonic[noteIndex];
      osc1.frequency.setValueAtTime(targetFreq, time);
      osc1.frequency.linearRampToValueAtTime(targetFreq * 1.005, time + duration);
      osc2.frequency.setValueAtTime(targetFreq * 2.0, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, time);
      filter.frequency.exponentialRampToValueAtTime(400, time + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(melodyGain);
      melodyGain.connect(gainNode);

      melodyGain.gain.setValueAtTime(0.35, time);
      melodyGain.gain.linearRampToValueAtTime(0.3, time + 0.04);
      melodyGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration);
      osc2.stop(time + duration);
    }
  }, []);

  // Play Demo Track (以 minge 文件夹中的大别山民歌《八月桂花遍地开》音频为示范音乐)
  const playDemoTrack = useCallback(() => {
    initAudio();
    if (uploadedAudioRef.current) {
      uploadedAudioRef.current.pause();
    }
    if (synthIntervalRef.current) {
      clearTimeout(synthIntervalRef.current as NodeJS.Timeout);
      synthIntervalRef.current = null;
    }

    audioTypeRef.current = 'demo';
    setIsPlaying(true);
    setLiveStatus('RED TUNES');
    setTrackTitle('{ 大别山民歌《八月桂花遍地开》 }');
    setTrackSubtitle('大别山经典红色民歌原声 · 罗素情绪空间实时解调分析');

    let audioEl = demoAudioRef.current;
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.src = DEMO_AUDIO_URL;
      audioEl.crossOrigin = 'anonymous';
      audioEl.loop = true;
      demoAudioRef.current = audioEl;

      audioEl.onended = () => {
        setIsPlaying(false);
        setLiveStatus('PAUSED');
      };
      audioEl.onerror = () => {
        if (audioEl && audioEl.src !== DEMO_AUDIO_FALLBACK) {
          audioEl.src = DEMO_AUDIO_FALLBACK;
          audioEl.play().catch(console.warn);
        }
      };
    }

    // 接入 Web Audio API 频谱分析节点
    if (!demoSourceNodeRef.current && audioCtxRef.current && gainNodeRef.current) {
      try {
        demoSourceNodeRef.current = audioCtxRef.current.createMediaElementSource(audioEl);
        demoSourceNodeRef.current.connect(gainNodeRef.current);
      } catch (err) {
        console.warn('Demo audio source node connect notice:', err);
      }
    }

    audioEl
      .play()
      .then(() => {
        triggerToast('正在播放示范音乐：大别山民歌《八月桂花遍地开》');
      })
      .catch((err) => {
        console.warn('Playback interrupted or requires user interaction:', err);
        triggerToast('请点击下方播放键开始播放示范民歌');
      });
  }, [initAudio, triggerToast]);

  // Toggle Play / Pause
  const handleTogglePlay = useCallback(() => {
    initAudio();
    if (audioTypeRef.current === 'none') {
      playDemoTrack();
      return;
    }
    if (isPlayingRef.current) {
      if (audioTypeRef.current === 'demo') {
        stopDemoTrack();
      } else if (audioTypeRef.current === 'file' && uploadedAudioRef.current) {
        uploadedAudioRef.current.pause();
      }
      setIsPlaying(false);
      setLiveStatus('PAUSED');
    } else {
      if (audioTypeRef.current === 'demo') {
        playDemoTrack();
      } else if (audioTypeRef.current === 'file' && uploadedAudioRef.current) {
        uploadedAudioRef.current.play().catch(console.error);
        setIsPlaying(true);
        setLiveStatus('RUNNING');
      }
    }
  }, [initAudio, playDemoTrack, stopDemoTrack]);

  // 恢复默认控制参数
  const handleResetDefaults = useCallback(() => {
    setVolume(0.7);
    setSensitivity(1.2);
    setSpeedMult(1.0);
    moodCoordRef.current.targetValence = 0.0;
    moodCoordRef.current.targetArousal = 0.0;
    triggerToast('已恢复默认控制参数 (音量 70% · 增益 1.2x · 自旋 1.0x)');
  }, [triggerToast]);

  // Audio File Upload
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const file = files[0];
      const fileURL = URL.createObjectURL(file);

      stopDemoTrack();

      if (uploadedAudioRef.current) {
        uploadedAudioRef.current.pause();
        uploadedAudioRef.current.src = '';
      }

      initAudio();

      const audioEl = new Audio();
      audioEl.src = fileURL;
      uploadedAudioRef.current = audioEl;

      try {
        if (sourceNodeRef.current) {
          sourceNodeRef.current.disconnect();
        }
        if (audioCtxRef.current && gainNodeRef.current) {
          sourceNodeRef.current = audioCtxRef.current.createMediaElementSource(audioEl);
          sourceNodeRef.current.connect(gainNodeRef.current);
        }
      } catch (err) {
        console.warn('Audio node connection notice:', err);
      }

      audioTypeRef.current = 'file';
      setIsPlaying(true);
      audioEl
        .play()
        .then(() => {
          setLiveStatus('DECODING FILE');
        })
        .catch(() => {
          triggerToast('浏览器拦截了自动播放，请点击下方播放按钮开始');
        });

      const cleanedTitle = file.name.replace(/\.[^/.]+$/, '');
      setTrackTitle(`{ ${cleanedTitle} }`);
      setTrackSubtitle('正在通过罗素象限数轴解调仪解析经典旋律包络');
      triggerToast(`成功解析红色民歌音频: ${cleanedTitle}`);
    },
    [initAudio, stopDemoTrack, triggerToast]
  );

  // External Mood Control API
  useEffect(() => {
    window.setRussellMood = (val: number, ar: number) => {
      moodCoordRef.current.targetValence = Math.max(-1, Math.min(1, Number(val) || 0));
      moodCoordRef.current.targetArousal = Math.max(-1, Math.min(1, Number(ar) || 0));
      setDriverMode('external');
      triggerToast(`外部数据已连接: [效价: ${Number(val).toFixed(2)}, 唤醒: ${Number(ar).toFixed(2)}]`);
    };
    return () => {
      delete window.setRussellMood;
    };
  }, [triggerToast]);

  // Update driver mode status message
  useEffect(() => {
    if (driverMode === 'audio-fft') {
      setDriverStatusText('罗素情绪自动萃取器 (FFT驱动中...)');
    } else if (driverMode === 'interactive') {
      setDriverStatusText('手动交互定位 (鼠标拖拽中...)');
    } else {
      setDriverStatusText('外部集成数据终端 (数据联动中...)');
    }
  }, [driverMode]);

  // Interactive Drag & Click handling on Main Canvas
  const handleInteractiveCoord = useCallback((clientX: number, clientY: number) => {
    if (driverModeRef.current !== 'interactive' || !mainCanvasRef.current) return;
    const canvas = mainCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    const cx = rect.width / 2;
    const cy = (rect.height - 36) / 2 + 6;
    const radius = Math.min(cx, cy) * 0.60;

    const val = (clickX - cx) / radius;
    const ar = (cy - clickY) / radius;

    moodCoordRef.current.targetValence = Math.max(-1, Math.min(1, val));
    moodCoordRef.current.targetArousal = Math.max(-1, Math.min(1, ar));
  }, []);

  // Main Animation and Audio Loop
  useEffect(() => {
    // Initialize Particles
    const particles: MoodSwarmParticle[] = [];
    for (let i = 0; i < 320; i++) {
      particles.push(new MoodSwarmParticle(300, 200));
    }
    particlesRef.current = particles;

    let animFrameId: number;
    const freqData = new Uint8Array(256);
    const timeData = new Uint8Array(256);

    const mainLoop = (timestamp: number) => {
      const delta = timestamp - lastFrameTimeRef.current;
      lastFrameTimeRef.current = timestamp;

      // Update FPS every 20 frames
      if (Math.floor(timestamp / 500) !== Math.floor((timestamp - delta) / 500)) {
        const fps = Math.round(1000 / (delta || 16));
        setFpsText(`${fps} FPS`);
      }

      globalTimeRef.current += delta * 0.05;
      const gTime = globalTimeRef.current;

      // Signal Analysis
      let bass = 0;
      let mid = 0;
      let treble = 0;
      let energy = 0;
      const sens = sensitivityRef.current;

      const analyser = analyserRef.current;
      if (analyser && isPlayingRef.current) {
        analyser.getByteFrequencyData(freqData);
        analyser.getByteTimeDomainData(timeData);

        const bufLen = analyser.frequencyBinCount;
        const bassRange = Math.floor(bufLen * 0.15);
        const midRange = Math.floor(bufLen * 0.6);

        let bSum = 0;
        let mSum = 0;
        let tSum = 0;

        for (let i = 0; i < bufLen; i++) {
          const val = freqData[i] / 255;
          if (i < bassRange) bSum += val;
          else if (i < midRange) mSum += val;
          else tSum += val;
        }

        bass = (bSum / (bassRange || 1)) * sens;
        mid = (mSum / (midRange - bassRange || 1)) * sens;
        treble = (tSum / (bufLen - midRange || 1)) * sens;
        energy = bass * 0.4 + mid * 0.4 + treble * 0.2;
      } else {
        bass = (0.15 + Math.sin(gTime * 0.05) * 0.1) * sens;
        mid = (0.2 + Math.cos(gTime * 0.03) * 0.15) * sens;
        treble = (0.18 + Math.sin(gTime * 0.08) * 0.12) * sens;
        energy = bass * 0.4 + mid * 0.4 + treble * 0.2;
      }

      if (bass > 0.8 && bass > beatAnimValueRef.current) {
        beatAnimValueRef.current = bass;
      } else {
        beatAnimValueRef.current *= 0.92;
      }

      // Update HUD signals throttle
      if (Math.floor(gTime) % 3 === 0) {
        setBassVal(bass.toFixed(2));
        setMidVal(mid.toFixed(2));
        setTrebleVal(treble.toFixed(2));
        setEnergyVal(energy.toFixed(2));
      }

      const audioData = {
        bass: Math.min(2, bass),
        mid: Math.min(2, mid),
        treble: Math.min(2, treble),
        energy: Math.min(2, energy),
        speed: speedMultRef.current * (1.0 + energy * 0.6),
      };

      // 1. Draw Main Visualizer
      const mainCanvas = mainCanvasRef.current;
      if (mainCanvas) {
        const ctx = mainCanvas.getContext('2d');
        if (ctx) {
          const w = mainCanvas.width;
          const h = mainCanvas.height;

          ctx.fillStyle = 'rgba(3, 5, 8, 0.25)';
          ctx.fillRect(0, 0, w, h);

          // Update Mood Coord
          const mode = driverModeRef.current;
          if (mode === 'audio-fft') {
            if (isPlayingRef.current) {
              const targetV =
                Math.sin(gTime * 0.02) * 0.2 + (audioData.mid + audioData.treble - audioData.bass) * 0.4;
              const targetA = audioData.energy * 1.2 + audioData.bass * 0.5 - 0.7;
              moodCoordRef.current.targetValence = Math.max(-1, Math.min(1, targetV));
              moodCoordRef.current.targetArousal = Math.max(-1, Math.min(1, targetA));
            } else {
              moodCoordRef.current.targetValence = Math.sin(gTime * 0.01) * 0.3;
              moodCoordRef.current.targetArousal = Math.cos(gTime * 0.012) * 0.3;
            }
          }

          moodCoordRef.current.valence +=
            (moodCoordRef.current.targetValence - moodCoordRef.current.valence) * 0.08;
          moodCoordRef.current.arousal +=
            (moodCoordRef.current.targetArousal - moodCoordRef.current.arousal) * 0.08;

          if (Math.floor(gTime) % 3 === 0) {
            setHudValence(moodCoordRef.current.valence.toFixed(2));
            setHudArousal(moodCoordRef.current.arousal.toFixed(2));
          }

          const cx = w / 2;
          const cy = (h - 36) / 2 + 6;
          const radius = Math.min(cx, cy) * 0.60;

          ctx.save();
          // Circles
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.15)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.arc(cx, cy, radius * 0.66, 0, Math.PI * 2);
          ctx.arc(cx, cy, radius * 0.33, 0, Math.PI * 2);
          ctx.stroke();

          // Axis cross
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(cx - radius * 1.15, cy);
          ctx.lineTo(cx + radius * 1.15, cy);
          ctx.moveTo(cx, cy - radius * 1.15);
          ctx.lineTo(cx, cy + radius * 1.15);
          ctx.stroke();
          ctx.setLineDash([]);

          // Labels
          ctx.fillStyle = 'rgba(226, 232, 240, 0.5)';
          ctx.font = '10px "Share Tech Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          ctx.fillText('愉悦 + (VALENCE)', cx + radius * 0.85, cy - 12);
          ctx.fillText('不愉悦 -', cx - radius * 0.85, cy - 12);
          ctx.fillText('高唤醒 + (AROUSAL)', cx, cy - radius * 1.05);
          ctx.fillText('低唤醒 -', cx, cy + radius * 1.05);

          // Quadrants
          ctx.font = '11px "Noto Sans SC", sans-serif';
          ctx.fillStyle = 'rgba(234, 179, 8, 0.35)';
          ctx.fillText('第一象限：激情 / 激昂', cx + radius * 0.5, cy - radius * 0.5);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
          ctx.fillText('第二象限：紧张 / 烈焰', cx - radius * 0.5, cy - radius * 0.5);
          ctx.fillStyle = 'rgba(168, 85, 247, 0.35)';
          ctx.fillText('第三象限：悲怆 / 沉思', cx - radius * 0.5, cy + radius * 0.5);
          ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
          ctx.fillText('第四象限：宁静 / 悠远', cx + radius * 0.5, cy + radius * 0.5);

          const targetPx = cx + moodCoordRef.current.valence * radius;
          const targetPy = cy - moodCoordRef.current.arousal * radius;

          // Trailing line
          moodHistoryRef.current.push({ x: targetPx, y: targetPy });
          if (moodHistoryRef.current.length > 40) moodHistoryRef.current.shift();

          if (moodHistoryRef.current.length > 1) {
            ctx.beginPath();
            for (let i = 0; i < moodHistoryRef.current.length; i++) {
              const pt = moodHistoryRef.current[i];
              if (i === 0) ctx.moveTo(pt.x, pt.y);
              else ctx.lineTo(pt.x, pt.y);
            }
            const trailGrad = ctx.createLinearGradient(
              moodHistoryRef.current[0].x,
              moodHistoryRef.current[0].y,
              targetPx,
              targetPy
            );
            trailGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
            trailGrad.addColorStop(1, 'rgba(234, 179, 8, 0.6)');
            ctx.strokeStyle = trailGrad;
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // Particles
          particlesRef.current.forEach((p) => {
            p.update(targetPx, targetPy, audioData.energy, audioData.bass, audioData.speed);
            p.draw(
              ctx,
              moodCoordRef.current.valence,
              moodCoordRef.current.arousal,
              audioData.treble,
              audioData.energy,
              gTime
            );
          });

          // Focus glow
          const pulseRadius = 12 + Math.sin(gTime * 0.1) * 4 + audioData.bass * 8;
          const focusGrad = ctx.createRadialGradient(
            targetPx,
            targetPy,
            0,
            targetPx,
            targetPy,
            pulseRadius * 2
          );
          focusGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
          focusGrad.addColorStop(0.3, 'rgba(239, 68, 68, 0.6)');
          focusGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');

          ctx.fillStyle = focusGrad;
          ctx.beginPath();
          ctx.arc(targetPx, targetPy, pulseRadius * 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = PRESETS[presetRef.current].brightStar;
          ctx.beginPath();
          ctx.arc(targetPx, targetPy, 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }

      // 2. Sub-canvas 1: RMS Energy Mean
      const waveCanvas = waveCanvasRef.current;
      if (waveCanvas) {
        const ctxWave = waveCanvas.getContext('2d');
        if (ctxWave) {
          const w = waveCanvas.width;
          const h = waveCanvas.height;

          ctxWave.fillStyle = '#030508';
          ctxWave.fillRect(0, 0, w, h);

          let rmsVal = 0;
          if (analyser && isPlayingRef.current) {
            let sum = 0;
            for (let i = 0; i < timeData.length; i++) {
              const sample = timeData[i] / 128.0 - 1.0;
              sum += sample * sample;
            }
            rmsVal = Math.sqrt(sum / (timeData.length || 1)) * sens * 1.5;
          } else {
            rmsVal = 0.15 + Math.sin(gTime * 0.06) * 0.08;
            if (isPlayingRef.current && audioTypeRef.current === 'demo') {
              rmsVal += synthStepRef.current % 4 === 0 ? 0.35 : 0.06;
            }
          }

          rmsHistoryRef.current.push(rmsVal);
          if (rmsHistoryRef.current.length > 40) rmsHistoryRef.current.shift();
          const meanRms =
            rmsHistoryRef.current.reduce((a, b) => a + b, 0) / rmsHistoryRef.current.length;

          // Holographic blobs
          ctxWave.save();
          ctxWave.globalCompositeOperation = 'screen';
          waveBlobsRef.current.forEach((blob) => {
            blob.x += blob.vx * audioData.speed;
            blob.y += blob.vy * audioData.speed;
            if (blob.x < 30 || blob.x > w - 30) blob.vx *= -1;
            if (blob.y < 30 || blob.y > h - 30) blob.vy *= -1;

            const scale = 1.0 + rmsVal * 1.2;
            const rx = blob.rx * scale;
            const ry = blob.ry * scale;

            const grad = ctxWave.createRadialGradient(
              blob.x,
              blob.y,
              2,
              blob.x,
              blob.y,
              Math.max(rx, ry)
            );
            grad.addColorStop(0, blob.color);
            grad.addColorStop(0.5, blob.color.replace('0.28', '0.08'));
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctxWave.fillStyle = grad;
            ctxWave.beginPath();
            ctxWave.ellipse(blob.x, blob.y, rx, ry, gTime * 0.005, 0, Math.PI * 2);
            ctxWave.fill();
          });
          ctxWave.restore();

          // Frequency columns
          const numCols = 38;
          const colWidth = w / numCols;
          if (colHeightsRef.current.length !== numCols) {
            colHeightsRef.current = new Array(numCols).fill(0);
          }

          for (let c = 0; c < numCols; c++) {
            let targetVal = 0;
            if (analyser && isPlayingRef.current) {
              const binIdx = Math.floor((c / numCols) * (freqData.length * 0.75));
              targetVal = freqData[binIdx] || 0;
            } else {
              targetVal =
                45 +
                Math.sin(c * 0.38 + gTime * 0.07) * 35 +
                Math.cos(c * 0.15 - gTime * 0.04) * 20;
              targetVal = Math.max(0, targetVal);
            }
            colHeightsRef.current[c] =
              colHeightsRef.current[c] * 0.72 + targetVal * (0.4 + rmsVal * 1.5) * 0.28;
          }

          // Quantum particles
          if (localWaveParticlesRef.current.length === 0) {
            for (let i = 0; i < 900; i++) {
              localWaveParticlesRef.current.push({
                colIdx: Math.floor(Math.random() * numCols),
                targetRatio: Math.random(),
                size: Math.random() > 0.85 ? 1.4 : 0.8,
                vibrationSpeed: 0.12 + Math.random() * 0.25,
                pulsePhase: Math.random() * Math.PI * 2,
              });
            }
          }

          ctxWave.save();
          ctxWave.globalCompositeOperation = 'lighter';

          // Mean line
          const meanY = h - Math.min(h * 0.85, meanRms * h * 0.8);
          ctxWave.strokeStyle = 'rgba(34, 211, 238, 0.85)';
          ctxWave.lineWidth = 1.5;
          ctxWave.setLineDash([4, 3]);
          ctxWave.beginPath();
          ctxWave.moveTo(0, meanY);
          ctxWave.lineTo(w, meanY);
          ctxWave.stroke();
          ctxWave.setLineDash([]);

          ctxWave.fillStyle = '#22d3ee';
          ctxWave.font = 'bold 11px "Share Tech Mono", monospace';
          ctxWave.textAlign = 'right';
          ctxWave.fillText(`MEAN: ${(meanRms * 100).toFixed(1)} dB`, w - 8, Math.max(16, meanY - 5));

          for (let i = 0; i < localWaveParticlesRef.current.length; i++) {
            const p = localWaveParticlesRef.current[i];
            const hVal = colHeightsRef.current[p.colIdx];
            const pX = (p.colIdx + 0.5) * colWidth;
            const normX = pX / w;
            const comb = 0.25 + 0.75 * Math.pow(Math.abs(Math.sin(normX * Math.PI * 4)), 3);
            const peakHeight = (hVal / 255) * (h * 0.82) * comb * sens;
            const baseY = h - p.targetRatio * peakHeight;
            const jitterY = Math.sin(gTime * p.vibrationSpeed + p.pulsePhase) * (1.2 + rmsVal * 3);

            const colStr = getHoloColor(normX, 0.55 + Math.sin(gTime * 0.1 + p.pulsePhase) * 0.2);
            ctxWave.fillStyle = colStr;
            ctxWave.beginPath();
            ctxWave.arc(pX, baseY + jitterY, p.size, 0, Math.PI * 2);
            ctxWave.fill();
          }
          ctxWave.restore();
        }
      }

      // 3. Sub-canvas 2: Spectral Bandwidth Hz
      const emotionCanvas = emotionCanvasRef.current;
      if (emotionCanvas) {
        const ctxEmotion = emotionCanvas.getContext('2d');
        if (ctxEmotion) {
          const w = emotionCanvas.width;
          const h = emotionCanvas.height;
          ctxEmotion.fillStyle = '#030508';
          ctxEmotion.fillRect(0, 0, w, h);

          const sampleRate = audioCtxRef.current ? audioCtxRef.current.sampleRate : 44100;
          const nyquist = sampleRate / 2;
          const binHz = nyquist / (freqData.length || 256);

          let rawBandwidth = 2200;
          if (analyser && isPlayingRef.current) {
            let sumAmp = 0;
            let weightedSum = 0;
            for (let i = 0; i < freqData.length; i++) {
              const amp = freqData[i];
              sumAmp += amp;
              weightedSum += i * binHz * amp;
            }
            const centroidHz = sumAmp > 0 ? weightedSum / sumAmp : 1500;
            let varianceSum = 0;
            for (let i = 0; i < freqData.length; i++) {
              const amp = freqData[i];
              const diff = i * binHz - centroidHz;
              varianceSum += diff * diff * amp;
            }
            rawBandwidth = sumAmp > 0 ? Math.sqrt(varianceSum / sumAmp) : 1800;
          } else {
            rawBandwidth = 1800 + Math.sin(gTime * 0.04) * 600 + audioData.energy * 800;
          }

          smoothBandwidthHzRef.current += (rawBandwidth - smoothBandwidthHzRef.current) * 0.08;
          const cx = w / 2;
          const cy = h / 2;
          const radius = Math.min(cx, cy) * 0.72;

          ctxEmotion.save();
          ctxEmotion.translate(cx, cy);

          ctxEmotion.strokeStyle = 'rgba(234, 179, 8, 0.08)';
          ctxEmotion.lineWidth = 1;
          ctxEmotion.beginPath();
          ctxEmotion.arc(0, 0, radius * 1.1, 0, Math.PI * 2);
          ctxEmotion.stroke();

          const normBw = Math.min(1.0, smoothBandwidthHzRef.current / 8000);
          const startAngle = Math.PI * 0.75;
          const sweepAngle = Math.PI * 1.5 * normBw;

          ctxEmotion.strokeStyle = 'rgba(234, 179, 8, 0.15)';
          ctxEmotion.lineWidth = 6;
          ctxEmotion.beginPath();
          ctxEmotion.arc(0, 0, radius * 0.8, Math.PI * 0.75, Math.PI * 2.25);
          ctxEmotion.stroke();

          const bwGrad = ctxEmotion.createConicGradient(startAngle, 0, 0);
          bwGrad.addColorStop(0, '#eab308');
          bwGrad.addColorStop(1, '#f97316');
          ctxEmotion.strokeStyle = bwGrad;
          ctxEmotion.lineWidth = 6;
          ctxEmotion.beginPath();
          ctxEmotion.arc(0, 0, radius * 0.8, startAngle, startAngle + sweepAngle);
          ctxEmotion.stroke();

          ctxEmotion.fillStyle = '#fffbeb';
          ctxEmotion.font = 'bold 15px "Share Tech Mono", monospace';
          ctxEmotion.textAlign = 'center';
          ctxEmotion.textBaseline = 'middle';
          ctxEmotion.fillText(`${Math.round(smoothBandwidthHzRef.current)}`, 0, -2);

          ctxEmotion.fillStyle = 'rgba(234, 179, 8, 0.7)';
          ctxEmotion.font = '9px "Share Tech Mono", sans-serif';
          ctxEmotion.fillText('HZ BANDWIDTH', 0, 16);

          ctxEmotion.restore();
        }
      }

      // 4. Sub-canvas 3: Onset Strength (音符起始强度：多频带瞬态通量与高频律动增强)
      const beatCanvas = beatCanvasRef.current;
      if (beatCanvas) {
        const ctxBeat = beatCanvas.getContext('2d');
        if (ctxBeat) {
          const w = beatCanvas.width;
          const h = beatCanvas.height;
          ctxBeat.fillStyle = '#030508';
          ctxBeat.fillRect(0, 0, w, h);

          // 计算音符起始强度（Spectral Flux + 瞬态高频起伏）
          let rawOnset = 0;
          if (analyser && isPlayingRef.current) {
            if (!prevFreqDataRef.current || prevFreqDataRef.current.length !== freqData.length) {
              prevFreqDataRef.current = new Uint8Array(freqData.length);
            }
            const prev = prevFreqDataRef.current;
            let fluxSum = 0;
            // 细分多频带，重点加权低音鼓点与高音敲击瞬态
            for (let i = 0; i < freqData.length; i++) {
              const diff = (freqData[i] - prev[i]) / 255;
              if (diff > 0) {
                const weight = i < 30 ? 2.5 : (i < 90 ? 1.3 : 2.0);
                fluxSum += diff * weight;
              }
              prev[i] = freqData[i];
            }
            // 放大灵敏度，保证音符每次打击都有清晰波峰
            rawOnset = Math.min(1.8, (fluxSum / 9.5) * sens);
          } else {
            // 待机/演示模式：大幅增强波动频率，注入鲜明的高频多层律动（主拍 + 次拍 + 细密泛音震荡）
            const tempoClock = gTime * 0.18; // 提升律动主频
            const mainKick = Math.pow(Math.max(0, Math.sin(tempoClock * 1.5)), 6) * 0.82;
            const snareTick = Math.pow(Math.max(0, Math.sin(tempoClock * 3.0 + 1.1)), 8) * 0.58;
            const rapidFlutter = Math.pow(Math.max(0, Math.sin(tempoClock * 6.0 + 0.4)), 10) * 0.35;
            const baselinePulse = (Math.sin(gTime * 0.8) * 0.5 + 0.5) * 0.12;
            rawOnset = (mainKick + snareTick + rapidFlutter + baselinePulse) * sens * 0.9;
          }

          // 瞬态包络响应（极速跃升 Attack，指数快速衰减 Decay，确保波动轮廓分明且频率紧凑）
          if (rawOnset > onsetEnvelopeRef.current) {
            onsetEnvelopeRef.current = rawOnset;
          } else {
            onsetEnvelopeRef.current = onsetEnvelopeRef.current * 0.80 + rawOnset * 0.20;
          }
          const onsetVal = Math.max(0, Math.min(1.8, onsetEnvelopeRef.current));

          // 保存历史队列（75个密集采样点，提升视觉流动感）
          const historyLen = 75;
          onsetHistoryRef.current.push(onsetVal);
          if (onsetHistoryRef.current.length > historyLen) onsetHistoryRef.current.shift();

          ctxBeat.save();

          // 1. 绘制水平中心基准标尺线
          const centerY = h / 2;
          ctxBeat.strokeStyle = 'rgba(249, 115, 22, 0.18)';
          ctxBeat.lineWidth = 1;
          ctxBeat.setLineDash([3, 3]);
          ctxBeat.beginPath();
          ctxBeat.moveTo(0, centerY);
          ctxBeat.lineTo(w, centerY);
          ctxBeat.stroke();
          ctxBeat.setLineDash([]);

          // 2. 绘制波峰发光区域（半透明橙金渐变面）
          const sliceWidth = w / (historyLen - 1);
          ctxBeat.beginPath();
          ctxBeat.moveTo(0, centerY);
          for (let i = 0; i < onsetHistoryRef.current.length; i++) {
            const x = i * sliceWidth;
            const val = onsetHistoryRef.current[i];
            const y = centerY - val * (h * 0.42);
            ctxBeat.lineTo(x, y);
          }
          ctxBeat.lineTo((onsetHistoryRef.current.length - 1) * sliceWidth, centerY);
          ctxBeat.closePath();

          const areaGrad = ctxBeat.createLinearGradient(0, centerY - h * 0.45, 0, centerY);
          areaGrad.addColorStop(0, 'rgba(249, 115, 22, 0.35)');
          areaGrad.addColorStop(0.6, 'rgba(234, 88, 12, 0.12)');
          areaGrad.addColorStop(1, 'rgba(249, 115, 22, 0.0)');
          ctxBeat.fillStyle = areaGrad;
          ctxBeat.fill();

          // 3. 绘制主波峰折线（高亮橙色）
          ctxBeat.lineWidth = 1.8;
          const strokeGrad = ctxBeat.createLinearGradient(0, 0, w, 0);
          strokeGrad.addColorStop(0, 'rgba(249, 115, 22, 0.3)');
          strokeGrad.addColorStop(0.7, '#fb923c');
          strokeGrad.addColorStop(1, '#ffedd5');
          ctxBeat.strokeStyle = strokeGrad;

          ctxBeat.beginPath();
          for (let i = 0; i < onsetHistoryRef.current.length; i++) {
            const x = i * sliceWidth;
            const val = onsetHistoryRef.current[i];
            const y = centerY - val * (h * 0.42);
            if (i === 0) ctxBeat.moveTo(x, y);
            else ctxBeat.lineTo(x, y);
          }
          ctxBeat.stroke();

          // 4. 绘制对称微波（镜像衰减）
          ctxBeat.lineWidth = 1.0;
          ctxBeat.strokeStyle = 'rgba(249, 115, 22, 0.22)';
          ctxBeat.beginPath();
          for (let i = 0; i < onsetHistoryRef.current.length; i++) {
            const x = i * sliceWidth;
            const val = onsetHistoryRef.current[i];
            const y = centerY + val * (h * 0.22);
            if (i === 0) ctxBeat.moveTo(x, y);
            else ctxBeat.lineTo(x, y);
          }
          ctxBeat.stroke();

          // 5. 最新冲击点亮点
          if (onsetHistoryRef.current.length > 0) {
            const lastIdx = onsetHistoryRef.current.length - 1;
            const lastX = lastIdx * sliceWidth;
            const lastY = centerY - onsetVal * (h * 0.42);

            ctxBeat.fillStyle = onsetVal > 0.4 ? '#fef08a' : '#f97316';
            ctxBeat.beginPath();
            ctxBeat.arc(lastX, lastY, onsetVal > 0.4 ? 3.5 : 2.5, 0, Math.PI * 2);
            ctxBeat.fill();
          }

          // 6. 右上角动态强度读数
          ctxBeat.fillStyle = onsetVal > 0.35 ? '#fed7aa' : '#ea580c';
          ctxBeat.font = 'bold 11px "Share Tech Mono", monospace';
          ctxBeat.textAlign = 'right';
          ctxBeat.fillText(`ONSET: ${onsetVal.toFixed(2)}`, w - 8, 16);
          ctxBeat.restore();

          // 突发瞬态冲击光圈
          if (onsetVal > 0.45) {
            ctxBeat.save();
            ctxBeat.fillStyle = `rgba(249, 115, 22, ${Math.min(0.25, onsetVal * 0.22)})`;
            ctxBeat.fillRect(0, 0, w, h);
            const radial = ctxBeat.createRadialGradient(w - 20, centerY, 2, w - 20, centerY, 50);
            radial.addColorStop(0, 'rgba(255, 237, 213, 0.6)');
            radial.addColorStop(1, 'rgba(249, 115, 22, 0)');
            ctxBeat.fillStyle = radial;
            ctxBeat.beginPath();
            ctxBeat.arc(w - 20, centerY, 50, 0, Math.PI * 2);
            ctxBeat.fill();
            ctxBeat.restore();
          }
        }
      }

      // 5. Sub-canvas 4: Spectral Centroid Hz
      const rhythmCanvas = rhythmCanvasRef.current;
      if (rhythmCanvas) {
        const ctxRhythm = rhythmCanvas.getContext('2d');
        if (ctxRhythm) {
          const w = rhythmCanvas.width;
          const h = rhythmCanvas.height;
          ctxRhythm.fillStyle = '#030508';
          ctxRhythm.fillRect(0, 0, w, h);

          const sampleRate = audioCtxRef.current ? audioCtxRef.current.sampleRate : 44100;
          const nyquist = sampleRate / 2;
          const binHz = nyquist / (freqData.length || 256);

          let rawCentroidHz = 1800;
          if (analyser && isPlayingRef.current) {
            let sumAmplitude = 0;
            let weightedSum = 0;
            const capLength = Math.floor(freqData.length * 0.85);
            for (let i = 0; i < capLength; i++) {
              const amp = freqData[i];
              sumAmplitude += amp;
              weightedSum += i * binHz * amp;
            }
            if (sumAmplitude > 0) {
              rawCentroidHz = weightedSum / sumAmplitude;
            }
          } else {
            rawCentroidHz = 1600 + Math.sin(gTime * 0.03) * 600;
          }

          smoothCentroidHzRef.current += (rawCentroidHz - smoothCentroidHzRef.current) * 0.08;

          const barH = 6;
          const barY = h * 0.65;
          const barW = w * 0.8;
          const startX = w * 0.1;

          ctxRhythm.save();
          const specGrad = ctxRhythm.createLinearGradient(startX, 0, startX + barW, 0);
          specGrad.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
          specGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.4)');
          specGrad.addColorStop(0.8, 'rgba(234, 179, 8, 0.4)');
          specGrad.addColorStop(1, 'rgba(255, 255, 255, 0.6)');

          ctxRhythm.fillStyle = specGrad;
          ctxRhythm.beginPath();
          ctxRhythm.roundRect(startX, barY, barW, barH, 3);
          ctxRhythm.fill();

          const normCentroid = Math.min(1.0, Math.max(0.0, smoothCentroidHzRef.current / 10000));
          const needleX = startX + normCentroid * barW;
          const needleY = barY - 14;

          const lightGrad = ctxRhythm.createRadialGradient(needleX, needleY, 2, needleX, needleY, 16);
          lightGrad.addColorStop(0, '#10b981');
          lightGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.25)');
          lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctxRhythm.fillStyle = lightGrad;
          ctxRhythm.beginPath();
          ctxRhythm.arc(needleX, needleY, 16, 0, Math.PI * 2);
          ctxRhythm.fill();

          ctxRhythm.fillStyle = '#10b981';
          ctxRhythm.beginPath();
          ctxRhythm.moveTo(needleX - 5, needleY - 6);
          ctxRhythm.lineTo(needleX + 5, needleY - 6);
          ctxRhythm.lineTo(needleX, barY);
          ctxRhythm.fill();

          ctxRhythm.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctxRhythm.font = '8px "Share Tech Mono", sans-serif';
          ctxRhythm.fillText('0 Hz', startX, barY + 16);
          ctxRhythm.textAlign = 'right';
          ctxRhythm.fillText('10 kHz', startX + barW, barY + 16);

          ctxRhythm.textAlign = 'center';
          ctxRhythm.fillStyle = '#10b981';
          ctxRhythm.font = 'bold 15px "Share Tech Mono", monospace';
          ctxRhythm.fillText(`${smoothCentroidHzRef.current.toFixed(1)} Hz`, w / 2, h * 0.34);

          ctxRhythm.fillStyle = 'rgba(16, 185, 129, 0.5)';
          ctxRhythm.font = '8px "Share Tech Mono", sans-serif';
          ctxRhythm.fillText('SPECTRAL CENTROID', w / 2, h * 0.16);

          ctxRhythm.restore();
        }
      }

      animFrameId = requestAnimationFrame(mainLoop);
    };

    animFrameId = requestAnimationFrame(mainLoop);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, []);

  // Window resize observer for canvas sharpness
  useEffect(() => {
    const handleResize = () => {
      const canvases = [
        mainCanvasRef.current,
        waveCanvasRef.current,
        emotionCanvasRef.current,
        beatCanvasRef.current,
        rhythmCanvasRef.current,
      ];
      const dpr = window.devicePixelRatio || 1;
      canvases.forEach((canvas) => {
        if (!canvas || !canvas.parentElement) return;
        const rect = canvas.parentElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Global click unlock audio context
  useEffect(() => {
    const unlockAudio = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    };
    window.addEventListener('click', unlockAudio, { once: true });
    return () => window.removeEventListener('click', unlockAudio);
  }, []);

  // Spacebar play/pause toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        handleTogglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay]);

  return (
    <div id="app-root" className="text-slate-200 min-h-screen flex flex-col grid-bg select-none">
      {/* 顶栏 */}
      <header
        id="app-header"
        className="border-b border-red-950/40 bg-slate-950/60 backdrop-blur-md px-6 py-4 flex flex-wrap justify-between items-center gap-4 z-20"
      >
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          <div>
            <h1 className="text-sm font-bold tracking-widest text-red-500 tech-font flex items-center gap-2">
              <Activity className="w-4 h-4" /> ANALYSIS | 解调
            </h1>
            <p className="text-xs text-slate-400 mt-0.5" id="track-subtitle">
              {trackSubtitle}
            </p>
          </div>
        </div>

        {/* 核心控制区 */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 情绪驱动模式选择 */}
          <div className="flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded border border-slate-800 text-xs">
            <span className="text-slate-500">情绪驱动源:</span>
            <select
              id="driver-select"
              value={driverMode}
              onChange={(e) => {
                const val = e.target.value as DriverMode;
                setDriverMode(val);
                if (val === 'interactive') {
                  triggerToast('已切换至手动模式，点击坐标轴内可移动星团坐标！');
                } else if (val === 'audio-fft') {
                  triggerToast('已切换至声学能量提取驱动。');
                } else {
                  triggerToast('外部 API 数据源待命。可在控制台调用 window.setRussellMood(v, a)');
                }
              }}
              className="bg-transparent text-red-400 font-medium focus:outline-none cursor-pointer"
            >
              <option value="audio-fft" className="bg-slate-900 text-slate-200">
                声学能量分析 (自动萃取)
              </option>
              <option value="interactive" className="bg-slate-900 text-slate-200">
                交互拖拽模式 (手动定位)
              </option>
              <option value="external" className="bg-slate-900 text-slate-200">
                外部数据接口 (API就绪)
              </option>
            </select>
          </div>

          {/* 音频来源 */}
          <button
            id="btn-demo-play"
            onClick={() => {
              if (isPlaying && audioTypeRef.current === 'demo') {
                stopDemoTrack();
              } else {
                playDemoTrack();
              }
            }}
            className="flex items-center space-x-2 bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-300 px-4 py-1.5 rounded text-xs tracking-wider transition-all duration-300 cursor-pointer"
          >
            <Music className="w-3.5 h-3.5" />
            <span id="demo-btn-text">
              {isPlaying && audioTypeRef.current === 'demo' ? '暂停示范民歌' : '播放示范民歌 (八月桂花遍地开)'}
            </span>
          </button>

          <label
            id="label-audio-upload"
            className="flex items-center space-x-2 bg-yellow-950/60 hover:bg-yellow-900/80 border border-yellow-500/40 text-yellow-300 px-4 py-1.5 rounded text-xs tracking-wider cursor-pointer transition-all duration-300"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>上传本地音频</span>
            <input
              ref={audioInputRef}
              type="file"
              id="audio-upload"
              accept="audio/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>

        <div className="hidden sm:flex items-center space-x-2 tech-font text-xs tracking-widest text-slate-400">
          <span>TUNE</span>
          <div className="w-2 h-2 bg-red-500 rounded-sm"></div>
        </div>
      </header>

      {/* 主体区域 */}
      <main id="app-main" className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        {/* 左侧/中央：主视觉：罗素情绪环状数轴与凝聚粒子团 */}
        <section
          id="main-visualizer-section"
          className="lg:col-span-8 flex flex-col bg-slate-950/40 border border-slate-900/60 rounded-xl overflow-hidden relative border-glow min-h-[580px] lg:min-h-[640px]"
        >
          {/* Canvas背景 */}
          <canvas
            ref={mainCanvasRef}
            id="main-canvas"
            className="w-full h-full absolute inset-0 cursor-crosshair z-0"
            onMouseDown={(e) => {
              isMouseDownRef.current = true;
              handleInteractiveCoord(e.clientX, e.clientY);
            }}
            onMouseMove={(e) => {
              if (isMouseDownRef.current) {
                handleInteractiveCoord(e.clientX, e.clientY);
              }
            }}
            onMouseUp={() => {
              isMouseDownRef.current = false;
            }}
            onTouchStart={(e) => {
              if (e.touches.length > 0) {
                handleInteractiveCoord(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length > 0) {
                handleInteractiveCoord(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
          />

          {/* UI 叠加层 */}
          <div className="absolute inset-0 p-4 sm:p-6 flex flex-col justify-between pointer-events-none z-10">
            {/* 左上：曲目与分析状态 */}
            <div className="flex justify-between items-start">
              <div>
                <div
                  className="text-2xl font-bold tracking-widest text-slate-100 flex items-center gap-2"
                  id="track-title"
                >
                  {trackTitle}
                </div>
                <div className="text-xs text-red-400/80 mt-1 flex items-center space-x-2">
                  <span className="tech-font inline-block bg-red-950/40 border border-red-800/40 px-1.5 py-0.5 rounded">
                    RUSSELL MAP
                  </span>
                  <span className="animate-pulse text-yellow-500/90" id="driver-status-text">
                    {driverStatusText}
                  </span>
                </div>
              </div>

              {/* 实时数值看板 */}
              <div className="bg-slate-900/80 backdrop-blur-md p-2 rounded border border-slate-800 text-right font-mono text-[11px] space-y-0.5">
                <div className="text-[9px] text-slate-500 tracking-widest">罗素情绪矢量</div>
                <div>
                  <span className="text-slate-400">效价 (Valence): </span>
                  <span className="text-cyan-400" id="hud-valence">
                    {hudValence}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">唤醒 (Arousal): </span>
                  <span className="text-red-400" id="hud-arousal">
                    {hudArousal}
                  </span>
                </div>
              </div>
            </div>

            {/* 交互提示 */}
            <div className="text-center text-[10px] text-slate-500/70 tracking-wider">
              [ 提示：切换到“交互拖拽模式”后，可在坐标轴内任意点击/拖动星团定位情绪 ]
            </div>

            {/* 左下：音频基本参数实时看板 与 右下角标（添加mb-16与控制条垂直错开，杜绝叠压） */}
            <div className="flex justify-between items-end mb-16 sm:mb-20">
              <div className="space-y-1 bg-slate-950/75 backdrop-blur-md p-2.5 sm:p-3 rounded-lg border border-slate-900/80 pointer-events-auto shadow-xl">
                <div className="text-[10px] text-slate-500 tracking-widest uppercase border-b border-slate-800/80 pb-1 mb-1.5 flex items-center justify-between">
                  <span>信号参量</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500/80 animate-pulse"></span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-1 text-xs font-mono">
                  <div className="flex justify-between space-x-2 sm:space-x-4">
                    <span className="text-slate-400">BASS (鼓点低频)</span>
                    <span className="text-red-400 text-right min-w-[2.5rem]" id="val-bass">
                      {bassVal}
                    </span>
                  </div>
                  <div className="flex justify-between space-x-2 sm:space-x-4">
                    <span className="text-slate-400">MID (人声中频)</span>
                    <span className="text-yellow-500 text-right min-w-[2.5rem]" id="val-mid">
                      {midVal}
                    </span>
                  </div>
                  <div className="flex justify-between space-x-2 sm:space-x-4">
                    <span className="text-slate-400">TREBLE (高频乐器)</span>
                    <span className="text-pink-400 text-right min-w-[2.5rem]" id="val-treble">
                      {trebleVal}
                    </span>
                  </div>
                  <div className="flex justify-between space-x-2 sm:space-x-4">
                    <span className="text-slate-400">ENERGY (革命斗志)</span>
                    <span className="text-orange-500 text-right min-w-[2.5rem]" id="val-energy">
                      {energyVal}
                    </span>
                  </div>
                </div>
              </div>

              {/* 动态状态角标 */}
              <div className="flex flex-col items-end text-right pointer-events-auto">
                <span className="text-[10px] text-slate-500 tech-font">RUSSELL ENGINE v3.1</span>
                <span
                  className="text-xs text-red-500 font-bold tracking-wider tech-font"
                  id="live-status"
                >
                  {liveStatus}
                </span>
              </div>
            </div>
          </div>

          {/* 控制条（悬浮底部：精雕细琢的声学控制坞，杜绝溢出与多余滚动条） */}
          <div
            id="floating-controls"
            className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 bg-slate-950/90 backdrop-blur-xl px-3 sm:px-5 py-2 rounded-2xl sm:rounded-full border border-slate-800/80 flex items-center gap-2 sm:gap-3.5 lg:gap-4 shadow-[0_14px_36px_rgba(0,0,0,0.85),0_0_20px_rgba(239,68,68,0.08)] pointer-events-auto z-20 max-w-[96%] select-none shrink-0"
          >
            {/* 播放/暂停 */}
            <button
              id="btn-play-toggle"
              onClick={handleTogglePlay}
              title={isPlaying ? '暂停 (Space)' : '播放示范 (Space)'}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 shadow-md shadow-red-600/30 shrink-0 cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" id="play-icon" />
              ) : (
                <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" id="play-icon" />
              )}
            </button>

            {/* 分界线 */}
            <div className="h-5 w-px bg-slate-800/90 shrink-0" />

            {/* 音量 */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
              <input
                type="range"
                id="volume-slider"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-14 sm:w-18 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                title={`音量: ${Math.round(volume * 100)}%`}
              />
              <span className="text-[10px] font-mono text-slate-400 w-7 text-right hidden sm:inline-block">
                {Math.round(volume * 100)}%
              </span>
            </div>

            {/* 分界线 */}
            <div className="h-5 w-px bg-slate-800/90 shrink-0" />

            {/* 增益倍率 */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">增益</span>
              <input
                type="range"
                id="sensitivity-slider"
                min="0.5"
                max="2.5"
                step="0.1"
                value={sensitivity}
                onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                className="w-14 sm:w-18 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                title={`增益倍率: ${sensitivity.toFixed(1)}x`}
              />
              <span className="text-[10px] font-mono text-yellow-500/90 w-7 text-right hidden sm:inline-block">
                {sensitivity.toFixed(1)}x
              </span>
            </div>

            {/* 分界线 */}
            <div className="h-5 w-px bg-slate-800/90 shrink-0" />

            {/* 速度乘数 */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">自旋</span>
              <input
                type="range"
                id="speed-slider"
                min="0.2"
                max="2.0"
                step="0.1"
                value={speedMult}
                onChange={(e) => setSpeedMult(parseFloat(e.target.value))}
                className="w-12 sm:w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                title={`星自旋: ${speedMult.toFixed(1)}x`}
              />
              <span className="text-[10px] font-mono text-orange-400 w-7 text-right hidden sm:inline-block">
                {speedMult.toFixed(1)}x
              </span>
            </div>

            {/* 分界线 */}
            <div className="h-5 w-px bg-slate-800/90 shrink-0" />

            {/* 恢复默认按钮 */}
            <div className="flex items-center shrink-0">
              <button
                id="btn-reset-defaults"
                onClick={handleResetDefaults}
                title="恢复控制参数默认值 (音量 70% · 增益 1.2x · 自旋 1.0x)"
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-red-500/60 text-slate-300 hover:text-white text-xs transition-all duration-200 active:scale-95 cursor-pointer shrink-0 group shadow-sm"
              >
                <RotateCcw className="w-3 h-3 text-slate-400 group-hover:text-red-400 transition-transform group-hover:-rotate-45 duration-200 shrink-0" />
                <span className="text-[11px] whitespace-nowrap font-medium tracking-tight">恢复默认</span>
              </button>
            </div>
          </div>
        </section>

        {/* 右侧：四路子解调分析仪表盘 */}
        <section
          id="sub-visualizers-section"
          className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 h-full"
        >
          {/* 卡片 1：RMS能量均值 */}
          <div
            id="card-rms"
            className="bg-slate-950/40 border border-slate-900/60 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden border-glow min-h-[220px]"
          >
            <div className="flex justify-between items-center z-10">
              <span className="text-xs font-bold tracking-widest text-slate-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span> RMS能量均值
              </span>
              <span className="text-[9px] text-cyan-400 font-mono tech-font">MEAN RMS</span>
            </div>
            {/* 迷你绘图区 */}
            <div className="flex-1 my-3 relative min-h-[120px]">
              <canvas ref={waveCanvasRef} id="sub-canvas-wave" className="w-full h-full absolute inset-0" />
            </div>
            <div className="text-[10px] text-slate-500 z-10 leading-relaxed">
              反映音频信号在时间窗口内的均方根能量均值（力度/声压均值）。数值越强，能量跃动越剧烈。
            </div>
          </div>

          {/* 卡片 2：频谱带宽HZ */}
          <div
            id="card-bandwidth"
            className="bg-slate-950/40 border border-slate-900/60 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden border-glow min-h-[220px]"
          >
            <div className="flex justify-between items-center z-10">
              <span className="text-xs font-bold tracking-widest text-slate-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> 频谱带宽HZ
              </span>
              <span className="text-[9px] text-yellow-500 font-mono tech-font">BANDWIDTH HZ</span>
            </div>
            {/* 迷你绘图区 */}
            <div className="flex-1 my-3 relative min-h-[120px]">
              <canvas
                ref={emotionCanvasRef}
                id="sub-canvas-emotion"
                className="w-full h-full absolute inset-0"
              />
            </div>
            <div className="text-[10px] text-slate-500 z-10 leading-relaxed">
              测量音频信号围绕频谱质心的扩展宽度(Hz)。带宽越大代表频域色彩越丰富、声场覆盖面越广。
            </div>
          </div>

          {/* 卡片 3：音符起始强度 */}
          <div
            id="card-onset"
            className="bg-slate-950/40 border border-slate-900/60 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden border-glow min-h-[220px]"
          >
            <div className="flex justify-between items-center z-10">
              <span className="text-xs font-bold tracking-widest text-slate-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> 音符起始强度
              </span>
              <span className="text-[9px] text-orange-500 font-mono tech-font">ONSET STRENGTH</span>
            </div>
            {/* 迷你绘图区 */}
            <div className="flex-1 my-3 relative min-h-[120px]">
              <canvas ref={beatCanvasRef} id="sub-canvas-beat" className="w-full h-full absolute inset-0" />
            </div>
            <div className="text-[10px] text-slate-500 z-10 leading-relaxed">
              检测音符瞬间起始与打击瞬态(Onset)。突发峰值越高，代表乐曲的敲击活跃度与节奏重音越强烈。
            </div>
          </div>

          {/* 卡片 4：频谱质心HZ */}
          <div
            id="card-centroid"
            className="bg-slate-950/40 border border-slate-900/60 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden border-glow min-h-[220px]"
          >
            <div className="flex justify-between items-center z-10">
              <span className="text-xs font-bold tracking-widest text-slate-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 频谱质心HZ
              </span>
              <span className="text-[9px] text-emerald-500 font-mono tech-font">CENTROID HZ</span>
            </div>
            {/* 迷你绘图区 */}
            <div className="flex-1 my-3 relative min-h-[120px]">
              <canvas
                ref={rhythmCanvasRef}
                id="sub-canvas-rhythm"
                className="w-full h-full absolute inset-0"
              />
            </div>
            <div className="text-[10px] text-slate-500 z-10 leading-relaxed">
              解调音频频谱的质量中心物理频率(Hz)。数值偏高代表音色清亮明快，偏低则代表低沉深厚。
            </div>
          </div>
        </section>
      </main>

      {/* 底部状态栏 */}
      <footer
        id="app-footer"
        className="border-t border-slate-900/80 bg-slate-950/60 backdrop-blur-md px-6 py-2.5 flex flex-wrap justify-between items-center gap-2 text-xs text-slate-500 z-20"
      >
        <div className="flex items-center space-x-4">
          <span>
            音频采样: <span className="text-red-500 tech-font">44100 Hz</span>
          </span>
          <span className="border-l border-slate-800 h-3"></span>
          <span>
            分析通道: <span className="text-yellow-500 tech-font">512 Bands</span>
          </span>
          <span className="border-l border-slate-800 h-3"></span>
          <span>
            渲染帧率: <span className="text-emerald-500 tech-font" id="fps-counter">{fpsText}</span>
          </span>
        </div>
        <div>
          <span>大别山红色革命文化数字化艺术重构实验室 © 2026</span>
        </div>
      </footer>

      {/* 自定义信息Toast通知 */}
      <div
        id="toast"
        className={`fixed top-20 right-6 bg-slate-900/95 border border-red-500/30 text-slate-200 text-xs px-4 py-3 rounded-lg shadow-xl transition-transform duration-300 flex items-center space-x-3 z-50 ${
          showToast ? 'translate-x-0' : 'translate-x-[140%]'
        }`}
      >
        <Info className="w-4 h-4 text-red-400 flex-shrink-0" />
        <span id="toast-text">{toastMessage}</span>
      </div>
    </div>
  );
}
