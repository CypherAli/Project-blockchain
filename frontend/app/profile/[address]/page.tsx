'use client';

import { use } from 'react';
import Link from 'next/link';
import { useAllArtworks } from '@/lib/hooks';
import ArtworkCard from '@/components/ArtworkCard';
import { type ArtworkInfo, formatEth } from '@/lib/contracts';
import { useAccount } from 'wagmi';
import { usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { ART_BONDING_CURVE_ABI } from '@/lib/contracts';
import { getExplorerUrl, shortAddress } from '@/lib/contracts';

interface Props {
  params: Promise<{ address: string }>;
}

export default function ProfilePage({ params }: Props) {
  const { address: paramAddress }    = use(params);
  const { address: connectedAddress } = useAccount();
  const client                        = usePublicClient();
  const profileAddress                = paramAddress as `0x${string}`;

  const { data: allArtworks, isLoading } = useAllArtworks();
  const isOwn = connectedAddress?.toLowerCase() === profileAddress.toLowerCase();

  const createdArtworks = allArtworks?.filter(
    (a) => a.artist.toLowerCase() === profileAddress.toLowerCase()
  ) ?? [];

  const totalRoyalties = createdArtworks.reduce((s, a) => s + a.totalRoyalties, 0n);
  const totalVolume    = createdArtworks.reduce((s, a) => s + a.totalVolume, 0n);

  const { data: holdings } = useQuery({
    queryKey: ['holdings', profileAddress, allArtworks?.length],
    enabled: !!allArtworks && allArtworks.length > 0 && !!client,
    queryFn: async () => {
      if (!allArtworks || !client) return [];
      const results = await Promise.all(
        allArtworks.map(async (artwork) => {
          try {
            const bal = await client.readContract({
              address: artwork.address,
              abi: ART_BONDING_CURVE_ABI,
              functionName: 'balanceOf',
              args: [profileAddress],
            }) as bigint;
            return bal > 0n ? { artwork, balance: bal } : null;
          } catch { return null; }
        })
      );
      return results.filter(Boolean) as { artwork: ArtworkInfo; balance: bigint }[];
    },
    staleTime: 15_000,
  });

  const explorerUrl = getExplorerUrl('address', profileAddress);
  const initials    = profileAddress.slice(2, 4).toUpperCase();
  const shortAddr   = `${profileAddress.slice(0, 8)}...${profileAddress.slice(-6)}`;

  const STAT_ITEMS = [
    { label: 'artworks created', value: createdArtworks.length.toString(),     color: 'var(--text)' },
    { label: 'total volume',     value: `${formatEth(totalVolume, 4)} ETH`,    color: 'var(--text)' },
    { label: 'royalties earned', value: `${formatEth(totalRoyalties, 5)} ETH`, color: 'var(--gold)' },
    { label: 'shares held in',   value: `${holdings?.length ?? '...'} artworks`, color: 'var(--teal)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Profile header */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)', padding: 24,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20,
      }}>
        {/* Avatar */}
        <div style={{
          width: 72, height: 72, borderRadius: 'var(--r-lg)',
          background: 'linear-gradient(135deg, var(--green), var(--teal))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800,
          color: 'hsl(135 28% 8%)', flexShrink: 0,
        }}>
          {initials}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              {shortAddr}
            </h1>
            {isOwn && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                background: 'hsl(135 56% 54% / 0.15)', color: 'var(--green)',
                border: '1px solid hsl(135 56% 54% / 0.35)',
                padding: '2px 8px', borderRadius: 'var(--r-full)',
              }}>
                YOU
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            {STAT_ITEMS.map((s) => (
              <div key={s.label}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Explorer link */}
        {explorerUrl && (
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal)', textDecoration: 'none', whiteSpace: 'nowrap' }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            view on explorer ↗
          </a>
        )}
      </div>

      {/* Created artworks */}
      {createdArtworks.length > 0 && (
        <section>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 12 }}>
            artworks created ({createdArtworks.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {createdArtworks.map((artwork) => (
              <ArtworkCard key={artwork.address} artwork={artwork} />
            ))}
          </div>
        </section>
      )}

      {/* Portfolio */}
      <section>
        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 12 }}>
          portfolio (shares held)
        </h2>
        {!holdings ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>
            loading holdings...
          </div>
        ) : holdings.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '32px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>no shares held yet</div>
            <Link href="/explore" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', textDecoration: 'none' }}>
              browse artworks to invest in
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {holdings.map(({ artwork, balance }) => (
              <Link key={artwork.address} href={`/artwork/${artwork.address}`} style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-lg)', padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 14,
                    cursor: 'pointer', transition: 'border-color 0.2s, background 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)';
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
                  }}
                >
                  <img
                    src={`https://picsum.photos/seed/${artwork.address}/64/64`}
                    alt={artwork.name}
                    style={{ width: 48, height: 48, borderRadius: 'var(--r-md)', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-hover)' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
                      {artwork.name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                      by {artwork.artist.slice(0, 8)}...
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                      {balance.toString()} shares
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                      ~{formatEth(artwork.price * balance, 5)} ETH
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 12, borderLeft: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>price</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
                      {formatEth(artwork.price, 6)} ETH
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
