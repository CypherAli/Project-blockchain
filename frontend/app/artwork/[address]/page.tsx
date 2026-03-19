'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useArtworkInfo, useTradeHistory, useShareBalance } from '@/lib/hooks';
import TradePanel from '@/components/TradePanel';
import PriceChart from '@/components/PriceChart';
import {
  formatEth, formatUsd, getIpfsUrlsForFallback, getExplorerUrl,
  graduationProgress, shortAddress, timeAgo, type TradeEvent,
} from '@/lib/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { ArtworkDetailSkeleton, ChartSkeleton } from '@/components/ui/Skeleton';
import { NotFound, AsyncError } from '@/components/ui/ErrorBoundary';
import { DEMO_ARTWORKS, DEMO_IMGS, getDemoTradeHistory, isDemoAddress } from '@/lib/demo';

interface Props {
  params: Promise<{ address: string }>;
}

// ─── Comments (localStorage) ──────────────────────────────────────────────────
interface Comment { id: string; author: string; text: string; ts: number; }
function loadComments(addr: string): Comment[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(`artcurve-comments-${addr.toLowerCase()}`) || '[]'); }
  catch { return []; }
}

// ─── Holders computation from trade events ────────────────────────────────────
function computeHolders(events: TradeEvent[]) {
  const map = new Map<string, bigint>();
  for (const e of [...events].reverse()) {
    const addr = e.trader.toLowerCase();
    map.set(addr, (map.get(addr) ?? 0n) + (e.type === 'BUY' ? e.shares : -e.shares));
  }
  return [...map.entries()]
    .filter(([, b]) => b > 0n)
    .sort((a, b) => (a[1] > b[1] ? -1 : 1))
    .map(([trader, balance]) => ({ trader, balance }));
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

  const { address: userAddress }  = useAccount();
  const isDemo = isDemoAddress(artworkAddress);
  const demoArtwork = isDemo ? DEMO_ARTWORKS.find(a => a.address === artworkAddress) ?? null : null;
  const demoEvents  = isDemo ? getDemoTradeHistory(artworkAddress) : [];

  const { data: chainArtwork, isLoading, isError, error, refetch } = useArtworkInfo(isDemo ? undefined : artworkAddress);
  const { data: chainEvents = [] } = useTradeHistory(isDemo ? undefined : artworkAddress, 50);
  const { data: balance }          = useShareBalance(isDemo ? undefined : artworkAddress);

  // Merge demo or chain data
  const artwork = isDemo ? demoArtwork : chainArtwork;
  const events  = isDemo ? demoEvents  : chainEvents;

  const [detailTab, setDetailTab]   = useState<'trades' | 'holders' | 'comments'>('trades');
  const [commentText, setCommentText] = useState('');
  const [comments, setComments]     = useState<Comment[]>([]);
  const [copied, setCopied]         = useState(false);

  useEffect(() => { setComments(loadComments(artworkAddress)); }, [artworkAddress]);

  const holders     = computeHolders(events);
  const totalShares = holders.reduce((s, h) => s + h.balance, 0n);

  const handlePostComment = () => {
    if (!commentText.trim() || !userAddress) return;
    const c: Comment = { id: `${Date.now()}-${Math.random()}`, author: userAddress, text: commentText.trim(), ts: Date.now() };
    const updated = [...comments, c];
    localStorage.setItem(`artcurve-comments-${artworkAddress.toLowerCase()}`, JSON.stringify(updated));
    setComments(updated);
    setCommentText('');
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // Image source: demo map → IPFS → placeholder
  const ipfsUrls = getIpfsUrlsForFallback(artwork?.ipfsCID ?? '');
  const [imgIdx, setImgIdx] = useState(0);
  const handleImgError = () => {
    if (imgIdx < ipfsUrls.length - 1) setImgIdx((i) => i + 1);
    else setImgIdx(ipfsUrls.length);
  };
  const imgSrc = DEMO_IMGS[artworkAddress]
    ?? (artwork?.ipfsCID && imgIdx < ipfsUrls.length ? ipfsUrls[imgIdx] : `https://picsum.photos/seed/${artworkAddress}/256/256`);

  const handleTradeSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['artworkInfo', artworkAddress] });
    queryClient.invalidateQueries({ queryKey: ['tradeHistory', artworkAddress] });
    queryClient.invalidateQueries({ queryKey: ['allArtworks'] });
  };

  if (!isDemo && isLoading) return <ArtworkDetailSkeleton />;

  if (!isDemo && isError) {
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h1 style={{
                  fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 800,
                  color: 'var(--text)', margin: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {artwork.name}
                </h1>
                <button onClick={handleShare} title="Copy link" style={{
                  flexShrink: 0, padding: '4px 10px', background: 'var(--surface-2)',
                  border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                  fontFamily: 'var(--font-mono)', fontSize: 10, color: copied ? 'var(--green)' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {copied ? 'copied!' : 'share ↗'}
                </button>
              </div>
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
                <StatBox label={`price · ${formatUsd(artwork.price)}`} value={`${formatEth(artwork.price, 6)} Ξ`} accent />
                <StatBox label={`market cap · ${formatUsd(artwork.marketCap)}`} value={`${formatEth(artwork.marketCap, 4)} Ξ`} />
                <StatBox label={`volume · ${formatUsd(artwork.totalVolume)}`}   value={`${formatEth(artwork.totalVolume, 4)} Ξ`} />
                <StatBox label="shares minted" value={artwork.supply.toString()} />
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

          {/* ── Tabs: Trades | Holders | Comments ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 16 }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
              {(['trades', 'holders', 'comments'] as const).map(t => (
                <button key={t} onClick={() => setDetailTab(t)} style={{
                  padding: '6px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: detailTab === t ? 700 : 400,
                  color: detailTab === t ? 'var(--text)' : 'var(--text-muted)',
                  borderBottom: `2px solid ${detailTab === t ? 'var(--gold)' : 'transparent'}`,
                  marginBottom: -1, transition: 'all 0.15s',
                }}>
                  {t === 'trades' ? `trades (${events.length})` : t === 'holders' ? `holders (${holders.length})` : `comments (${comments.length})`}
                </button>
              ))}
            </div>

            {/* Trades */}
            {detailTab === 'trades' && (events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                no trades yet — be the first!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
                {events.slice(0, 30).map((event, i) => (
                  <div key={event.txHash ?? i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800, color: event.type === 'BUY' ? 'var(--green)' : 'var(--terra)' }}>{event.type}</span>
                      <Link href={`/profile/${event.trader}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--teal)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                        {shortAddress(event.trader)}
                      </Link>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{event.shares.toString()} shares</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{formatEth(event.ethAmount, 5)} Ξ</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>{timeAgo(Number(event.timestamp))}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* Holders */}
            {detailTab === 'holders' && (holders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                no holders yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 240, overflowY: 'auto' }}>
                {holders.map(({ trader, balance }, i) => {
                  const pct = totalShares > 0n ? Number(balance * 10000n / totalShares) / 100 : 0;
                  const isArtist = trader.toLowerCase() === artwork.artist.toLowerCase();
                  return (
                    <div key={trader} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', width: 20 }}>#{i + 1}</span>
                      <Link href={`/profile/${trader}`} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--teal)', textDecoration: 'none' }}>
                        {shortAddress(trader as `0x${string}`, 8)}
                      </Link>
                      {isArtist && (
                        <span style={{ fontSize: 9, background: 'hsl(42 72% 48% / 0.18)', color: 'var(--gold)', border: '1px solid hsl(42 72% 48% / 0.35)', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>artist</span>
                      )}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>{balance.toString()} shares</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', minWidth: 40, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Comments */}
            {detailTab === 'comments' && (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input value={commentText} onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePostComment()}
                    placeholder={userAddress ? 'add a comment...' : 'connect wallet to comment'}
                    disabled={!userAddress}
                    style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 12px', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none' }}
                  />
                  <button onClick={handlePostComment} disabled={!userAddress || !commentText.trim()}
                    style={{ padding: '8px 16px', background: 'var(--green)', color: 'hsl(135 28% 8%)', border: 'none', borderRadius: 'var(--r-md)', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: (!userAddress || !commentText.trim()) ? 0.4 : 1 }}>
                    post
                  </button>
                </div>
                {comments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>no comments yet — be the first!</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                    {[...comments].reverse().map(c => (
                      <div key={c.id} style={{ padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <Link href={`/profile/${c.author}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal)', textDecoration: 'none' }}>
                            {shortAddress(c.author as `0x${string}`, 8)}
                          </Link>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{timeAgo(Math.floor(c.ts / 1000))}</span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{c.text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

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
