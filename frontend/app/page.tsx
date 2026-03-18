'use client';

import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useAllArtworks } from '@/lib/hooks';

/* Three.js spotlight — loaded client-only (no SSR) */
const VolumetricSpotlight = dynamic(
  () => import('@/components/VolumetricSpotlight'),
  { ssr: false },
);
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
          {isPlaying && !effectiveMute && (
            <>
              <span className="gram-note">♪</span>
              <span className="gram-note">♫</span>
              <span className="gram-note">♩</span>
            </>
          )}
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
        <p className="ce-sub-text">NEO-LUXURY CLASSICAL ART GALLERY</p>
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
        position: 'fixed', top: 0, left: 0,
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
          <stop offset="0%"   stopColor="hsl(0,65%,4%)"  />  {/* wall edge — near black */}
          <stop offset="7%"   stopColor="hsl(0,72%,16%)" />  {/* first fold shadow */}
          <stop offset="16%"  stopColor="hsl(0,80%,36%)" />  {/* first fold highlight */}
          <stop offset="24%"  stopColor="hsl(0,76%,20%)" />  {/* between folds */}
          <stop offset="34%"  stopColor="hsl(0,84%,44%)" />  {/* second fold peak */}
          <stop offset="42%"  stopColor="hsl(0,78%,26%)" />  {/* valley */}
          <stop offset="54%"  stopColor="hsl(0,82%,38%)" />  {/* third fold */}
          <stop offset="65%"  stopColor="hsl(0,76%,22%)" />  {/* shadow */}
          <stop offset="78%"  stopColor="hsl(0,80%,32%)" />  {/* fourth fold */}
          <stop offset="90%"  stopColor="hsl(0,74%,14%)" />  {/* inner shadow */}
          <stop offset="100%" stopColor="hsl(0,68%,8%)"  />  {/* inner edge dark */}
        </linearGradient>
        <linearGradient id="cfr-vr" gradientUnits="userSpaceOnUse" x1="100%" y1="0" x2="0%" y2="0">
          <stop offset="0%"   stopColor="hsl(0,65%,4%)"  />
          <stop offset="7%"   stopColor="hsl(0,72%,16%)" />
          <stop offset="16%"  stopColor="hsl(0,80%,36%)" />
          <stop offset="24%"  stopColor="hsl(0,76%,20%)" />
          <stop offset="34%"  stopColor="hsl(0,84%,44%)" />
          <stop offset="42%"  stopColor="hsl(0,78%,26%)" />
          <stop offset="54%"  stopColor="hsl(0,82%,38%)" />
          <stop offset="65%"  stopColor="hsl(0,76%,22%)" />
          <stop offset="78%"  stopColor="hsl(0,80%,32%)" />
          <stop offset="90%"  stopColor="hsl(0,74%,14%)" />
          <stop offset="100%" stopColor="hsl(0,68%,8%)"  />
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

/* Demo artworks — 6 greatest masterpieces of all time */
const DEMO_ARTWORKS: ArtworkInfo[] = [
  { address: '0xdemo1', name: 'Mona Lisa',                  artist: '0xLeonardo',  ipfsCID: '', price: 120_000_000_000_000_000n, supply: 9n, reserve: 24_200_000_000_000_000_000n, totalVolume: 463_000_000_000_000_000_000n, createdAt: 1705000000n, graduated: true,  k: 1n, p0: 1n, marketCap: 0n, totalRoyalties: 0n },
  { address: '0xdemo2', name: 'Girl with a Pearl Earring',  artist: '0xVermeer',   ipfsCID: '', price: 58_900_000_000_000_000n, supply: 7n, reserve: 14_200_000_000_000_000_000n, totalVolume: 187_000_000_000_000_000_000n, createdAt: 1705010000n, graduated: false, k: 1n, p0: 1n, marketCap: 0n, totalRoyalties: 0n },
  { address: '0xdemo3', name: 'The Great Wave',              artist: '0xHokusai',   ipfsCID: '', price: 43_100_000_000_000_000n, supply: 6n, reserve:  9_100_000_000_000_000_000n, totalVolume:  98_000_000_000_000_000_000n, createdAt: 1705020000n, graduated: false, k: 1n, p0: 1n, marketCap: 0n, totalRoyalties: 0n },
  { address: '0xdemo4', name: 'Starry Night',               artist: '0xVanGogh',   ipfsCID: '', price: 68_000_000_000_000_000n, supply: 8n, reserve: 18_500_000_000_000_000_000n, totalVolume: 320_000_000_000_000_000_000n, createdAt: 1705030000n, graduated: false, k: 1n, p0: 1n, marketCap: 0n, totalRoyalties: 0n },
  { address: '0xdemo5', name: 'The Kiss',                   artist: '0xKlimt',     ipfsCID: '', price: 31_200_000_000_000_000n, supply: 4n, reserve:  6_700_000_000_000_000_000n, totalVolume:  45_000_000_000_000_000_000n, createdAt: 1705040000n, graduated: false, k: 1n, p0: 1n, marketCap: 0n, totalRoyalties: 0n },
  { address: '0xdemo6', name: 'Birth of Venus',             artist: '0xBotticelli', ipfsCID: '', price: 22_400_000_000_000_000n, supply: 3n, reserve:  3_800_000_000_000_000_000n, totalVolume:  28_000_000_000_000_000_000n, createdAt: 1705050000n, graduated: false, k: 1n, p0: 1n, marketCap: 0n, totalRoyalties: 0n },
];

