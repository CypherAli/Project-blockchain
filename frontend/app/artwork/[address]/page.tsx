'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useArtworkInfo, useTradeHistory, useShareBalance } from '@/lib/hooks';
import TradePanel from '@/components/TradePanel';
import PriceChart from '@/components/PriceChart';
import {
  formatEth, getIpfsUrlsForFallback, getExplorerUrl,
  graduationProgress, shortAddress, timeAgo,
} from '@/lib/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { ArtworkDetailSkeleton, ChartSkeleton } from '@/components/ui/Skeleton';
import { NotFound, AsyncError } from '@/components/ui/ErrorBoundary';

interface Props {
  params: Promise<{ address: string }>;
}

// ─── Stat box ─────────────────────────────────────────────────────────────────

function StatBox({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', padding: '8px 12px',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: accent ? 'var(--green)' : 'var(--text)' }}>
        {value}
      </div>
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: 16,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
        color: 'var(--text-muted)', letterSpacing: '0.08em',
        textTransform: 'uppercase', marginBottom: 12,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArtworkPage({ params }: Props) {
  const { address }      = use(params);
  const artworkAddress   = address as `0x${string}`;
  const queryClient      = useQueryClient();

  const { data: artwork, isLoading, isError, error, refetch } = useArtworkInfo(artworkAddress);
  const { data: events = [] } = useTradeHistory(artworkAddress, 50);
  const { data: balance }     = useShareBalance(artworkAddress);

  // IPFS multi-gateway fallback
  const ipfsUrls = getIpfsUrlsForFallback(artwork?.ipfsCID ?? '');
  const [imgIdx, setImgIdx] = useState(0);
  const handleImgError = () => {
    if (imgIdx < ipfsUrls.length - 1) setImgIdx((i) => i + 1);
    else setImgIdx(ipfsUrls.length);
  };
  const imgSrc = artwork?.ipfsCID && imgIdx < ipfsUrls.length
    ? ipfsUrls[imgIdx]
    : `https://picsum.photos/seed/${artworkAddress}/256/256`;

  const handleTradeSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['artworkInfo', artworkAddress] });
    queryClient.invalidateQueries({ queryKey: ['tradeHistory', artworkAddress] });
    queryClient.invalidateQueries({ queryKey: ['allArtworks'] });
  };

  if (isLoading) return <ArtworkDetailSkeleton />;

  if (isError) {
    return <AsyncError error={error} onRetry={() => refetch()} context={`artwork ${artworkAddress.slice(0, 8)}…`} />;
  }

  if (!artwork) {
    return (
      <NotFound
        message="Artwork not found"
        description="This contract address is not an ArtCurve artwork, or it hasn't been indexed yet."
        backHref="/explore"
        backLabel="back to explore"
      />
    );
  }

  const progressPct  = graduationProgress(artwork.reserve);
  const isGraduating = progressPct >= 80 && !artwork.graduated;
  const explorerUrl  = getExplorerUrl('address', artworkAddress);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-sans)' }}>

      {/* ── Breadcrumb ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        {[
          { href: '/',        label: '[home]'    },
          { href: '/explore', label: '[explore]' },
        ].map(({ href, label }) => (
          <span key={href} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link href={href} style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--green)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >{label}</Link>
            <span style={{ color: 'var(--border-hover)' }}>/</span>
          </span>
        ))}
        <span style={{ color: 'var(--text-dim)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {artwork.name}
        </span>
        {artwork.graduated && (
          <span style={{
            background: 'hsl(42 72% 48% / 0.18)', color: 'var(--gold)',
            border: '1px solid hsl(42 72% 48% / 0.35)', fontSize: 9,
            padding: '2px 7px', borderRadius: 'var(--r-full)', fontWeight: 700,
          }}>
            🎓 graduated
          </span>
        )}
      </div>

      {/* ── Main grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>

        {/* ── Left ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Image + title */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{
              flexShrink: 0, width: 140, height: 140,
              borderRadius: 'var(--r-lg)', overflow: 'hidden',
              border: `2px solid ${artwork.graduated ? 'var(--gold)' : isGraduating ? 'var(--gold-light)' : 'var(--border-hover)'}`,
              background: 'var(--surface-2)',
            }}>
              <img src={imgSrc} alt={artwork.name} width={140} height={140}
                onError={handleImgError}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 800,
                color: 'var(--text)', margin: 0, marginBottom: 4,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {artwork.name}
              </h1>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
                created by{' '}
                <Link href={`/profile/${artwork.artist}`}
                  style={{ color: 'var(--teal)', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                  {shortAddress(artwork.artist, 8)}
                </Link>
                {' '}· {timeAgo(Number(artwork.createdAt))}
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <StatBox label="price"         value={`${formatEth(artwork.price, 6)} Ξ`}       accent />
                <StatBox label="market cap"    value={`${formatEth(artwork.marketCap, 4)} Ξ`}        />
                <StatBox label="volume"        value={`${formatEth(artwork.totalVolume, 4)} Ξ`}      />
                <StatBox label="shares minted" value={artwork.supply.toString()}                      />
              </div>
            </div>
          </div>

          {/* Bonding curve progress */}
          <SectionCard title="bonding curve progress">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-dim)' }}>
                {formatEth(artwork.reserve, 4)} / 24 Ξ reserve
              </span>
              <span style={{ color: isGraduating || artwork.graduated ? 'var(--gold)' : 'var(--green)', fontWeight: 700 }}>
                {progressPct.toFixed(1)}%
              </span>
            </div>
            <div style={{ height: 8, background: 'var(--surface-3)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
              <div
                className={isGraduating || artwork.graduated ? 'progress-bar-graduating' : 'progress-bar'}
                style={{ width: `${Math.max(progressPct, 1)}%`, height: '100%' }}
              />
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 6 }}>
              when reserve reaches 24 Ξ, artwork graduates 🌟
            </div>
          </SectionCard>

          {/* Price chart */}
          <SectionCard title="price history">
            {events.length === 0 ? <ChartSkeleton /> : <PriceChart events={events} k={artwork.k} p0={artwork.p0} />}
          </SectionCard>

          {/* Trade history */}
          <SectionCard title={`trade history (${events.length})`}>
            {events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                no trades yet — be the first!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                {events.slice(0, 30).map((event, i) => (
                  <div
                    key={event.txHash ?? i}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 11,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800,
                        color: event.type === 'BUY' ? 'var(--green)' : 'var(--terra)',
                      }}>
                        {event.type}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                        {shortAddress(event.trader)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{event.shares.toString()} shares</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{formatEth(event.ethAmount, 5)} Ξ</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>{timeAgo(Number(event.timestamp))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Contract info */}
          <SectionCard title="contract info">
            {[
              {
                label: 'contract address',
                node: explorerUrl
                  ? <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--teal)', fontFamily: 'var(--font-mono)', fontSize: 11, textDecoration: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                      onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                    >
                      {artworkAddress.slice(0, 10)}…{artworkAddress.slice(-8)} ↗
                    </a>
                  : <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{artworkAddress.slice(0, 10)}…{artworkAddress.slice(-8)}</span>,
              },
              { label: 'artist royalties earned', value: `${formatEth(artwork.totalRoyalties, 5)} Ξ`, color: 'var(--gold)' },
              { label: 'reserve',                 value: `${formatEth(artwork.reserve, 5)} Ξ`,       color: 'var(--text)' },
              { label: 'k (curve steepness)',      value: artwork.k.toString(),                        color: 'var(--text-dim)' },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '5px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none',
                fontFamily: 'var(--font-mono)', fontSize: 11,
              }}>
                <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                {row.node ?? <span style={{ color: row.color }}>{row.value}</span>}
              </div>
            ))}
          </SectionCard>
        </div>

        {/* ── Right: trade panel ── */}
        <div>
          <div style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <TradePanel artwork={artwork} onTradeSuccess={handleTradeSuccess} />

            {/* Position */}
            {typeof balance === 'bigint' && balance > 0n && (
              <div style={{
                background: 'hsl(135 56% 54% / 0.07)', border: '1px solid hsl(135 56% 54% / 0.25)',
                borderRadius: 'var(--r-lg)', padding: '12px 14px',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  your position
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>
                  {balance.toString()} shares
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                  value ~{formatEth(artwork.price * balance, 5)} Ξ
                </div>
              </div>
            )}

            {/* Fee structure */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)', padding: '12px 14px',
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                fee structure
              </div>
              {[
                { label: 'artist royalty (buy + sell)', value: '5%',  color: 'var(--gold)' },
                { label: 'platform fee',                value: '1%',  color: 'var(--text-dim)' },
                { label: 'total artist earned',         value: `${formatEth(artwork.totalRoyalties, 5)} Ξ`, color: 'var(--text)', border: true },
              ].map((row, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: row.border ? '6px 0 0 0' : '4px 0',
                  borderTop: row.border ? '1px solid var(--border)' : 'none',
                  marginTop: row.border ? 4 : 0,
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                  <span style={{ color: row.color, fontWeight: row.border ? 700 : 400 }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
