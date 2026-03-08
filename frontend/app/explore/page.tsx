'use client';

import { useState, useMemo } from 'react';
import { useAllArtworks } from '@/lib/hooks';
import ArtworkCard from '@/components/ArtworkCard';
import { ArtworkListSkeleton } from '@/components/ui/Skeleton';
import { AsyncError } from '@/components/ui/ErrorBoundary';
import Link from 'next/link';

type SortOption = 'volume' | 'newest' | 'price' | 'graduating';

const SORT_LABELS: Record<SortOption, string> = {
  volume:     'trending',
  newest:     'newest',
  price:      'price',
  graduating: 'graduating',
};

// ─── Explore Page ─────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const { data: artworks, isLoading, isError, error, refetch } = useAllArtworks();
  const [sort, setSort]               = useState<SortOption>('volume');
  const [search, setSearch]           = useState('');
  const [showGradOnly, setShowGrad]   = useState(false);

  const sorted = useMemo(() => {
    return [...(artworks ?? [])]
      .filter((a) => {
        if (showGradOnly && !a.graduated) return false;
        if (search) {
          const q = search.toLowerCase();
          return a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (sort === 'volume')     return a.totalVolume > b.totalVolume ? -1 : 1;
        if (sort === 'newest')     return a.createdAt   > b.createdAt   ? -1 : 1;
        if (sort === 'price')      return a.price       > b.price       ? -1 : 1;
        if (sort === 'graduating') return a.reserve     > b.reserve     ? -1 : 1;
        return 0;
      });
  }, [artworks, sort, search, showGradOnly]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800,
            color: 'var(--text)', margin: 0, marginBottom: 4,
          }}>
            [explore artworks]
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            {isLoading
              ? 'scanning the chain…'
              : `${artworks?.length ?? 0} artworks with live bonding curves`}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          style={{
            padding:      '7px 14px',
            background:   'var(--surface)',
            border:       '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            color:        'var(--text-muted)',
            fontFamily:   'var(--font-mono)', fontSize: 11,
            cursor:       isLoading ? 'not-allowed' : 'pointer',
            opacity:      isLoading ? 0.4 : 1,
            transition:   'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = 'var(--green)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-focus)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
          }}
        >
          {isLoading ? '…' : '[refresh]'}
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
        paddingBottom: 16, borderBottom: '1px solid var(--border)',
      }}>
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search artworks or artist…"
          style={{
            background:   'var(--surface)',
            border:       '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding:      '8px 12px',
            color:        'var(--text)',
            fontFamily:   'var(--font-mono)',
            fontSize:     11,
            outline:      'none',
            minWidth:     220,
            transition:   'border-color 0.15s',
          }}
          onFocus={e  => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
          onBlur={e   => (e.currentTarget.style.borderColor = 'var(--border)')}
        />

        {/* Sort tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => {
            const active = sort === s;
            return (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{
                  padding:      '7px 14px',
                  background:   active ? 'var(--surface-2)' : 'transparent',
                  border:       `1px solid ${active ? 'var(--border-focus)' : 'transparent'}`,
                  borderRadius: 'var(--r-md)',
                  color:        active ? 'var(--green)' : 'var(--text-muted)',
                  fontFamily:   'var(--font-mono)', fontSize: 11,
                  cursor:       'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => !active && ((e.currentTarget as HTMLElement).style.color = 'var(--text-dim)')}
                onMouseLeave={e => !active && ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
              >
                {SORT_LABELS[s]}
              </button>
            );
          })}
        </div>

        {/* Graduated toggle */}
        <button
          onClick={() => setShowGrad(!showGradOnly)}
          style={{
            padding:      '7px 14px',
            background:   showGradOnly ? 'hsl(42 72% 48% / 0.12)' : 'transparent',
            border:       `1px solid ${showGradOnly ? 'hsl(42 72% 48% / 0.4)' : 'transparent'}`,
            borderRadius: 'var(--r-md)',
            color:        showGradOnly ? 'var(--gold)' : 'var(--text-muted)',
            fontFamily:   'var(--font-mono)', fontSize: 11,
            cursor:       'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => !showGradOnly && ((e.currentTarget as HTMLElement).style.color = 'var(--gold)')}
          onMouseLeave={e => !showGradOnly && ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
        >
          🎓 graduated
        </button>
      </div>

      {/* ── Content ── */}
      {isError ? (
        <AsyncError error={error} onRetry={() => refetch()} context="artworks" />
      ) : isLoading ? (
        <ArtworkListSkeleton count={8} />
      ) : sorted.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          border: '1px solid var(--border)', borderRadius: 'var(--r-xl)',
          background: 'var(--surface)',
        }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>{search ? '🔍' : '🌱'}</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            {search ? `no results for "${search}"` : 'no artworks yet'}
          </div>
          {!search && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              be the first to{' '}
              <Link href="/create" style={{ color: 'var(--green)', textDecoration: 'none' }}>
                create an artwork
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map((artwork, i) => (
            <ArtworkCard
              key={artwork.address}
              artwork={artwork}
              rank={sort === 'volume' ? i + 1 : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