/* Shared high-quality Wikimedia Commons images for demo artworks */
const DEMO_IMGS: Record<string, string> = {
  '0xdemo1': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/402px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg',
  '0xdemo2': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/1665_Girl_with_a_Pearl_Earring.jpg/800px-1665_Girl_with_a_Pearl_Earring.jpg',
  '0xdemo3': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Tsunami_by_hokusai_19th_century.jpg/1280px-Tsunami_by_hokusai_19th_century.jpg',
  '0xdemo4': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/1280px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
  '0xdemo5': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg/1024px-The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg',
  '0xdemo6': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg/1280px-Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg',
};

/* ═══════════════════════════════════════════════════════════════════════════
   PORTAL VORTEX — ornate deep-blue frame behind center card
═══════════════════════════════════════════════════════════════════════════ */
function PortalVortex() {
  return (
    <div style={{
      position: 'absolute',
      top: '50%', left: '50%',
      transform: 'translate(-50%, -52%)',
      width: 270, height: 356,
      zIndex: 0,
      borderRadius: 4,
      overflow: 'hidden',
      pointerEvents: 'none',
      border: '1.5px solid rgba(155,122,24,0.18)',
      boxShadow: 'inset 0 0 4px rgba(5,8,15,0.96), inset 0 0 6px rgba(110,86,18,0.12), inset 0 0 8px rgba(5,8,15,0.92), 0 0 36px rgba(0,0,0,0.80)',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: '#040810' }} />
      {/* Outer vortex ring */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 255, height: 255, borderRadius: '50%',
        background: 'conic-gradient(from 0deg, rgba(22,40,100,0.45), rgba(7,16,46,0.15), rgba(16,32,88,0.40), rgba(5,13,38,0.18), rgba(18,36,95,0.38), rgba(22,40,100,0.45))',
        filter: 'blur(20px)',
      }} />
      {/* Inner vortex */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 150, height: 150, borderRadius: '50%',
        background: 'conic-gradient(from 55deg, rgba(26,50,122,0.55), rgba(9,20,56,0.22), rgba(22,46,115,0.50), rgba(26,50,122,0.55))',
        filter: 'blur(12px)',
      }} />
      {/* Core glow */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 65, height: 65, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(40,78,178,0.58) 0%, rgba(18,36,102,0.32) 50%, transparent 80%)',
        filter: 'blur(10px)',
      }} />
      {/* Metallic frame accent lines */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(90deg, transparent 6%, rgba(148,116,24,0.18) 28%, rgba(188,150,36,0.28) 50%, rgba(148,116,24,0.18) 72%, transparent 94%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(90deg, transparent 6%, rgba(128,100,18,0.14) 28%, rgba(162,130,28,0.22) 50%, rgba(128,100,18,0.14) 72%, transparent 94%)' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 6, background: 'linear-gradient(180deg, transparent 6%, rgba(142,112,22,0.16) 28%, rgba(170,135,30,0.24) 50%, rgba(142,112,22,0.16) 72%, transparent 94%)' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 6, background: 'linear-gradient(180deg, transparent 6%, rgba(128,100,18,0.13) 28%, rgba(155,122,26,0.20) 50%, rgba(128,100,18,0.13) 72%, transparent 94%)' }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SLATE FLOOR — perspective reflection below the coverflow
═══════════════════════════════════════════════════════════════════════════ */
function SlateFloor({ active, items }: { active: number; items: Array<{ address: string; ipfsCID: string }> }) {
  const N = items.length;
  const neighbors = [-1, 0, 1].map(d => {
    const idx = ((active + d) % N + N) % N;
    const item = items[idx];
    return {
      d,
      src: DEMO_IMGS[item.address]
        || (item.ipfsCID ? `https://ipfs.io/ipfs/${item.ipfsCID}` : `https://picsum.photos/seed/${item.address}/218/400`),
    };
  });

  return (
    <div style={{
      position: 'relative', width: '100%',
      height: 44, overflow: 'hidden', marginTop: 2,
      background: 'linear-gradient(180deg, #0b1524 0%, #040810 55%, #020508 100%)',
      pointerEvents: 'none',
    }}>
      {/* Perspective grid SVG */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} preserveAspectRatio="none">
        {[1, 2, 3, 4].map(i => (
          <line key={'h' + i} x1="0" y1={`${i * 22}%`} x2="100%" y2={`${i * 22}%`}
            stroke="rgba(90,110,150,0.05)" strokeWidth="0.5" />
        ))}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
          <line key={'v' + i} x1={`${(i / 12) * 100}%`} y1="100%" x2="50%" y2="0%"
            stroke="rgba(70,90,130,0.03)" strokeWidth="0.4" />
        ))}
      </svg>

      {/* Matte reflections */}
      {neighbors.map(({ d, src }) => {
        const isC = d === 0;
        const tx  = d === 0 ? 0 : d === -1 ? -130 * 0.62 : 130 * 0.62;
        return (
          <div key={d} style={{
            position: 'absolute', top: 0, left: '50%',
            transform: `translateX(-50%) translateX(${tx}px) scaleY(-1) scale(${isC ? 0.88 * 0.68 : 0.78 * 0.48})`,
            transformOrigin: 'top center',
            width: 248, height: 480,
            opacity: isC ? 0.18 : 0.06,
            filter: `blur(${isC ? 7 : 13}px) saturate(0.4)`,
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 35%, transparent 65%)',
            maskImage:       'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 35%, transparent 65%)',
            borderRadius: 18, overflow: 'hidden',
            zIndex: isC ? 4 : 2,
          }}>
            <img src={src} alt="" referrerPolicy="no-referrer"
              style={{ width: '100%', height: 330, objectFit: 'cover', display: 'block' }} />
          </div>
        );
      })}

      {/* Gold floor pool glow */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 280, height: 38, zIndex: 6,
        background: 'radial-gradient(ellipse 55% 65% at 50% 0%, rgba(212,175,55,0.20) 0%, rgba(180,140,30,0.06) 55%, transparent 80%)',
        filter: 'blur(8px)',
      }} />

      {/* Bottom depth fade */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 9,
        background: 'linear-gradient(180deg, rgba(5,9,18,0) 0%, rgba(4,7,14,0.48) 38%, rgba(3,5,10,0.94) 100%)',
      }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CAROUSEL GOLD DUST — floating sparkle motes around the coverflow
