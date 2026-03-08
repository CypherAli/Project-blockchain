'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArtworkInfo,
  formatEth,
  getIpfsUrlsForFallback,
  graduationProgress,
  timeAgo,
  shortAddress,
} from '@/lib/contracts';

interface Props {
  artwork: ArtworkInfo;
  rank?:   number;
}

/* ─── helpers ────────────────────────────────────────────────────────────── */
function formatSupply(n: bigint): string {
  if (n >= 1_000_000n) return `${(Number(n) / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000n)     return `${(Number(n) / 1_000).toFixed(1)}K`;
  return n.toString();
}

/* ─── Rank badge colours ─────────────────────────────────────────────────── */
const RANK_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: 'var(--gold)',       text: 'hsl(135 28% 8%)' },
  2: { bg: 'var(--text-dim)',   text: 'hsl(135 28% 8%)' },
  3: { bg: 'var(--terra)',      text: 'hsl(135 28% 8%)' },
};

/* ─── ArtworkCard ────────────────────────────────────────────────────────── */
export default function ArtworkCard({ artwork, rank }: Props) {
  const progressPct   = graduationProgress(artwork.reserve);
  const isGraduating  = progressPct >= 80 && !artwork.graduated;
  const isGraduated   = artwork.graduated;
  const isNew         = Date.now() / 1000 - Number(artwork.createdAt) < 86_400; // 24h

  /* ── IPFS multi-gateway fallback ── */
  const ipfsUrls  = getIpfsUrlsForFallback(artwork.ipfsCID);
  const [imgIdx, setImgIdx] = useState(0);

  const handleImgError = () => {
    if (imgIdx < ipfsUrls.length - 1) {
      setImgIdx(i => i + 1);
    } else {
      setImgIdx(ipfsUrls.length); // sentinel → placeholder
    }
  };

  const imgSrc =
    imgIdx < ipfsUrls.length
      ? ipfsUrls[imgIdx]
      : `https://picsum.photos/seed/${artwork.address}/128/128`;

  /* ── Border colour based on state ── */
  const borderColor = isGraduated
    ? 'var(--gold)'
    : isGraduating
    ? 'var(--gold-light)'
    : 'var(--border)';

  return (
    <Link href={`/artwork/${artwork.address}`} style={{ display: 'block', textDecoration: 'none' }}>
      <article
        className={isGraduating || isGraduated ? 'graduating-glow' : ''}
        style={{
          display:       'flex',
          gap:           14,
          padding:       '14px 16px',
          background:    'var(--surface)',
          border:        `1px solid ${borderColor}`,
          borderRadius:  'var(--r-lg)',
          cursor:        'pointer',
          transition:    'border-color 0.2s, box-shadow 0.2s, transform 0.18s var(--ease-spring), background 0.15s',
          position:      'relative',
          overflow:      'hidden',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget;
          el.style.background   = 'var(--surface-2)';
          el.style.borderColor  = isGraduating || isGraduated ? 'var(--gold)' : 'var(--border-hover)';
          el.style.boxShadow    = isGraduating || isGraduated
            ? '0 6px 28px var(--gold-glow)'
            : '0 6px 24px rgba(0,0,0,0.35)';
          el.style.transform    = 'translateY(-2px)';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget;
          el.style.background  = 'var(--surface)';
          el.style.borderColor = borderColor;
          el.style.boxShadow   = 'none';
          el.style.transform   = 'translateY(0)';
        }}
      >
        {/* ══ Left — image ══ */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            style={{
              width:        80,
              height:       80,
              borderRadius: 'var(--r-md)',
              overflow:     'hidden',
              border:       `1.5px solid ${isGraduated || isGraduating ? 'var(--gold)' : 'var(--border-hover)'}`,
              background:   'var(--surface-3)',
            }}
          >
            <img
              src={imgSrc}
              alt={artwork.name}
              width={80}
              height={80}
              onError={handleImgError}
              style={{
                width:      '100%',
                height:     '100%',
                objectFit:  'cover',
                display:    'block',
              }}
            />
          </div>

          {/* Top-3 rank badge */}
          {rank && rank <= 3 && (
            <div
              aria-label={`Rank #${rank}`}
              style={{
                position:     'absolute',
                top:          -7,
                left:         -7,
                width:        22,
                height:       22,
                borderRadius: '50%',
                background:   RANK_COLORS[rank]?.bg ?? 'var(--text-dim)',
                color:        RANK_COLORS[rank]?.text ?? '#fff',
                fontSize:     10,
                fontWeight:   800,
                fontFamily:   'var(--font-mono)',
                display:      'grid',
                placeItems:   'center',
                border:       '2px solid var(--bg)',
                zIndex:       1,
              }}
            >
              {rank}
            </div>
          )}

          {/* Graduated badge */}
          {isGraduated && (
            <div
              aria-label="Graduated"
              style={{
                position:     'absolute',
                bottom:       -7,
                right:        -7,
                background:   'var(--gold)',
                color:        'hsl(135 28% 8%)',
                fontSize:     9,
                fontWeight:   800,
                fontFamily:   'var(--font-mono)',
                padding:      '2px 5px',
                borderRadius: 'var(--r-sm)',
                border:       '1.5px solid var(--bg)',
                zIndex:       1,
                letterSpacing: '0.04em',
              }}
            >
              GRAD
            </div>
          )}

          {/* New badge */}
          {isNew && !rank && (
            <div
              style={{
                position:     'absolute',
                bottom:       -7,
                right:        -7,
                background:   'var(--teal-bg)',
                color:        'var(--teal-light)',
                border:       '1.5px solid var(--teal)',
                fontSize:     9,
                fontWeight:   700,
                fontFamily:   'var(--font-mono)',
                padding:      '2px 5px',
                borderRadius: 'var(--r-sm)',
                zIndex:       1,
                letterSpacing: '0.04em',
              }}
            >
              NEW
            </div>
          )}
        </div>

        {/* ══ Right — info ══ */}
        <div
          style={{
            flex:          1,
            minWidth:      0,
            display:       'flex',
            flexDirection: 'column',
            gap:           5,
          }}
        >
          {/* Row 1 — name + price */}
          <div
            style={{
              display:        'flex',
              alignItems:     'baseline',
              justifyContent: 'space-between',
              gap:            8,
            }}
          >
            <h3
              style={{
                fontFamily:   'var(--font-sans)',
                fontSize:     15,
                fontWeight:   700,
                color:        'var(--text)',
                margin:       0,
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
                lineHeight:   1.3,
                maxWidth:     '62%',
              }}
            >
              {artwork.name}
            </h3>
            <span
              style={{
                fontFamily:  'var(--font-mono)',
                fontSize:    15,
                fontWeight:  600,
                color:       'var(--green)',
                flexShrink:  0,
                letterSpacing: '-0.01em',
              }}
            >
              {formatEth(artwork.price, 5)} Ξ
            </span>
          </div>

          {/* Row 2 — artist + market cap */}
          <div
            style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
            }}
          >
            <span
              style={{
                fontFamily:   'var(--font-mono)',
                fontSize:     11,
                color:        'var(--teal)',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}
            >
              {shortAddress(artwork.artist)} · {timeAgo(Number(artwork.createdAt))}
            </span>
            <span
              style={{
                fontFamily:   'var(--font-mono)',
                fontSize:     11,
                color:        'var(--text-muted)',
                whiteSpace:   'nowrap',
                flexShrink:   0,
              }}
            >
              mcap {formatEth(artwork.marketCap, 3)} Ξ
            </span>
          </div>

          {/* Row 3 — bonding curve progress */}
          <div>
            {/* Track */}
            <div
              style={{
                height:       6,
                background:   'var(--surface-3)',
                borderRadius: 'var(--r-full)',
                overflow:     'hidden',
              }}
            >
              <div
                className={isGraduating || isGraduated ? 'progress-bar-graduating' : 'progress-bar'}
                style={{ width: `${Math.max(progressPct, 1)}%` }}
              />
            </div>

            {/* Labels */}
            <div
              style={{
                display:        'flex',
                justifyContent: 'space-between',
                marginTop:      4,
              }}
            >
              <span
                style={{
                  fontFamily:    'var(--font-mono)',
                  fontSize:      10,
                  color:         isGraduating ? 'var(--gold)' : isGraduated ? 'var(--gold-light)' : 'var(--text-muted)',
                  letterSpacing: '0.02em',
                }}
              >
                {isGraduated
                  ? '🌟 graduated'
                  : isGraduating
                  ? `⚡ ${progressPct.toFixed(1)}% — graduating`
                  : `${progressPct.toFixed(1)}% bonded`}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize:   10,
                  color:      'var(--text-muted)',
                }}
              >
                {formatSupply(artwork.supply)} shares
              </span>
            </div>
          </div>

          {/* Row 4 — volume + royalties */}
          <div
            style={{
              display:    'flex',
              gap:        16,
              paddingTop: 2,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
              vol{' '}
              <span style={{ color: 'var(--text-dim)' }}>
                {formatEth(artwork.totalVolume, 3)} Ξ
              </span>
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
              royalty{' '}
              <span style={{ color: 'var(--text-dim)' }}>
                {formatEth(artwork.totalRoyalties, 4)} Ξ
              </span>
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
