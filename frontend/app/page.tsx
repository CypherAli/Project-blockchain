'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAllArtworks } from '@/lib/hooks';
import ArtworkCard from '@/components/ArtworkCard';
import { ArtworkListSkeleton } from '@/components/ui/Skeleton';
import { type ArtworkInfo, formatEth, graduationProgress, shortAddress, timeAgo } from '@/lib/contracts';

type FilterTab = 'trending' | 'newest' | 'graduating' | 'graduated';

// ─── Live feed entry ──────────────────────────────────────────────────────────

interface FeedEntry {
  id: string;
  type: 'buy' | 'sell' | 'launch';
  artworkName: string;
  artworkAddr: string;
  user: string;
  amount: string;
  time: number;
}

// ─── King of the Hill card ────────────────────────────────────────────────────

function KingCard({ artwork }: { artwork: ArtworkInfo }) {
  const progressPct = graduationProgress(artwork.reserve);
  const isGraduating = progressPct >= 80 && !artwork.graduated;

  return (
    <Link href={`/artwork/${artwork.address}`} style={{ display: 'block', textDecoration: 'none' }}>
      <div
        className={isGraduating || artwork.graduated ? 'graduating-glow' : ''}
        style={{
          position:     'relative',
          background:   'var(--surface)',
          border:       `1px solid ${artwork.graduated ? 'var(--gold)' : isGraduating ? 'var(--gold-light)' : 'var(--border)'}`,
          borderRadius: 'var(--r-lg)',
          padding:      16,
          display:      'flex',
          gap:          14,
          cursor:       'pointer',
          overflow:     'hidden',
          transition:   'border-color 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px var(--gold-glow)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = artwork.graduated ? 'var(--gold)' : isGraduating ? 'var(--gold-light)' : 'var(--border)';
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        }}
      >
        {/* Gold ambient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 20% 50%, hsl(42 72% 48% / 0.06) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        {/* Image */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img
            src={`https://picsum.photos/seed/${artwork.address}/100/100`}
            alt={artwork.name}
            width={96}
            height={96}
            style={{ width: 96, height: 96, borderRadius: 'var(--r-md)', objectFit: 'cover', border: '1.5px solid var(--gold)' }}
          />
          <div style={{
            position: 'absolute', top: -8, left: -8,
            background: 'var(--gold)', color: 'hsl(135 28% 8%)',
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800,
            padding: '2px 7px', borderRadius: 'var(--r-full)',
            border: '1.5px solid var(--bg)', letterSpacing: '0.08em',
          }}>
            KING
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--gold)', letterSpacing: '0.08em', marginBottom: 4 }}>
            👑 king of the hill
          </div>
          <h2 style={{
            fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 800,
            color: 'var(--text)', margin: 0, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4,
          }}>
            {artwork.name}
          </h2>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 12 }}>
            by {shortAddress(artwork.artist)}
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'price',   value: `${formatEth(artwork.price, 5)} Ξ`,       color: 'var(--green)' },
              { label: 'mkt cap', value: `${formatEth(artwork.marketCap, 3)} Ξ`,   color: 'var(--text)' },
              { label: 'royalty', value: `${formatEth(artwork.totalRoyalties, 4)} Ξ`, color: 'var(--gold)' },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>bonding curve</span>
              <span style={{ color: 'var(--gold)' }}>{progressPct.toFixed(1)}%</span>
            </div>
            <div style={{ height: 5, background: 'var(--surface-3)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
              <div className="progress-bar-graduating" style={{ width: `${Math.max(progressPct, 2)}%`, height: '100%' }} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Live feed ────────────────────────────────────────────────────────────────

function LiveFeed({ artworks }: { artworks: ArtworkInfo[] }) {
  const [feed, setFeed] = useState<FeedEntry[]>([]);

  useEffect(() => {
    if (artworks.length === 0) return;
    const entries: FeedEntry[] = artworks.slice(0, 10).map((a, i) => ({
      id:          `${a.address}-${i}`,
      type:        i % 3 === 0 ? 'sell' : i % 5 === 0 ? 'launch' : 'buy',
      artworkName: a.name,
      artworkAddr: a.address,
      user:        shortAddress(a.artist),
      amount:      formatEth(a.totalVolume > 0n ? a.totalVolume / BigInt(Math.max(Number(a.supply), 1)) : a.price, 5),
      time:        Date.now() - i * 42_000,
    }));
    setFeed(entries);
  }, [artworks.length]);

  const getTypeColor = (type: string) =>
    type === 'buy' ? 'var(--green)' : type === 'sell' ? 'var(--terra)' : 'var(--teal)';

  const localTimeAgo = (t: number) => {
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}h`;
  };

  return (
    <div className="glass" style={{ padding: 14, borderRadius: 'var(--r-lg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
          live feed
        </span>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'block', boxShadow: '0 0 6px var(--green)', animation: 'root-pulse 2s ease-in-out infinite' }} />
      </div>

      {/* Entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 280, overflowY: 'auto' }}>
        {feed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
            no activity yet
          </div>
        ) : feed.map((e) => (
          <div
            key={e.id}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 6,
              padding: '6px 0', borderBottom: '1px solid var(--border)',
              fontSize: 11,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800, color: getTypeColor(e.type), flexShrink: 0, marginTop: 1 }}>
              {e.type.toUpperCase()}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{e.user} </span>
              <span style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-muted)' }}>
                {e.type === 'buy' ? 'bought' : e.type === 'sell' ? 'sold' : 'launched'}{' '}
              </span>
              <Link
                href={`/artwork/${e.artworkAddr}`}
                style={{ color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: 11, textDecoration: 'none' }}
                onMouseEnter={ev => (ev.currentTarget.style.color = 'var(--green)')}
                onMouseLeave={ev => (ev.currentTarget.style.color = 'var(--text)')}
              >
                {e.artworkName.length > 18 ? e.artworkName.slice(0, 18) + '…' : e.artworkName}
              </Link>
              {e.type !== 'launch' && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}> {e.amount} Ξ</span>
              )}
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>
              {localTimeAgo(e.time)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Why ArtCurve box ─────────────────────────────────────────────────────────

function WhyCard() {
  const points = [
    ['✦', 'real artwork backing'],
    ['✦', '5% royalty every trade'],
    ['✦', 'fractional ownership'],
    ['✦', 'IPFS permanent storage'],
    ['✦', 'on-chain provenance'],
  ];
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: 14,
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 10 }}>
        why artcurve.fun?
      </div>
      {points.map(([icon, text]) => (
        <div key={text} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
          <span style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{icon}</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-dim)' }}>{text}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { data: artworks, isLoading } = useAllArtworks();
  const [filter, setFilter] = useState<FilterTab>('trending');

  const totalVolume    = artworks?.reduce((s, a) => s + a.totalVolume, 0n) ?? 0n;
  const graduatedCount = artworks?.filter((a) => a.graduated).length ?? 0;

  const sorted = [...(artworks ?? [])].sort((a, b) => {
    if (filter === 'trending')   return a.totalVolume > b.totalVolume ? -1 : 1;
    if (filter === 'newest')     return a.createdAt   > b.createdAt   ? -1 : 1;
    if (filter === 'graduating') return a.reserve     > b.reserve     ? -1 : 1;
    if (filter === 'graduated')  return a.graduated && !b.graduated    ? -1 : 1;
    return 0;
  });

  const king = artworks && artworks.length > 0
    ? [...artworks].sort((a, b) => a.totalVolume > b.totalVolume ? -1 : 1)[0]
    : null;

  const TABS: { id: FilterTab; label: string }[] = [
    { id: 'trending',   label: 'trending'   },
    { id: 'newest',     label: 'newest'     },
    { id: 'graduating', label: 'graduating' },
    { id: 'graduated',  label: 'graduated'  },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Stats bar ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        justifyContent: 'space-between', gap: 12, paddingBottom: 16,
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {[
            { label: 'artworks', value: (artworks?.length ?? 0).toString(), color: 'var(--text)' },
            { label: 'volume',   value: `${formatEth(totalVolume, 3)} Ξ`,   color: 'var(--green)' },
            { label: 'graduated', value: graduatedCount.toString(),          color: 'var(--gold)'  },
          ].map((s) => (
            <div key={s.label} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>{s.label}{' '}</span>
              <span style={{ color: s.color, fontWeight: 700 }}>{s.value}</span>
            </div>
          ))}
        </div>
        <Link
          href="/create"
          className="btn"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, padding: '8px 18px', textDecoration: 'none' }}
        >
          [start a new artwork]
        </Link>
      </div>

      {/* ── Main grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 20 }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {king && <KingCard artwork={king} />}
          <LiveFeed artworks={artworks ?? []} />
          <WhyCard />
        </div>

        {/* Right column: list */}
        <div>
          {/* Filter tabs */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16,
            paddingBottom: 12, borderBottom: '1px solid var(--border)',
          }}>
            {TABS.map(({ id, label }) => {
              const active = filter === id;
              return (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  style={{
                    padding:      '6px 14px',
                    background:   active ? 'var(--surface-2)' : 'transparent',
                    border:       `1px solid ${active ? 'var(--border-focus)' : 'transparent'}`,
                    borderRadius: 'var(--r-md)',
                    color:        active ? 'var(--green)' : 'var(--text-muted)',
                    fontFamily:   'var(--font-mono)', fontSize: 11,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => !active && ((e.currentTarget as HTMLElement).style.color = 'var(--text-dim)')}
                  onMouseLeave={e => !active && ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* List */}
          {isLoading ? (
            <ArtworkListSkeleton count={6} />
          ) : sorted.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              border: '1px solid var(--border)', borderRadius: 'var(--r-xl)',
              background: 'var(--surface)',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                no artworks yet
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>
                be the first to launch an artwork with a bonding curve
              </div>
              <Link
                href="/create"
                className="btn"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, padding: '9px 22px', textDecoration: 'none' }}
              >
                [start a new artwork]
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sorted.map((artwork, i) => (
                <ArtworkCard
                  key={artwork.address}
                  artwork={artwork}
                  rank={filter === 'trending' ? i + 1 : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