═══════════════════════════════════════════════════════════════════════════ */
/* Hardcoded motes — avoids hydration mismatch from Math.random() */
const DUST_MOTES = [
  { x: '6%',  y: '78%', s: 2.6, dur: '3.4s', del: '-0.8s',  gold: true  },
  { x: '18%', y: '55%', s: 2.0, dur: '2.7s', del: '-2.1s',  gold: false },
  { x: '32%', y: '85%', s: 1.8, dur: '3.9s', del: '-1.4s',  gold: true  },
  { x: '47%', y: '42%', s: 2.9, dur: '2.9s', del: '-0.3s',  gold: false },
  { x: '61%', y: '70%', s: 2.3, dur: '3.1s', del: '-3.0s',  gold: true  },
  { x: '74%', y: '52%', s: 1.6, dur: '4.2s', del: '-1.7s',  gold: false },
  { x: '87%', y: '80%', s: 2.5, dur: '2.6s', del: '-0.9s',  gold: true  },
  { x: '12%', y: '32%', s: 1.9, dur: '3.7s', del: '-2.5s',  gold: true  },
  { x: '43%', y: '22%', s: 2.1, dur: '2.4s', del: '-1.2s',  gold: false },
  { x: '68%', y: '38%', s: 1.7, dur: '4.4s', del: '-3.8s',  gold: true  },
  { x: '28%', y: '48%', s: 3.1, dur: '3.0s', del: '-0.6s',  gold: false },
  { x: '56%', y: '65%', s: 2.4, dur: '2.8s', del: '-2.9s',  gold: true  },
  { x: '82%', y: '28%', s: 1.5, dur: '3.5s', del: '-4.1s',  gold: true  },
  { x: '38%', y: '90%', s: 2.0, dur: '2.5s', del: '-1.9s',  gold: false },
] as const;

