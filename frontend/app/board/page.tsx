'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAllArtworks } from '@/lib/hooks';
import { type ArtworkInfo, formatEth, graduationProgress, shortAddress, getIpfsUrlsForFallback } from '@/lib/contracts';

// ─── Watchlist helpers ────────────────────────────────────────────────────────
const WL_KEY = 'artcurve-watchlist';
function loadWatchlist(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]'); }
  catch { return []; }
}

// ─── Compact board card ───────────────────────────────────────────────────────
function BoardCard({ artwork, onWatchToggle, watched }: { artwork: ArtworkInfo; onWatchToggle: (addr: string) => void; watched: boolean }) {
  const prog = graduationProgress(artwork.reserve);
  const isGrading = prog >= 80 && !artwork.graduated;
  const ipfsUrls = getIpfsUrlsForFallback(artwork.ipfsCID);
  const [imgIdx, setImgIdx] = useState(0);
  const imgSrc = imgIdx < ipfsUrls.length
    ? ipfsUrls[imgIdx]
    : `https://picsum.photos/seed/${artwork.address}/80/80`;

  return (
    <div style={{
      background: 'var(--surface)', border: `1px solid ${artwork.graduated ? 'hsl(42 72% 48% / 0.35)' : isGrading ? 'hsl(42 72% 48% / 0.2)' : 'var(--border)'}`,
      borderRadius: 'var(--r-lg)', padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      transition: 'border-color 0.2s, background 0.15s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; (e.currentTarget as HTMLElement).style.borderColor = artwork.graduated ? 'hsl(42 72% 48% / 0.35)' : isGrading ? 'hsl(42 72% 48% / 0.2)' : 'var(--border)'; }}
    >
      {/* Image */}
      <Link href={`/artwork/${artwork.address}`} style={{ flexShrink: 0 }}>
        <img src={imgSrc} alt={artwork.name} width={40} height={40}
          onError={() => setImgIdx(i => i < ipfsUrls.length - 1 ? i + 1 : ipfsUrls.length)}
          style={{ width: 40, height: 40, borderRadius: 'var(--r-sm)', objectFit: 'cover', display: 'block', border: '1px solid var(--border-hover)' }}
        />
      </Link>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={`/artwork/${artwork.address}`} style={{ textDecoration: 'none' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {artwork.name}
          </div>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green)' }}>{formatEth(artwork.price, 5)} Ξ</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: isGrading ? 'var(--gold)' : 'var(--text-muted)' }}>
            {artwork.graduated ? '🌟 grad' : `${prog.toFixed(0)}%`}
          </span>
        </div>
        <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden', marginTop: 4 }}>
          <div style={{
            height: '100%', width: `${Math.max(prog, 1)}%`, borderRadius: 99,
            background: artwork.graduated || isGrading ? 'linear-gradient(90deg, hsl(42 80% 42%), hsl(44 88% 58%))' : 'var(--green)',
          }} />
        </div>
      </div>

      {/* Watch button */}
      <button onClick={() => onWatchToggle(artwork.address)}
        title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
        style={{ flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, opacity: watched ? 1 : 0.3, transition: 'opacity 0.15s', padding: '2px 4px' }}>
        {watched ? '★' : '☆'}
      </button>
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────
function BoardColumn({ title, accent, artworks, watchlist, onWatchToggle, emptyMsg }: {
  title: string; accent: string;
  artworks: ArtworkInfo[];
  watchlist: string[];
  onWatchToggle: (addr: string) => void;
  emptyMsg: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, minWidth: 0 }}>
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 0 12px', borderBottom: `2px solid ${accent}`, marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: accent, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {title}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 99 }}>
          {artworks.length}
        </span>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {artworks.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
            {emptyMsg}
          </div>
        ) : (
          artworks.map(aw => (
            <BoardCard
              key={aw.address}
              artwork={aw}
              watched={watchlist.includes(aw.address)}
              onWatchToggle={onWatchToggle}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Board page ───────────────────────────────────────────────────────────────
export default function BoardPage() {
  const { data: artworks = [], isLoading } = useAllArtworks();
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setWatchlist(loadWatchlist());
  }, []);

  const toggleWatch = (addr: string) => {
    setWatchlist(prev => {
      const next = prev.includes(addr) ? prev.filter(a => a !== addr) : [...prev, addr];
      localStorage.setItem(WL_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Column data
  const newArtworks = [...artworks]
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
    .slice(0, 20);

  const graduating = [...artworks]
    .filter(a => !a.graduated)
    .sort((a, b) => (a.reserve > b.reserve ? -1 : 1))
    .slice(0, 20);

  const trending = [...artworks]
    .sort((a, b) => (a.totalVolume > b.totalVolume ? -1 : 1))
    .slice(0, 20);

  const watched = artworks.filter(a => watchlist.includes(a.address));

  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, marginBottom: 4 }}>
          Board
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
          real-time view across all artworks · star to watch
        </p>
      </div>

      {isLoading ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', padding: '40px 0', textAlign: 'center' }}>
          loading artworks...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, alignItems: 'start' }}>
          <BoardColumn
            title="New"
            accent="var(--teal)"
            artworks={newArtworks}
            watchlist={watchlist}
            onWatchToggle={toggleWatch}
            emptyMsg="no artworks yet"
          />
          <BoardColumn
            title="Graduating"
            accent="var(--gold)"
            artworks={graduating}
            watchlist={watchlist}
            onWatchToggle={toggleWatch}
            emptyMsg="none graduating"
          />
          <BoardColumn
            title="Trending"
            accent="var(--green)"
            artworks={trending}
            watchlist={watchlist}
            onWatchToggle={toggleWatch}
            emptyMsg="no volume yet"
          />
          <BoardColumn
            title="Watchlist"
            accent="hsl(42 80% 60%)"
            artworks={watched}
            watchlist={watchlist}
            onWatchToggle={toggleWatch}
            emptyMsg="star artworks to watch them"
          />
        </div>
      )}
    </div>
  );
}
