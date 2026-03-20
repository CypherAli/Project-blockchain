'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useAllArtworks } from '@/lib/hooks';
import Sidebar from '@/components/Sidebar';

import { ArtworkListSkeleton } from '@/components/ui/Skeleton';
import {
  type ArtworkInfo,
  formatEth,
  graduationProgress,
  shortAddress,
  timeAgo,
  getIpfsUrlsForFallback,
} from '@/lib/contracts';

type FilterTab = 'trending' | 'newest' | 'graduating' | 'graduated';

/* ── YouTube global type ── */
declare global { interface Window { YT: any; onYouTubeIframeAPIReady?: () => void; } }

interface MusicPlayerHandle { pauseMusic(): void; resumeMusic(): void; }

const MUSIC_TRACKS = [
  { id: 'C_cx4B1IaC4', title: 'Classical Piano — Gallery' },
  { id: 'BHACKCNDMW8', title: 'Clair de Lune — Debussy' },
  { id: 'h3AJGGHdQAY', title: 'Air on G String — Bach' },
];

const MusicPlayer = forwardRef<MusicPlayerHandle>(function MusicPlayer(_, ref) {
  const ytPlayer = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [muteUntil, setMuteUntilRaw] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try { return (JSON.parse(localStorage.getItem('artcurve-music') || '{}') as { muteUntil?: number }).muteUntil ?? 0; }
    catch { return 0; }
  });

  const timerActive = muteUntil === -1 || (muteUntil > 0 && Date.now() < muteUntil);
  const effectiveMute = muted || timerActive;

  const initPlayer = useCallback(() => {
    if (ytPlayer.current) return;
    ytPlayer.current = new window.YT.Player('__yt_music__', {
      height: '1', width: '1',
      videoId: MUSIC_TRACKS[0].id,
      playerVars: { autoplay: 1, loop: 1, controls: 0, mute: 1, playlist: MUSIC_TRACKS[0].id },
      events: {
        onReady(e: any) { e.target.setVolume(65); e.target.playVideo(); setIsPlaying(true); },
        onStateChange(e: any) { setIsPlaying(e.data === 1); },
      },
    });
  }, []);

  useEffect(() => {
    // Create YT container outside React tree so YT API can replace it with iframe
    // without causing React reconciler removeChild errors
    let ytDiv = document.getElementById('__yt_music__');
    if (!ytDiv) {
      ytDiv = document.createElement('div');
      ytDiv.id = '__yt_music__';
      ytDiv.style.cssText = 'position:fixed;width:1px;height:1px;bottom:-10px;right:-10px;opacity:0.001;pointer-events:none';
      document.body.appendChild(ytDiv);
    }

    if (window.YT?.Player) { initPlayer(); return; }
    window.onYouTubeIframeAPIReady = initPlayer;
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
  }, [initPlayer]);

  /* Close popup on outside click */
  useEffect(() => {
    if (!showPopup) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowPopup(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPopup]);

  useImperativeHandle(ref, () => ({
    pauseMusic() { ytPlayer.current?.pauseVideo?.(); setIsPlaying(false); },
    resumeMusic() { ytPlayer.current?.unMute?.(); ytPlayer.current?.playVideo?.(); setMuted(false); setIsPlaying(true); },
  }));

  const applyMuteTimer = (rawMs: number) => {
    const ts = rawMs < 0 ? -1 : rawMs === 0 ? 0 : Date.now() + rawMs;
    localStorage.setItem('artcurve-music', JSON.stringify({ muteUntil: ts }));
    setMuteUntilRaw(ts);
    if (ts !== 0) { ytPlayer.current?.mute?.(); setMuted(true); }
    else { ytPlayer.current?.unMute?.(); setMuted(false); }
  };

  const handleVinylClick = () => {
    if (muted) { ytPlayer.current?.unMute?.(); setMuted(false); }
    setShowPopup(p => !p);
  };

  const timerOpts = [
    { label: '15 min',  ms: 900_000 },
    { label: '1 hour',  ms: 3_600_000 },
    { label: '8 hours', ms: 28_800_000 },
    { label: '24 hours',ms: 86_400_000 },
    { label: 'Forever', ms: -1 },
    { label: 'Clear',   ms: 0 },
  ];

  return (
    <>
      <div className="music-player-wrap" ref={wrapRef}>
        {showPopup && (
          <div className="music-popup">
            <div className="music-popup-title">Gallery Soundtrack</div>
            <div className="music-track-name">{MUSIC_TRACKS[0].title}</div>
            <div className="music-controls">
              <button className={`music-ctrl-btn${isPlaying ? ' active' : ''}`}
                onClick={() => { if (isPlaying) { ytPlayer.current?.pauseVideo?.(); setIsPlaying(false); } else { ytPlayer.current?.playVideo?.(); setIsPlaying(true); } }}>
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button className={`music-ctrl-btn${effectiveMute ? ' active' : ''}`}
                onClick={() => { if (effectiveMute) { ytPlayer.current?.unMute?.(); setMuted(false); applyMuteTimer(0); } else { ytPlayer.current?.mute?.(); setMuted(true); } }}>
                {effectiveMute ? '🔇 Muted' : '🔊 Sound'}
              </button>
            </div>
            <div className="music-timer-label">Auto-mute for</div>
            <div className="music-timer-grid">
              {timerOpts.map(opt => (
                <button key={opt.label}
                  className={`music-timer-opt${(opt.ms < 0 && muteUntil === -1) || (opt.ms === 0 && muteUntil === 0) ? ' active' : ''}`}
                  onClick={() => applyMuteTimer(opt.ms)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {isPlaying && effectiveMute && (
          <div className="vinyl-hint">♪ click to unmute</div>
        )}
        <button
          className={`gram-btn${isPlaying && !effectiveMute ? ' gram-btn--playing' : ''}${effectiveMute ? ' gram-btn--muted' : ''}`}
          onClick={handleVinylClick}
          aria-label="Music player"
          title={effectiveMute ? 'Music muted — click to unmute' : 'Music playing'}
          style={{ position: 'relative' }}
        >
          {/* Vintage gramophone SVG */}
          <svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="gw" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a0753a"/>
                <stop offset="50%" stopColor="#7a5420"/>
                <stop offset="100%" stopColor="#452a0c"/>
              </linearGradient>
              <linearGradient id="gh" x1="0.2" y1="1" x2="0.8" y2="0">
                <stop offset="0%" stopColor="#785010"/>
                <stop offset="35%" stopColor="#c09428"/>
                <stop offset="70%" stopColor="#e8c848"/>
                <stop offset="100%" stopColor="#fae878"/>
              </linearGradient>
              <radialGradient id="ghi" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0e0804" stopOpacity="0.95"/>
                <stop offset="100%" stopColor="#1a1008" stopOpacity="0.70"/>
              </radialGradient>
              <linearGradient id="garm" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e8c848"/>
                <stop offset="100%" stopColor="#8a6818"/>
              </linearGradient>
            </defs>

            {/* ── Horn: large bell flaring upward-right from the neck ── */}
            {/* Outer horn body — wide flare */}
            <path d="M 30 52 C 28 44 24 34 20 26 C 16 18 10 10 6 4 C 4 1 8 -1 12 1 C 18 4 26 10 34 18 C 40 25 44 34 48 42 C 52 50 52 54 48 56 Z"
              fill="url(#gh)" opacity="0.95"/>
            {/* Inner cavity */}
            <path d="M 32 52 C 30 46 27 37 23 29 C 19 21 14 14 10 8 C 8 5 10 3 13 4 C 18 7 24 14 30 22 C 36 30 40 38 44 46 C 46 50 44 54 42 54 Z"
              fill="url(#ghi)" opacity="0.88"/>
            {/* Bell rim — ellipse at mouth */}
            <ellipse cx="9" cy="3" rx="7.5" ry="5" fill="none" stroke="#fae878" strokeWidth="1.0" opacity="0.72" transform="rotate(42 9 3)"/>
            <ellipse cx="9" cy="3" rx="9.5" ry="6.5" fill="none" stroke="#d4a830" strokeWidth="0.45" opacity="0.32" transform="rotate(42 9 3)"/>
            {/* Sheen line */}
            <path d="M 44 50 C 40 40 34 28 26 18 C 20 12 14 7 10 4" stroke="#fae878" strokeWidth="0.7" opacity="0.25" fill="none" strokeLinecap="round"/>

            {/* ── Cabinet body ── */}
            <rect x="24" y="56" width="40" height="16" rx="3" fill="url(#gw)"/>
            <rect x="24" y="56" width="40" height="2" rx="1" fill="#c89848" opacity="0.22"/>
            <line x1="27" y1="62" x2="61" y2="62" stroke="#2a1608" strokeWidth="0.5" opacity="0.40"/>
            <line x1="27" y1="66" x2="61" y2="66" stroke="#2a1608" strokeWidth="0.4" opacity="0.28"/>
            {/* Feet */}
            <rect x="27" y="71" width="5" height="4" rx="1.5" fill="#301c06"/>
            <rect x="56" y="71" width="5" height="4" rx="1.5" fill="#301c06"/>

            {/* ── Turntable platter ── */}
            <ellipse cx="44" cy="58" rx="14" ry="4" fill="#181818" stroke="#2a2a2a" strokeWidth="0.5"/>

            {/* ── Record (spinning) ── */}
            <g className={isPlaying && !effectiveMute ? 'gram-disc-spinning' : ''} style={{ transformOrigin: '44px 56px' }}>
              <circle cx="44" cy="56" r="12" fill="#0e0e0e" stroke="#1a1a1a" strokeWidth="0.4"/>
              <circle cx="44" cy="56" r="9.5" fill="none" stroke="#171717" strokeWidth="0.6"/>
              <circle cx="44" cy="56" r="7" fill="none" stroke="#151515" strokeWidth="0.5"/>
              <circle cx="44" cy="56" r="4" fill="#7a1818"/>
              <circle cx="44" cy="56" r="4" fill="none" stroke="#8a2020" strokeWidth="0.4"/>
              <circle cx="44" cy="56" r="1.2" fill="#080808"/>
            </g>

            {/* ── Tonearm ── */}
            <line x1="33" y1="50" x2="43" y2="55" stroke="url(#garm)" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="33" cy="50" r="3" fill="#b08828" stroke="#d8b840" strokeWidth="0.6"/>
            <circle cx="33" cy="50" r="1.2" fill="#0c0c0c"/>

            {/* ── Mute X ── */}
            {effectiveMute && (
              <g opacity="0.80">
                <line x1="60" y1="36" x2="72" y2="48" stroke="hsl(0 65% 55%)" strokeWidth="2.2" strokeLinecap="round"/>
                <line x1="72" y1="36" x2="60" y2="48" stroke="hsl(0 65% 55%)" strokeWidth="2.2" strokeLinecap="round"/>
              </g>
            )}
            {/* ── Playing dot ── */}
            {isPlaying && !effectiveMute && (
              <circle cx="68" cy="42" r="3.5" fill="hsl(42 92% 60%)" opacity="0.9">
                <animate attributeName="opacity" values="0.9;0.35;0.9" dur="1.4s" repeatCount="indefinite"/>
              </circle>
            )}
          </svg>
        </button>
      </div>
    </>
  );
});

interface FeedEntry {
  id: string;
  type: 'buy' | 'sell' | 'launch';
  artworkName: string;
  artworkAddr: string;
  user: string;
  amount: string;
  shares: string;
  time: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CURTAIN ENTRANCE
═══════════════════════════════════════════════════════════════════════════ */
function CurtainEntrance({ onEnter }: { onEnter: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'click' | 'open' | 'done'>('idle');

  const handleClick = () => {
    if (phase !== 'idle') return;
    setPhase('click');
    setTimeout(() => setPhase('open'), 80);
    setTimeout(() => onEnter(), 900);
  };

  return (
    <div
      className={`ce-root${phase === 'open' ? ' ce-open' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
      aria-label="Click to enter the gallery"
    >
      {/* ── Left curtain panel ── */}
      <div className="ce-panel ce-panel--l">
        <div className="ce-velvet" />
        {[...Array(12)].map((_, i) => <div key={i} className="ce-pleat" style={{ left: `${i * 8.5}%` }} />)}
        <div className="ce-sheen ce-sheen--l" />
      </div>

      {/* ── Right curtain panel ── */}
      <div className="ce-panel ce-panel--r">
        <div className="ce-velvet" />
        {[...Array(12)].map((_, i) => <div key={i} className="ce-pleat" style={{ right: `${i * 8.5}%` }} />)}
        <div className="ce-sheen ce-sheen--r" />
      </div>

      {/* ── Center content ── */}
      <div className={`ce-content${phase !== 'idle' ? ' ce-content--fade' : ''}`}>
        {/* Glow halo */}
        <div className="ce-halo" />

        {/* Logo card */}
        <div className="ce-logo-card">
          <div style={{ padding: '18px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Image
              src="/artcurve-logo-transparent.png"
              alt="ArtCurve"
              width={936}
              height={267}
              style={{ height: 54, width: 'auto', display: 'block' }}
              priority
            />
          </div>
        </div>

        <div className="ce-divider" />
        <p className="ce-sub-text">Art Trading on Ethereum</p>
      </div>

      {/* Gold rail */}
      <div className="ce-rail" />
    </div>
  );
}

/* VolumetricSpotlight removed per user request */

/* ═══════════════════════════════════════════════════════════════════════════
   CURTAIN FRAME — always-visible side theater curtains (mouse-reactive sway)
═══════════════════════════════════════════════════════════════════════════ */
/* ── Cloth physics state for one curtain side ── */
interface ClothPhys {
  pull: number;   /* current displacement px */
  vel: number;    /* current velocity */
  target: number; /* target displacement */
  mouseY: number; /* normalised 0-1 */
}

function CurtainFrame() {
  const svgRef    = useRef<SVGSVGElement>(null);
  const lMain     = useRef<SVGPathElement>(null);
  const lGlow     = useRef<SVGPathElement>(null);
  const lP1       = useRef<SVGPathElement>(null);
  const lP2       = useRef<SVGPathElement>(null);
  const lP3       = useRef<SVGPathElement>(null);
  const lTex      = useRef<SVGPathElement>(null);
  const rMain     = useRef<SVGPathElement>(null);
  const rGlow     = useRef<SVGPathElement>(null);
  const rP1       = useRef<SVGPathElement>(null);
  const rP2       = useRef<SVGPathElement>(null);
  const rP3       = useRef<SVGPathElement>(null);
  const rTex      = useRef<SVGPathElement>(null);
  const rRailRef  = useRef<SVGRectElement>(null);
  const lTbRef    = useRef<SVGGElement>(null);   /* left tie-back knot */
  const rTbRef    = useRef<SVGGElement>(null);   /* right tie-back knot */
  const [heroVisible, setHeroVisible] = useState(true);
  const [heroH, setHeroH] = useState(0);

  useEffect(() => {
    /* ── Hero visibility + height tracking ── */
    const hero = document.querySelector('.hero') as HTMLElement | null;
    const updateHero = () => {
      if (!hero) return;
      setHeroH(hero.offsetHeight);
      setHeroVisible(hero.getBoundingClientRect().bottom > 80);
    };
    updateHero();
    window.addEventListener('scroll', updateHero, { passive: true });
    const ro = new ResizeObserver(updateHero);
    if (hero) ro.observe(hero);

    /* ── Physics constants ── */
    const SPRING   = 0.018; /* slow stiffness — heavy velvet weight */
    const DAMP     = 0.94;  /* high damping — thick fabric barely bounces */
    const W_BASE   = 108;   /* curtain base width px — wider for more visible folds */
    const MAX_PULL = 140;   /* max displacement at peak */
    const TRIGGER  = 280;   /* trigger zone from each screen edge */

    /* ── Spring physics state ── */
    const L: ClothPhys = { pull: 0, vel: 0, target: 0, mouseY: 0.5 };
    const R: ClothPhys = { pull: 0, vel: 0, target: 0, mouseY: 0.5 };

    /* ── Build curtain path with realistic cloth drape ──────────────────────
     *  The "free" inner edge of the curtain forms a smooth arc:
     *   - At mouse Y: maximum pull outward (toward stage)
     *   - Above/below: exponential falloff → natural drape
     *  Multiple bezier segments give smooth S-curve feel.
     * ──────────────────────────────────────────────────────────────────────── */
    /* ── Realistic multi-fold cloth path ───────────────────────────────────
     *  Inner edge = wind Gaussian pull + traveling fabric wave ripple.
     *  The ripple uses 3 overlapping sine waves traveling downward,
     *  amplitude increasing toward the hem (pendulum physics).
     *  pleatOffset shifts the entire edge inward for pleat shadow layers.
     * ──────────────────────────────────────────────────────────────────── */
    const buildPath = (
      p: ClothPhys, side: 'l' | 'r',
      W: number, H: number,
      pleatOffset = 0,
      tw = 0          /* time for traveling wave */
    ): string => {
      const pull   = Math.max(0, p.pull);
      const my     = p.mouseY;
      const peakY  = my * H;
      const spread = H * 0.40;

      /* Wind Gaussian pull at y */
      const pullAt = (y: number): number => {
        const d = (y - peakY) / spread;
        return pull * Math.exp(-d * d * 0.85);
      };

      /* Traveling fabric wave — 3 sine waves at different frequencies/speeds.
       * Lower frequencies carry more energy (heavy velvet).
       * Amplitude grows from top (fixed at rail) toward hem (free to swing). */
      const ripple = (y: number): number => {
        const norm = y / H;
        /* pendulum factor: 0 at top rail, peaks around 70% down */
        const pend = Math.pow(Math.sin(norm * Math.PI * 0.92), 0.65);
        const w1 = Math.sin(norm * 6.5  - tw * 0.9)          * 5.5;  /* slow wide folds  */
        const w2 = Math.sin(norm * 13.0 - tw * 1.4  + 1.2)   * 3.0;  /* mid frequency    */
        const w3 = Math.sin(norm * 22.0 - tw * 2.1  + 2.7)   * 1.4;  /* fine ripple      */
        return (w1 + w2 + w3) * pend;
      };

      /* 20 samples — smooth curves without per-frame lag */
      const N   = 20;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= N; i++) {
        const y  = (i / N) * H;
        const px = pullAt(y) + ripple(y) - pleatOffset;
        if (side === 'l') {
          pts.push([W_BASE + Math.max(0, px), y]);
        } else {
          pts.push([W - W_BASE - Math.max(0, px), y]);
        }
      }

      /* Catmull-Rom → cubic Bezier (smooth, no overshoot) */
      const pathParts: string[] = [];
      if (side === 'l') {
        pathParts.push(`M 0 0 L ${pts[0][0].toFixed(1)} 0`);
      } else {
        pathParts.push(`M ${W} 0 L ${pts[0][0].toFixed(1)} 0`);
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
        const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
        const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
        const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
        pathParts.push(
          `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)},${cp2x.toFixed(1)} ${cp2y.toFixed(1)},${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
        );
      }
      if (side === 'l') pathParts.push(`L 0 ${H} Z`);
      else              pathParts.push(`L ${W} ${H} Z`);
      return pathParts.join(' ');
    };

    /* ── Mouse targets (separate from wind so they don't interfere) ── */
    const mouse = { targetL: 0, targetR: 0, nearL: false, nearR: false };

    /* ── Mouse tracking ── */
    const onMove = (e: MouseEvent) => {
      const W = window.innerWidth;
      const y = e.clientY / window.innerHeight;

      if (e.clientX < TRIGGER) {
        mouse.targetL = (1 - e.clientX / TRIGGER) * MAX_PULL;
        mouse.nearL   = true;
        L.mouseY      = y;
      } else {
        mouse.targetL = 0;
        mouse.nearL   = false;
      }
      if (e.clientX > W - TRIGGER) {
        mouse.targetR = (1 - (W - e.clientX) / TRIGGER) * MAX_PULL;
        mouse.nearR   = true;
        R.mouseY      = y;
      } else {
        mouse.targetR = 0;
        mouse.nearR   = false;
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    /* ── Cache DOM refs once — never query inside tick ── */
    const heroEl   = document.querySelector('.hero') as HTMLElement | null;
    const lGroupEl = svgRef.current?.querySelector('#cfr-left')    as SVGGElement | null;
    const rGroupEl = svgRef.current?.querySelector('#cfr-right')   as SVGGElement | null;
    const rTasselEl= svgRef.current?.querySelector('#cfr-tassel-r')as SVGGElement | null;
    let   heroH2   = heroEl ? heroEl.offsetHeight : window.innerHeight;
    /* Update cached hero height only on resize */
    const onResize = () => { heroH2 = heroEl ? heroEl.offsetHeight : window.innerHeight; };
    window.addEventListener('resize', onResize, { passive: true });

    /* ── Animation loop ── */
    let raf: number;
    let t = 0; /* time counter for wind/breath animation */
    const tick = () => {
      t += 0.006; /* ~17 s full cycle at 60 fps — slow, natural breath */

      const W = window.innerWidth;
      const H = Math.max(0, Math.min(heroH2 - window.scrollY, window.innerHeight));
      if (svgRef.current) svgRef.current.style.height = H + 'px';

      /* ── Gentle ambient wind — 3 overlapping sine waves for organic feel ──
       *  Left and right are offset in phase so they don't sway in unison.
       *  All amplitudes stay small (≤ 14 px) for a "barely-there" breeze.  */
      const wL = Math.sin(t * 0.55)          * 14   /* slow primary sway    */
               + Math.sin(t * 1.3  + 0.8)   *  7   /* mid-freq flutter     */
               + Math.sin(t * 2.7  + 2.1)   *  3;  /* high-freq ripple     */
      const wR = Math.sin(t * 0.55 + 2.0)   * 12
               + Math.sin(t * 1.3  + 3.2)   *  6
               + Math.sin(t * 2.7  + 0.5)   *  2.5;

      /* Wind only contributes positive pull (curtain can't go behind wall) */
      const windL = Math.max(0, wL);
      const windR = Math.max(0, wR);

      /* Combined target: mouse dominates, wind fills the idle state */
      L.target = mouse.targetL + windL;
      R.target = mouse.targetR + windR;

      /* ── Animate drape peak Y — vertical wave drifts slowly up/down ──
       *  Only override mouseY when user is not actively pulling the curtain. */
      if (!mouse.nearL) {
        L.mouseY = 0.42 + Math.sin(t * 0.37)        * 0.16
                        + Math.sin(t * 0.79 + 1.1)  * 0.07;
      }
      if (!mouse.nearR) {
        R.mouseY = 0.48 + Math.sin(t * 0.37 + 1.8)  * 0.14
                        + Math.sin(t * 0.79 + 2.9)  * 0.06;
      }

      /* Spring-damper step */
      const step = (p: ClothPhys) => {
        const f = (p.target - p.pull) * SPRING;
        p.vel   = p.vel * DAMP + f;
        p.pull += p.vel;
      };
      step(L); step(R);

      /* subtle skewX tied to pull — 2D only, no GPU layer split */
      const skewL = (L.pull / MAX_PULL) * 2.5;
      const skewR = (R.pull / MAX_PULL) * 2.5;
      if (lGroupEl) lGroupEl.setAttribute('transform', `skewX(${skewL.toFixed(2)})`);
      if (rGroupEl) rGroupEl.setAttribute('transform', `skewX(${(-skewR).toFixed(2)})`);

      /* Rebuild paths — pass t so traveling wave animates */
      const dL0 = buildPath(L, 'l', W, H, 0,  t);
      const dR0 = buildPath(R, 'r', W, H, 0,  t);
      lMain.current?.setAttribute('d', dL0);
      lGlow.current?.setAttribute('d', dL0);
      lTex.current?.setAttribute('d',  dL0);
      lP1.current?.setAttribute('d',   buildPath(L, 'l', W, H,  8, t));
      lP2.current?.setAttribute('d',   buildPath(L, 'l', W, H, 22, t));
      lP3.current?.setAttribute('d',   buildPath(L, 'l', W, H, 44, t));

      rMain.current?.setAttribute('d', dR0);
      rGlow.current?.setAttribute('d', dR0);
      rTex.current?.setAttribute('d',  dR0);
      rP1.current?.setAttribute('d',   buildPath(R, 'r', W, H,  8, t));
      rP2.current?.setAttribute('d',   buildPath(R, 'r', W, H, 22, t));
      rP3.current?.setAttribute('d',   buildPath(R, 'r', W, H, 44, t));

      if (rRailRef.current) rRailRef.current.setAttribute('x', String(W - W_BASE - 2));
      if (rTasselEl) rTasselEl.setAttribute('transform', `translate(${W}, 0)`);
      /* Tie-back knots at 58% height */
      if (lTbRef.current) lTbRef.current.setAttribute('transform', `translate(${W_BASE - 14}, ${H * 0.58})`);
      if (rTbRef.current) rTbRef.current.setAttribute('transform', `translate(${W - W_BASE + 14}, ${H * 0.58})`);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('scroll', updateHero);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  if (!heroVisible) return null;

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0,
        width: '100%', height: heroH || '100vh',
        zIndex: 100, pointerEvents: 'none', overflow: 'visible',
      }}
    >
      <defs>
        {/* Velvet fabric texture — fractalNoise fiber overlay */}
        <filter id="cfr-vf" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.75 0.12" numOctaves="4" seed="8" result="noise"/>
          <feColorMatrix type="matrix"
            values="0 0 0 0 0.18  0 0 0 0 0.02  0 0 0 0 0.02  0 0 0 0.55 0"
            in="noise" result="tinted"/>
          <feBlend in="SourceGraphic" in2="tinted" mode="soft-light"/>
        </filter>

        {/* Velvet gradients — userSpaceOnUse across W_BASE=92px for consistent sheen */}
        {/* Velvet gradient — multiple fold highlights simulate gathered fabric */}
        <linearGradient id="cfr-vl" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="108" y2="0">
          <stop offset="0%"   stopColor="hsl(0,0%,4%)"   />  {/* wall edge — near black */}
          <stop offset="7%"   stopColor="hsl(0,0%,12%)"  />  {/* first fold shadow */}
          <stop offset="16%"  stopColor="hsl(0,0%,24%)"  />  {/* first fold highlight */}
          <stop offset="24%"  stopColor="hsl(0,0%,14%)"  />  {/* between folds */}
          <stop offset="34%"  stopColor="hsl(0,0%,30%)"  />  {/* second fold peak */}
          <stop offset="42%"  stopColor="hsl(0,0%,18%)"  />  {/* valley */}
          <stop offset="54%"  stopColor="hsl(0,0%,26%)"  />  {/* third fold */}
          <stop offset="65%"  stopColor="hsl(0,0%,15%)"  />  {/* shadow */}
          <stop offset="78%"  stopColor="hsl(0,0%,22%)"  />  {/* fourth fold */}
          <stop offset="90%"  stopColor="hsl(0,0%,10%)"  />  {/* inner shadow */}
          <stop offset="100%" stopColor="hsl(0,0%,6%)"   />  {/* inner edge dark */}
        </linearGradient>
        <linearGradient id="cfr-vr" gradientUnits="userSpaceOnUse" x1="100%" y1="0" x2="0%" y2="0">
          <stop offset="0%"   stopColor="hsl(0,0%,4%)"   />
          <stop offset="7%"   stopColor="hsl(0,0%,12%)"  />
          <stop offset="16%"  stopColor="hsl(0,0%,24%)"  />
          <stop offset="24%"  stopColor="hsl(0,0%,14%)"  />
          <stop offset="34%"  stopColor="hsl(0,0%,30%)"  />
          <stop offset="42%"  stopColor="hsl(0,0%,18%)"  />
          <stop offset="54%"  stopColor="hsl(0,0%,26%)"  />
          <stop offset="65%"  stopColor="hsl(0,0%,15%)"  />
          <stop offset="78%"  stopColor="hsl(0,0%,22%)"  />
          <stop offset="90%"  stopColor="hsl(0,0%,10%)"  />
          <stop offset="100%" stopColor="hsl(0,0%,6%)"   />
        </linearGradient>
        {/* Pleat shadow — subtle dark ribs for velvet depth */}
        <linearGradient id="cfr-pl" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="rgba(0,0,0,0.70)" />
          <stop offset="30%"  stopColor="rgba(0,0,0,0.06)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.28)" />
        </linearGradient>
        <linearGradient id="cfr-pr" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%"   stopColor="rgba(0,0,0,0.70)" />
          <stop offset="30%"  stopColor="rgba(0,0,0,0.06)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.28)" />
        </linearGradient>
        {/* Stage glow — warm light bleeds from behind pulled curtain */}
        <linearGradient id="cfr-gl" gradientUnits="userSpaceOnUse" x1="92" y1="0" x2="0" y2="0">
          <stop offset="0%"   stopColor="hsl(42,90%,55%)" stopOpacity="0.12" />
          <stop offset="60%"  stopColor="hsl(42,85%,50%)" stopOpacity="0.03" />
          <stop offset="100%" stopColor="hsl(42,80%,45%)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="cfr-gr" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%"   stopColor="hsl(42,90%,55%)" stopOpacity="0.12" />
          <stop offset="60%"  stopColor="hsl(42,85%,50%)" stopOpacity="0.03" />
          <stop offset="100%" stopColor="hsl(42,80%,45%)" stopOpacity="0" />
        </linearGradient>
        {/* Rail gradient — gold shimmer */}
        <linearGradient id="cfr-rail-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="hsl(48,95%,72%)" />
          <stop offset="45%"  stopColor="hsl(44,90%,58%)" />
          <stop offset="100%" stopColor="hsl(40,80%,38%)" />
        </linearGradient>
      </defs>

      {/* ── LEFT curtain — id used by tick() for skewX depth hint ── */}
      <g id="cfr-left">
        <path ref={lMain} fill="url(#cfr-vl)" filter="url(#cfr-vf)" />
        <path ref={lP1}   fill="url(#cfr-pl)" opacity="0.62" />
        <path ref={lP2}   fill="url(#cfr-pl)" opacity="0.38" />
        <path ref={lP3}   fill="url(#cfr-pl)" opacity="0.20" />
        <path ref={lTex}  fill="rgba(255,200,160,0.07)" />
        <path ref={lGlow} fill="url(#cfr-gl)" />
      </g>

      {/* ── RIGHT curtain ── */}
      <g id="cfr-right">
        <path ref={rMain} fill="url(#cfr-vr)" filter="url(#cfr-vf)" />
        <path ref={rP1}   fill="url(#cfr-pr)" opacity="0.62" />
        <path ref={rP2}   fill="url(#cfr-pr)" opacity="0.38" />
        <path ref={rP3}   fill="url(#cfr-pr)" opacity="0.20" />
        <path ref={rTex}  fill="rgba(255,200,160,0.07)" />
        <path ref={rGlow} fill="url(#cfr-gr)" />
      </g>

      {/* ── Gold top rails ── x for right rail updated in tick() */}
      <rect x="0" y="0" width="94" height="4"
        fill="url(#cfr-rail-grad)" opacity="0.92"
        style={{ filter: 'drop-shadow(0 0 8px hsl(42,88%,52%)) drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }} />
      <rect ref={rRailRef} x="0" y="0" width="94" height="4"
        fill="url(#cfr-rail-grad)" opacity="0.92"
        style={{ filter: 'drop-shadow(0 0 8px hsl(42,88%,52%)) drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }} />

      {/* ── Left tie-back knot — position updated by tick() via lTbRef ── */}
      <g ref={lTbRef} style={{ filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.8))' }}>
        <ellipse cx="0" cy="-6" rx="6" ry="20"
          fill="none" stroke="hsl(44,78%,42%)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="0" cy="0" r="10" fill="hsl(40,78%,32%)" />
        <circle cx="0" cy="0" r="7"  fill="hsl(44,88%,50%)" />
        <circle cx="0" cy="0" r="4"  fill="hsl(48,95%,68%)" />
        <circle cx="0" cy="0" r="1.5" fill="hsl(50,100%,88%)" />
      </g>

      {/* ── Right tie-back knot — position updated by tick() via rTbRef ── */}
      <g ref={rTbRef} style={{ filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.8))' }}>
        <ellipse cx="0" cy="-6" rx="6" ry="20"
          fill="none" stroke="hsl(44,78%,42%)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="0" cy="0" r="10" fill="hsl(40,78%,32%)" />
        <circle cx="0" cy="0" r="7"  fill="hsl(44,88%,50%)" />
        <circle cx="0" cy="0" r="4"  fill="hsl(48,95%,68%)" />
        <circle cx="0" cy="0" r="1.5" fill="hsl(50,100%,88%)" />
      </g>

      {/* ── Left tassel ── */}
      <g style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))' }}>
        <circle cx="92" cy="4" r="6" fill="hsl(44,88%,55%)" />
        <circle cx="92" cy="4" r="3.5" fill="hsl(50,100%,78%)" />
        <line x1="87" y1="10" x2="84" y2="28" stroke="hsl(44,85%,50%)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="92" y1="10" x2="90" y2="32" stroke="hsl(48,90%,60%)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="97" y1="10" x2="100" y2="28" stroke="hsl(44,85%,50%)" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      {/* Right tassel — x position updated via rRailRef sibling positioning; use fixed offset from right edge */}
      <g id="cfr-tassel-r" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))' }}>
        <circle cx="-6" cy="4" r="6" fill="hsl(44,88%,55%)" />
        <circle cx="-6" cy="4" r="3.5" fill="hsl(50,100%,78%)" />
        <line x1="-11" y1="10" x2="-14" y2="28" stroke="hsl(44,85%,50%)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="-6"  y1="10" x2="-8"  y2="32" stroke="hsl(48,90%,60%)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="-1"  y1="10" x2="2"   y2="28" stroke="hsl(44,85%,50%)" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/* Demo artworks & images — imported from shared lib */
import { DEMO_ARTWORKS, DEMO_IMGS } from '@/lib/demo';

/* ═══════════════════════════════════════════════════════════════════════════
   ART SPARKLES — golden light motes floating over artwork images
═══════════════════════════════════════════════════════════════════════════ */
const ART_SPARKS = [
  { x: '8%',  y: '78%', s: 2.2, dur: '4.4s', del: '0s'    },
  { x: '15%', y: '42%', s: 1.6, dur: '6.1s', del: '-1.3s' },
  { x: '20%', y: '14%', s: 2.6, dur: '5.5s', del: '-3.2s' },
  { x: '28%', y: '63%', s: 1.8, dur: '7.2s', del: '-0.8s' },
  { x: '36%', y: '30%', s: 1.4, dur: '4.8s', del: '-4.5s' },
  { x: '44%', y: '86%', s: 2.4, dur: '5.9s', del: '-2.1s' },
  { x: '50%', y: '52%', s: 1.3, dur: '8.0s', del: '-1.7s' },
  { x: '56%', y: '18%', s: 2.0, dur: '4.2s', del: '-3.8s' },
  { x: '63%', y: '72%', s: 1.7, dur: '6.4s', del: '-0.5s' },
  { x: '71%', y: '38%', s: 2.3, dur: '5.1s', del: '-2.9s' },
  { x: '79%', y: '58%', s: 1.5, dur: '7.5s', del: '-4.1s' },
  { x: '84%', y: '22%', s: 1.9, dur: '4.6s', del: '-1.0s' },
  { x: '89%', y: '82%', s: 2.7, dur: '5.8s', del: '-3.5s' },
  { x: '24%', y: '90%', s: 1.4, dur: '6.8s', del: '-2.4s' },
  { x: '73%', y: '93%', s: 1.8, dur: '4.0s', del: '-0.9s' },
  { x: '48%', y: '06%', s: 2.1, dur: '5.3s', del: '-5.0s' },
] as const;

function ArtSparkles() {
  return (
    <div className="art-sparkles" aria-hidden="true">
      {ART_SPARKS.map((sp, i) => (
        <span
          key={i}
          className="art-spark"
          style={{
            left: sp.x,
            top: sp.y,
            width: sp.s,
            height: sp.s,
            animationDuration: sp.dur,
            animationDelay: sp.del,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HERO GALLERY SLIDER — sliding carousel: entire frame moves on transition
═══════════════════════════════════════════════════════════════════════════ */
function HeroGallerySlider({ artworks }: { artworks: ArtworkInfo[] }) {
  const items = artworks.slice(0, 8);
  const [index, setIndex] = useState(0);
  const [dragDelta, setDragDelta] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const lastX = useRef(0);
  const velX = useRef(0);
  const lastT = useRef(0);
  const isHovered = useRef(false);

  const goTo = useCallback((i: number) => {
    setIndex(i);
    setDragDelta(0);
    dragging.current = false;
  }, []);

  const prev = useCallback(() => goTo((index - 1 + items.length) % items.length), [index, items.length, goTo]);
  const next = useCallback(() => goTo((index + 1) % items.length), [index, items.length, goTo]);

  /* Auto-play */
  useEffect(() => {
    const t = setInterval(() => {
      if (!isHovered.current && !dragging.current) next();
    }, 4000);
    return () => clearInterval(t);
  }, [next]);

  /* Keyboard */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [prev, next]);

  if (!items.length) return null;

  /* Pointer handlers */
  const onDown = (x: number) => {
    startX.current = x; lastX.current = x;
    lastT.current = Date.now(); velX.current = 0;
    dragging.current = true; setDragDelta(0);
  };
  const onMove = (x: number) => {
    if (!dragging.current) return;
    const now = Date.now(); const dt = now - lastT.current;
    if (dt > 0) velX.current = (x - lastX.current) / dt;
    lastX.current = x; lastT.current = now;
    setDragDelta(x - startX.current);
  };
  const onUp = (x: number) => {
    if (!dragging.current) return;
    const d = x - startX.current;
    if (Math.abs(d) > 55 || Math.abs(velX.current) > 0.35) {
      if (d > 0) prev(); else next();
    } else {
      goTo(index);
    }
  };

  const imgSrc = (a: ArtworkInfo) =>
    DEMO_IMGS[a.address] ||
    getIpfsUrlsForFallback(a.ipfsCID)[0] ||
    `https://picsum.photos/seed/${a.address}/400/560`;

  return (
    <div
      className="hgs-carousel"
      onMouseEnter={() => { isHovered.current = true; }}
      onMouseLeave={() => { isHovered.current = false; if (dragging.current) onUp(lastX.current); }}
      onMouseDown={e => onDown(e.clientX)}
      onMouseMove={e => onMove(e.clientX)}
      onMouseUp={e => onUp(e.clientX)}
      onTouchStart={e => onDown(e.touches[0].clientX)}
      onTouchMove={e => onMove(e.touches[0].clientX)}
      onTouchEnd={e => onUp(e.changedTouches[0].clientX)}
    >
      {/* Sliding track — translateX moves entire frame+artwork */}
      <div
        className="hgs-track"
        style={{
          transform: `translateX(calc(-${index * 100}% + ${dragDelta}px))`,
          transition: dragging.current ? 'none' : 'transform 0.52s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {items.map((artwork) => (
          <div key={artwork.address} className="hgs-slide">
            <Link
              href={`/artwork/${artwork.address}`}
              className="hgs-slide-inner"
              onClick={e => { if (Math.abs(dragDelta) > 10) e.preventDefault(); }}
              draggable={false}
            >
              {/* Artwork sits inside the frame PNG's white opening */}
              <div className="hgs-artwork-area">
                <img
                  src={imgSrc(artwork)}
                  alt={artwork.name}
                  className="hgs-artwork-img"
                  referrerPolicy="no-referrer"
                  draggable={false}
                  onError={e => {
                    (e.currentTarget as HTMLImageElement).src =
                      `https://picsum.photos/seed/${artwork.address}/400/560`;
                  }}
                />
              </div>
              {/* Museum nameplate inside frame */}
              <div className="hgs-nameplate">
                <span className="hgs-nameplate-text">{artwork.name}</span>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {/* Dots navigation */}
      <div className="hgs-dots">
        {items.map((_, i) => (
          <button
            key={i}
            className={`hgs-dot${i === index ? ' hgs-dot--on' : ''}`}
            onClick={() => goTo(i)}
            aria-label={`Artwork ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HERO SECTION
═══════════════════════════════════════════════════════════════════════════ */
function HeroSection({ artworks }: { artworks: ArtworkInfo[] }) {
  const displayArtworks = artworks.length > 0 ? artworks : DEMO_ARTWORKS;
  const totalVolume = artworks.reduce((s, a) => s + a.totalVolume, 0n);
  const graduated = artworks.filter(a => a.graduated).length;
  const artists = new Set(artworks.map(a => a.artist)).size;

  return (
    <section className="hero" aria-label="Hero">
      {/* Real gallery background */}
      <div
        className="hero-bg"
        style={{ backgroundImage: "url('/backgroundend.png')" }}
        aria-hidden="true"
      />
      {/* Dark overlay to blend bg with content */}
      <div className="hero-bg-overlay" aria-hidden="true" />

      {/* Floor reflection */}
      <div className="hero-floor" aria-hidden="true" />

      <div className="hero-inner">
        {/* ── Left text ── */}
        <div className="hero-text">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-line" />
            Live on Ethereum
            <span className="hero-eyebrow-line" />
          </div>

          <h1 className="hero-h1">
            art that<br />
            earns<br />
            <em className="hero-h1-em">forever.</em>
          </h1>

          <p className="hero-body">
            Tokenize your art into tradeable shares. Earn{' '}
            <strong style={{ color: 'var(--gold)' }}>5% royalty</strong>{' '}
            on every trade. Forever. Bonding curves — no middlemen.
          </p>

          <div className="hero-cta">
            <Link href="/create" className="hero-btn-primary">LAUNCH ARTWORK</Link>
            <Link href="/explore" className="hero-btn-ghost">EXPLORE</Link>
          </div>

          <div className="hero-stats">
            {[
              { v: artworks.length.toString(), l: 'ARTWORKS' },
              { v: `${formatEth(totalVolume, 1)}`, l: 'VOLUME' },
              { v: graduated.toString(), l: 'GRADUATED' },
              { v: artists.toString(), l: 'ARTISTS' },
            ].map(s => (
              <div key={s.l} className="hero-stat">
                <span className="hero-stat-val">{s.v}</span>
                <span className="hero-stat-lbl">{s.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right gallery slider ── */}
        <div className="hero-cf">
          <HeroGallerySlider artworks={displayArtworks} />
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   KING CARD — top featured artwork
═══════════════════════════════════════════════════════════════════════════ */
function KingCard({ artwork }: { artwork: ArtworkInfo }) {
  const imgSrc = DEMO_IMGS[artwork.address]
    || getIpfsUrlsForFallback(artwork.ipfsCID)[0]
    || `https://picsum.photos/seed/${artwork.address}/280/220`;
  const prog = graduationProgress(artwork.reserve);
  return (
    <Link href={`/artwork/${artwork.address}`} style={{ display: 'block', textDecoration: 'none' }}>
      <div style={{
        borderRadius: 14, overflow: 'hidden',
        background: 'linear-gradient(165deg, hsl(220 28% 6%), hsl(220 32% 4%))',
        border: `1px solid ${artwork.graduated ? 'rgba(212,175,55,0.30)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: '0 8px 30px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)',
        transition: 'all 0.2s',
      }}>
        <div style={{ height: 168, overflow: 'hidden', position: 'relative' }}>
          <img src={imgSrc} alt={artwork.name} referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.4s' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, hsl(220 32% 4%) 0%, transparent 55%)' }} />
        </div>
        <div style={{ padding: '11px 14px 15px' }}>
          <div style={{
            fontSize: 13.5, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            fontFamily: 'var(--font-display)',
          }}>{artwork.name}</div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.22)', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>
            {shortAddress(artwork.artist)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)', letterSpacing: '-0.01em' }}>
              {formatEth(artwork.price, 4)} <span style={{ fontSize: 10, opacity: 0.6, fontFamily: 'var(--font-mono)' }}>Ξ</span>
            </span>
            <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              +{formatEth(artwork.totalVolume, 1)} vol
            </span>
          </div>
          <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${Math.max(prog, 1)}%`,
              background: artwork.graduated
                ? 'linear-gradient(90deg, hsl(42 80% 42%), hsl(44 88% 58%))'
                : 'var(--green)',
              borderRadius: 99,
            }} />
          </div>
          {artwork.graduated && (
            <div style={{ textAlign: 'right', fontSize: 9.5, color: 'var(--gold)', marginTop: 4, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
              GRADUATED
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FEED SECTION — full-width 2-column layout below hero
═══════════════════════════════════════════════════════════════════════════ */
function FeedSection({ artworks, isLoading }: { artworks: ArtworkInfo[]; isLoading: boolean }) {
  const [tab, setTab] = useState<FilterTab>('trending');
  const [search, setSearch] = useState('');
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const displayArtworks = artworks.length > 0 ? artworks : DEMO_ARTWORKS;

  const searched = search.trim()
    ? displayArtworks.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.artist.toLowerCase().includes(search.toLowerCase())
      )
    : displayArtworks;

  const sorted = [...searched].sort((a, b) => {
    if (tab === 'trending')   return a.totalVolume > b.totalVolume ? -1 : 1;
    if (tab === 'newest')     return a.createdAt > b.createdAt ? -1 : 1;
    if (tab === 'graduating') return a.reserve > b.reserve ? -1 : 1;
    if (tab === 'graduated')  return (a.graduated && !b.graduated) ? -1 : 1;
    return 0;
  });

  const king = sorted[0];

  useEffect(() => {
    setFeed(displayArtworks.slice(0, 8).map((a, i) => ({
      id: `${a.address}-${i}`,
      type: (i % 3 === 0 ? 'sell' : i % 5 === 0 ? 'launch' : 'buy') as 'buy' | 'sell' | 'launch',
      artworkName: a.name,
      artworkAddr: a.address,
      user: shortAddress(a.artist),
      amount: formatEth(a.totalVolume > 0n ? a.totalVolume / BigInt(Math.max(Number(a.supply), 1)) : a.price, 4),
      shares: String(Math.max(Number(a.supply), 1)),
      time: Date.now() - i * 42_000,
    })));
  }, [artworks.length]);

  const ago = (t: number) => {
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60)   return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}h`;
  };

  const SECTION_TABS = [
    { id: 'trending'   as FilterTab, label: 'Movers',          dot: ''    },
    { id: 'newest'     as FilterTab, label: 'New',             dot: '🌱'  },
    { id: 'graduating' as FilterTab, label: 'About to grad',   dot: '⚡'  },
    { id: 'graduated'  as FilterTab, label: 'Graduated',       dot: '🌟'  },
  ];

  return (
    <section style={{
      background: 'hsl(220 22% 3%)',
      borderTop: '1px solid rgba(255,255,255,0.05)',
      padding: '44px 0 60px',
    }}>
      <div style={{
        maxWidth: 1320, margin: '0 auto', padding: '0 72px',
        display: 'flex', gap: 32, alignItems: 'flex-start',
      }}>

        {/* ── LEFT: King card + live feed ── */}
        <div style={{ width: 240, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{
              fontSize: 9.5, color: 'var(--gold)', letterSpacing: '0.22em',
              textTransform: 'uppercase', fontWeight: 700, fontFamily: 'var(--font-mono)',
            }}>Top Artwork</span>
          </div>
          {king && <KingCard artwork={king} />}

          {/* Live feed */}
          <div style={{ marginTop: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span className="live-dot" />
              <span style={{
                fontSize: 9.5, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.25)',
                textTransform: 'uppercase', fontWeight: 600, fontFamily: 'var(--font-mono)',
              }}>Live Feed</span>
            </div>
            {feed.map(e => {
              const isBuy    = e.type === 'buy';
              const isLaunch = e.type === 'launch';
              const actionColor = isBuy ? 'var(--green)' : isLaunch ? 'var(--gold)' : 'var(--terra)';
              const avatarBg   = isBuy ? 'var(--green-muted)' : isLaunch ? 'var(--gold-bg)' : 'var(--terra-dim)';
              return (
                <div key={e.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <span style={{ fontSize: 8, fontWeight: 800, color: 'white', fontFamily: 'var(--font-mono)' }}>
                      {e.user.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
                        color: actionColor, fontFamily: 'var(--font-mono)',
                      }}>{isBuy ? 'BUY' : isLaunch ? 'NEW' : 'SELL'}</span>
                      <Link href={`/artwork/${e.artworkAddr}`} style={{
                        fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.58)',
                        textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {e.artworkName.length > 16 ? e.artworkName.slice(0, 16) + '…' : e.artworkName}
                      </Link>
                    </div>
                    <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.18)', fontFamily: 'var(--font-mono)' }}>
                      {e.amount} Ξ · {ago(e.time)} ago
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Search + Tab bar + 4-col grid ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }}>⌕</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search artworks..."
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 10, padding: '10px 14px 10px 36px',
                color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--font-sans)', fontSize: 13,
                outline: 'none', transition: 'border-color 0.2s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)')}
              onBlur={e  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
            )}
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
            {SECTION_TABS.map(t => {
              const isActive = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '8px 14px', fontSize: 12.5, border: 'none', cursor: 'pointer',
                  borderRadius: '8px 8px 0 0', marginBottom: -1,
                  color: isActive ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.28)',
                  background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                  borderBottom: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                  fontWeight: isActive ? 600 : 400, transition: 'all 0.18s',
                  fontFamily: 'var(--font-sans)',
                }}>
                  {t.dot && <span style={{ fontSize: 11 }}>{t.dot}</span>}
                  {t.label}
                </button>
              );
            })}
            {/* Result count */}
            {search && (
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.28)', alignSelf: 'center', paddingRight: 4 }}>
                {sorted.length} result{sorted.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Artwork grid */}
          {!mounted || isLoading ? (
            <ArtworkListSkeleton count={8} />
          ) : sorted.length === 0 ? (
            <div className="empty-state" suppressHydrationWarning>
              <h2 className="empty-state-title">No artworks yet</h2>
              <p className="empty-state-desc">Be the first to launch an artwork with a bonding curve</p>
              <Link href="/create" className="btn-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 24px', textDecoration: 'none', borderRadius: 'var(--r-md)' }}>
                Launch First Artwork
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {sorted.map((aw, i) => (
                <GridCard key={aw.address} artwork={aw} rank={tab === 'trending' ? i + 1 : undefined} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GRID CARD
═══════════════════════════════════════════════════════════════════════════ */
const WL_KEY = 'artcurve-watchlist';
function useWatchlist() {
  const [wl, setWl] = useState<string[]>([]);
  useEffect(() => {
    try { setWl(JSON.parse(localStorage.getItem(WL_KEY) || '[]')); } catch { /* */ }
  }, []);
  const toggle = (addr: string) => setWl(prev => {
    const next = prev.includes(addr) ? prev.filter(a => a !== addr) : [...prev, addr];
    localStorage.setItem(WL_KEY, JSON.stringify(next));
    return next;
  });
  return { wl, toggle };
}

function GridCard({ artwork, rank }: { artwork: ArtworkInfo; rank?: number }) {
  const prog = graduationProgress(artwork.reserve);
  const isGrading = prog >= 80 && !artwork.graduated;
  const isNew = Date.now() / 1000 - Number(artwork.createdAt) < 86_400;
  const ipfsUrls = getIpfsUrlsForFallback(artwork.ipfsCID);
  const [imgIdx, setImgIdx] = useState(0);
  const imgSrc = DEMO_IMGS[artwork.address] || (imgIdx < ipfsUrls.length ? ipfsUrls[imgIdx] : `https://picsum.photos/seed/${artwork.address}/320/320`);
  const { wl, toggle } = useWatchlist();
  const watched = wl.includes(artwork.address);

  return (
    <div style={{ position: 'relative', display: 'block' }}>
      <Link href={`/artwork/${artwork.address}`} style={{ textDecoration: 'none', display: 'block' }}>
        <article className={`gc${isGrading || artwork.graduated ? ' gc--glow' : ''}`}>
          <div className="gc-img-wrap">
            <img src={imgSrc} alt={artwork.name} className="gc-img"
              onError={() => setImgIdx(i => i < ipfsUrls.length - 1 ? i + 1 : ipfsUrls.length)} />
            <div className="gc-img-overlay" />
            <ArtSparkles />
            {rank && rank <= 8 && (
              <div className={`gc-rank gc-rank--${Math.min(rank, 3)}`}>{rank}</div>
            )}
            {artwork.graduated && <div className="tag tag-gold gc-badge">GRAD</div>}
            {isGrading && !artwork.graduated && <div className="tag tag-gold gc-badge">SOON</div>}
            {isNew && !rank && !artwork.graduated && <div className="tag tag-teal gc-badge">NEW</div>}
          </div>
          <div className="gc-body">
            <div className="gc-row1">
              <h3 className="gc-name">{artwork.name}</h3>
              <span className="mono gc-price">{formatEth(artwork.price, 4)} Ξ</span>
            </div>
            <div className="gc-row2">
              <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{shortAddress(artwork.artist)}</span>
              <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 10 }}>vol {formatEth(artwork.totalVolume, 2)} Ξ</span>
            </div>
            <div className="gc-track">
              <div className={isGrading || artwork.graduated ? 'progress-bar-graduating' : 'progress-bar'} style={{ width: `${Math.max(prog, 1)}%` }} />
            </div>
            <div className="mono" style={{ fontSize: 9, color: isGrading ? 'var(--gold)' : 'var(--text-muted)', marginTop: 4 }}>
              {artwork.graduated ? 'graduated' : `${prog.toFixed(1)}% bonded`}
            </div>
          </div>
        </article>
      </Link>
      {/* Watchlist star — outside the Link to avoid navigation on click */}
      <button
        onClick={e => { e.stopPropagation(); toggle(artwork.address); }}
        title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: 10,
          background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%',
          width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 14, opacity: watched ? 1 : 0.5,
          color: watched ? 'var(--gold)' : 'rgba(255,255,255,0.7)',
          transition: 'opacity 0.15s, color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = watched ? '1' : '0.5'}
      >
        {watched ? '★' : '☆'}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HOME PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const { data: artworks, isLoading } = useAllArtworks();
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [showCurtain, setShowCurtain] = useState(true);
  const musicRef = useRef<MusicPlayerHandle>(null);

  useEffect(() => { setMounted(true); }, []);

  const list = artworks ?? [];

  const handleEnter = () => {
    musicRef.current?.resumeMusic();
    setEntered(true);
    setTimeout(() => setShowCurtain(false), 1000);
  };

  return (
    <>
      {/* Music player — persists across curtain */}
      <MusicPlayer ref={musicRef} />

      {/* Curtain & frame — client-only to prevent SSR hydration mismatch */}
      {mounted && !showCurtain && <CurtainFrame />}

      {mounted && showCurtain && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10002,
          transition: 'opacity 0.5s ease',
          opacity: entered ? 0 : 1,
          pointerEvents: entered ? 'none' : 'auto',
        }}>
          <CurtainEntrance onEnter={handleEnter} />
        </div>
      )}

      <HeroSection artworks={list} />

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0, padding: '24px 40px 64px' }}>
          <FeedSection artworks={list} isLoading={isLoading} />
        </div>
      </div>
    </>
  );
}