function CarouselDust() {
  return (
    <div className="cf-dust" aria-hidden="true">
      {DUST_MOTES.map((m, i) => (
        <span
          key={i}
          className="cf-dust-mote"
          style={{
            left: m.x,
            top: m.y,
            width:  m.s,
            height: m.s,
            background: m.gold
              ? 'radial-gradient(circle, hsl(50,100%,85%) 0%, hsl(44,92%,62%) 60%, transparent 100%)'
              : 'radial-gradient(circle, hsl(40,60%,90%) 0%, hsl(38,50%,70%) 60%, transparent 100%)',
            boxShadow: m.gold ? `0 0 ${m.s * 2.5}px ${m.s * 0.8}px hsl(48,95%,68%/0.7)` : 'none',
            '--dur':   m.dur,
            '--del':   m.del,
            '--drift': m.gold ? '8px' : '-6px',
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HERO COVERFLOW — 3D carousel
═══════════════════════════════════════════════════════════════════════════ */
function HeroCoverflow({ artworks }: { artworks: ArtworkInfo[] }) {
  const [active, setActive] = useState(0);
  const items = artworks.slice(0, Math.min(artworks.length, 7));
  const dragStart = useRef(0);
  const isDragging = useRef(false);
  const isHovered = useRef(false);
  const velocity = useRef(0);
  const lastX = useRef(0);
  const lastTime = useRef(0);

  const prev = useCallback(() => setActive(i => (i - 1 + items.length) % items.length), [items.length]);
  const next = useCallback(() => setActive(i => (i + 1) % items.length), [items.length]);

  /* Auto-play: advance every 3.5s, pause when hovered or dragging */
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isHovered.current && !isDragging.current) {
        setActive(i => (i + 1) % items.length);
      }
    }, 3500);
    return () => clearInterval(timer);
  }, [items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next]);

  /* Use shared demo image map */
  const demoImgs = DEMO_IMGS;

  return (
    <div
      className="cf-wrapper"
      onMouseEnter={() => { isHovered.current = true; }}
      onMouseLeave={() => { isHovered.current = false; }}
    >
      <div
        className="cf-stage"
        onMouseDown={e => {
          dragStart.current = e.clientX;
          lastX.current = e.clientX;
          lastTime.current = Date.now();
          velocity.current = 0;
          isDragging.current = false;
        }}
        onMouseMove={e => {
          if (Math.abs(e.clientX - dragStart.current) > 8) isDragging.current = true;
          const now = Date.now();
          const dt = now - lastTime.current;
          if (dt > 0) velocity.current = (e.clientX - lastX.current) / dt;
          lastX.current = e.clientX;
          lastTime.current = now;
        }}
        onMouseUp={e => {
          const d = e.clientX - dragStart.current;
          const v = velocity.current;
          if (Math.abs(v) > 0.3 || Math.abs(d) > 40) {
            if (d > 0 || v > 0.3) prev(); else next();
          }
          isDragging.current = false;
          velocity.current = 0;
        }}
        onTouchStart={e => { dragStart.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const d = e.changedTouches[0].clientX - dragStart.current;
          if (d > 45) prev(); else if (d < -45) next();
        }}
      >
        {/* Volumetric spotlight — tracks active center card */}
        <VolumetricSpotlight />

        {/* Portal vortex — ornate frame behind center card */}
        <PortalVortex />

        {items.map((artwork, i) => {
          /* Circular offset: always take the shortest path so wrapping is smooth */
          let offset = i - active;
          if (offset > items.length / 2) offset -= items.length;
          if (offset < -items.length / 2) offset += items.length;
          const abs = Math.abs(offset);
          if (abs > 2) return null;

          const imgSrc = demoImgs[artwork.address]
            || getIpfsUrlsForFallback(artwork.ipfsCID)[0]
            || `https://picsum.photos/seed/${artwork.address}/400/600`;
          const progress = graduationProgress(artwork.reserve);
          const isGrad = artwork.graduated;
          const isGrading = progress >= 80 && !isGrad;

          /* 3D coverflow — ARC values matching reference design */
          const ARC: Record<number, { tx: number; tz: number; ry: number; sc: number; op: number; blur: number }> = {
            0:  { tx:    0, tz:    0, ry:   0, sc: 1.00, op: 1.00, blur: 0   },
            1:  { tx:  130, tz:  -98, ry: -45, sc: 0.74, op: 0.54, blur: 2.8 },
           '-1':{ tx: -130, tz:  -98, ry:  45, sc: 0.74, op: 0.54, blur: 2.8 },
            2:  { tx:  265, tz: -220, ry: -56, sc: 0.52, op: 0.22, blur: 6.5 },
           '-2':{ tx: -265, tz: -220, ry:  56, sc: 0.52, op: 0.22, blur: 6.5 },
          };
          const arc    = ARC[offset] ?? ARC[offset > 0 ? 2 : -2];
          const rotY   = arc.ry;
          const transX = arc.tx;
          const transZ = arc.tz;
          const transY = abs === 0 ? -10 : abs === 1 ? 12 : 28;
          const scale  = arc.sc;
          const opac   = arc.op;
          const z      = 30 - abs * 10;
          const bright = abs === 0 ? 1 : abs === 1 ? 0.52 : 0.25;
          const blur   = arc.blur;

          const handleClick = () => {
            if (isDragging.current) return;
            if (offset === 0) {
              window.location.href = `/artwork/${artwork.address}`;
            } else if (offset < 0) {
              prev();
            } else {
              next();
            }
          };

          return (
            <div
              key={artwork.address}
              className="cf-item"
              style={{
                transform: `translateX(${transX}px) translateZ(${transZ}px) rotateY(${rotY}deg) translateY(${transY}px) scale(${scale})`,
                opacity: opac,
                zIndex: z,
                filter: `brightness(${bright}) blur(${blur}px)`,
                pointerEvents: abs <= 1 ? 'auto' : 'none',
                cursor: abs <= 1 ? 'pointer' : 'default',
              }}
              onClick={handleClick}
            >
              <div className={`cf-card${offset === 0 ? ' cf-card--active' : ''}${isGrad || isGrading ? ' cf-card--gold' : ''}`}>
                {/* Image area */}
                <div className="cf-img-area">
                  {/* Spotlight rim light — top edge of active card */}
                  {offset === 0 && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0,
                      height: 3, zIndex: 20, pointerEvents: 'none',
                      background: 'linear-gradient(90deg, transparent 4%, rgba(255,252,195,0.95) 18%, rgba(255,255,220,1.0) 50%, rgba(255,252,195,0.95) 82%, transparent 96%)',
                      boxShadow: '0 0 16px rgba(255,248,170,0.8), 0 1px 28px rgba(255,242,140,0.35)',
                    }} />
                  )}
                  {/* Warm spotlight wash — upper area of active card */}
                  {offset === 0 && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: '35%',
                      background: 'linear-gradient(180deg, rgba(255,248,175,0.10) 0%, transparent 100%)',
                      zIndex: 18, pointerEvents: 'none',
                    }} />
                  )}
                  <img
                    src={imgSrc}
                    alt={artwork.name}
                    className="cf-img"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    onError={e => { (e.currentTarget as HTMLImageElement).src = `https://picsum.photos/seed/${artwork.address}/400/600`; }}
                  />
                  <div className="cf-img-overlay" />
                  <div className="cf-img-tag">{artwork.name}</div>
                  {(isGrad || isGrading) && (
                    <div className="cf-state-tag">
                      {isGrad ? '🌟 GRADUATED' : `⚡ ${progress.toFixed(0)}%`}
                    </div>
                  )}
                </div>

                {/* Info below image — only active card */}
                {offset === 0 && (
                  <div className="cf-info">
                    <div className="cf-info-row1">
                      <span className="cf-title">{artwork.name}</span>
                      <span className="cf-price mono">{formatEth(artwork.price, 4)}</span>
                    </div>
                    <div className="cf-info-row2">
                      <span className="cf-artist mono">
                        {shortAddress(artwork.artist)}
                        {Number(artwork.createdAt) > 0 && (
                          <span style={{ color: 'var(--text-muted)' }}> · {new Date(Number(artwork.createdAt) * 1000).getFullYear()}</span>
                        )}
                      </span>
                      {Number(artwork.supply) > 0 && (
                        <span className="cf-trend mono">+{((Number(artwork.supply) * 0.1) + 0.5).toFixed(1)}% ↑</span>
                      )}
                    </div>
                    <div className="cf-progress-wrap">
                      <div className="cf-progress-track">
                        <div
                          className={isGrading || isGrad ? 'progress-bar-graduating' : 'progress-bar'}
                          style={{ width: `${Math.max(progress, 1)}%`, height: '100%' }}
                        />
                      </div>
                      <div className="cf-progress-labels mono">
                        <span>{formatEth(artwork.reserve, 2)} / 24.0 reserve</span>
                        <span style={{ color: isGrading ? 'var(--gold)' : 'var(--text-muted)' }}>{progress.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Slate floor reflection */}
      <SlateFloor active={active} items={items} />

      {/* Gold dust sparkle motes */}
      <CarouselDust />

      {/* Royalty pill — floats just above the nav, close to card bottom */}
      <div className="cf-royalty-pill">♦ 5% royalty on every trade</div>

      {/* Nav */}
      <div className="cf-nav">
        <button className="cf-arrow" onClick={prev} aria-label="Prev">‹</button>
        <div className="cf-dots">
          {items.map((_, i) => (
            <button
              key={i}
              className={`cf-dot${i === active ? ' cf-dot--on' : ''}`}
              onClick={() => setActive(i)}
              aria-label={`Card ${i + 1}`}
            />
          ))}
        </div>
        <button className="cf-arrow" onClick={next} aria-label="Next">›</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PILLAR RIM LIGHTS — Greek column edge-lighting overlays
═══════════════════════════════════════════════════════════════════════════ */
function PillarRimLights() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Left near pillar */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '8%',
        width: 70, marginLeft: -35,
        background: 'linear-gradient(90deg, rgba(65,108,170,0.10) 0%, rgba(8,14,26,0.55) 5px, rgba(9,15,27,0.44) 45%, rgba(9,15,27,0.44) 55%, rgba(7,12,22,0.55) calc(100% - 5px), rgba(45,75,135,0.05) 100%)',
      }} />
      {/* Left mid pillar */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '18%',
        width: 58, marginLeft: -29,
        background: 'linear-gradient(90deg, rgba(55,85,145,0.07) 0%, rgba(8,14,24,0.42) 5px, rgba(9,15,25,0.34) 45%, rgba(9,15,25,0.34) 55%, rgba(7,12,20,0.42) calc(100% - 5px), rgba(35,62,115,0.04) 100%)',
      }} />
      {/* Right near pillar */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, right: '8%',
        width: 70, marginRight: -35,
        background: 'linear-gradient(90deg, rgba(45,75,135,0.05) 0%, rgba(7,12,22,0.55) 5px, rgba(9,15,27,0.44) 45%, rgba(9,15,27,0.44) 55%, rgba(8,14,26,0.55) calc(100% - 5px), rgba(65,108,170,0.10) 100%)',
      }} />
      {/* Right mid pillar */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, right: '18%',
        width: 58, marginRight: -29,
        background: 'linear-gradient(90deg, rgba(35,62,115,0.04) 0%, rgba(7,12,20,0.42) 5px, rgba(9,15,25,0.34) 45%, rgba(9,15,25,0.34) 55%, rgba(8,14,24,0.42) calc(100% - 5px), rgba(55,85,145,0.07) 100%)',
      }} />
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
        style={{ backgroundImage: "url('/gallery-bg.png')" }}
        aria-hidden="true"
      />
      {/* Dark overlay to blend bg with content */}
      <div className="hero-bg-overlay" aria-hidden="true" />

      {/* Pillar rim-light overlays */}
      <PillarRimLights />

      {/* Ambient ceiling beam spots */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: '13%', width: 108, height: '58%',
          background: 'linear-gradient(180deg, rgba(195,185,148,0.042) 0%, transparent 100%)',
          clipPath: 'polygon(36% 0%, 64% 0%, 86% 100%, 14% 100%)', filter: 'blur(12px)' }} />
        <div style={{ position: 'absolute', top: 0, right: '5.5%', width: 92, height: '52%',
          background: 'linear-gradient(180deg, rgba(195,185,148,0.034) 0%, transparent 100%)',
          clipPath: 'polygon(34% 0%, 66% 0%, 88% 100%, 12% 100%)', filter: 'blur(12px)' }} />
      </div>

      {/* Floor reflection */}
      <div className="hero-floor" aria-hidden="true" />

      <div className="hero-inner">
        {/* ── Left text ── */}
        <div className="hero-text">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-line" />
            LIVE ON ETHEREUM
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

        {/* ── Right coverflow ── */}
        <div className="hero-cf">
          <HeroCoverflow artworks={displayArtworks} />
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
              🌟 GRADUATED
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
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const displayArtworks = artworks.length > 0 ? artworks : DEMO_ARTWORKS;

  const sorted = [...displayArtworks].sort((a, b) => {
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
    { id: 'trending'   as FilterTab, label: 'Trending',   icon: '🔥' },
    { id: 'newest'     as FilterTab, label: 'Newest',     icon: '✨' },
    { id: 'graduating' as FilterTab, label: 'Graduating', icon: '⚡' },
    { id: 'graduated'  as FilterTab, label: 'Graduated',  icon: '🌟' },
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
            }}>♛ Top Artwork</span>
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

        {/* ── RIGHT: Tab bar + 4-col grid ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {SECTION_TABS.map(t => {
              const isActive = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 18px', fontSize: 12.5, border: 'none', cursor: 'pointer',
                  borderRadius: '8px 8px 0 0', marginBottom: -1,
                  color: isActive ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.28)',
                  background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                  borderBottom: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                  fontWeight: isActive ? 600 : 400, transition: 'all 0.18s',
                  fontFamily: 'var(--font-sans)',
                }}>
                  <span>{t.icon}</span> {t.label}
                </button>
              );
            })}
          </div>

          {/* Artwork grid */}
          {!mounted || isLoading ? (
            <ArtworkListSkeleton count={8} />
          ) : sorted.length === 0 ? (
            <div className="empty-state" suppressHydrationWarning>
              <div className="empty-state-icon">🎨</div>
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
function GridCard({ artwork, rank }: { artwork: ArtworkInfo; rank?: number }) {
  const prog = graduationProgress(artwork.reserve);
  const isGrading = prog >= 80 && !artwork.graduated;
  const isNew = Date.now() / 1000 - Number(artwork.createdAt) < 86_400;
  const ipfsUrls = getIpfsUrlsForFallback(artwork.ipfsCID);
  const [imgIdx, setImgIdx] = useState(0);
  const imgSrc = DEMO_IMGS[artwork.address] || (imgIdx < ipfsUrls.length ? ipfsUrls[imgIdx] : `https://picsum.photos/seed/${artwork.address}/320/320`);

  return (
    <Link href={`/artwork/${artwork.address}`} style={{ textDecoration: 'none', display: 'block' }}>
      <article className={`gc${isGrading || artwork.graduated ? ' gc--glow' : ''}`}>
        <div className="gc-img-wrap">
          <img src={imgSrc} alt={artwork.name} className="gc-img"
            onError={() => setImgIdx(i => i < ipfsUrls.length - 1 ? i + 1 : ipfsUrls.length)} />
          <div className="gc-img-overlay" />
          {rank && rank <= 8 && (
            <div className={`gc-rank gc-rank--${Math.min(rank, 3)}`}>{rank}</div>
          )}
          {artwork.graduated && <div className="tag tag-gold gc-badge">🌟 GRAD</div>}
          {isGrading && !artwork.graduated && <div className="tag tag-gold gc-badge">⚡ SOON</div>}
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
            {artwork.graduated ? '🌟 graduated' : `${prog.toFixed(1)}% bonded`}
          </div>
        </div>
      </article>
    </Link>
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
          position: 'fixed', inset: 0, zIndex: 9999,
          transition: 'opacity 0.5s ease',
          opacity: entered ? 0 : 1,
          pointerEvents: entered ? 'none' : 'auto',
        }}>
          <CurtainEntrance onEnter={handleEnter} />
        </div>
      )}

      <HeroSection artworks={list} />

      <FeedSection artworks={list} isLoading={isLoading} />
    </>
  );
}
