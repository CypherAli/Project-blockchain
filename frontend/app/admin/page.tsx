'use client';

/**
 * Admin Dashboard — Platform Back Office
 *
 * Only accessible/functional when connected wallet is the factory owner.
 * Features:
 *  - Platform stats (total artworks, volume, fees earned)
 *  - Withdraw accumulated listing fees
 *  - Update listing fee
 *  - View all artworks with their stats
 */

import React, { useState, useEffect } from 'react';
import { useAccount, useBalance, usePublicClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  useListingFee,
  useFactoryOwner,
  useTotalArtworks,
  useWithdrawFees,
  useSetListingFee,
  useAllArtworks,
} from '@/lib/hooks';
import { useToast } from '@/components/ui/Toast';
import { formatEth, shortAddress } from '@/lib/contracts';
import { config as appConfig, getExplorerUrl } from '@/lib/config';
import { ArtworkListSkeleton } from '@/components/ui/Skeleton';
import { ErrorCard } from '@/components/ui/ErrorBoundary';
import Link from 'next/link';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { address: userAddress, isConnected } = useAccount();
  const { data: owner } = useFactoryOwner();
  const isOwner = isConnected && owner && userAddress?.toLowerCase() === (owner as string).toLowerCase();

  if (!isConnected) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', fontFamily: 'monospace' }}>
        <div style={{ color: '#555', marginBottom: 24 }}>
          [admin panel] — connect wallet to continue
        </div>
        <ConnectButton />
      </div>
    );
  }

  if (owner && !isOwner) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', fontFamily: 'monospace' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⛔</div>
        <div style={{ color: '#ff4444', marginBottom: 8 }}>access denied</div>
        <div style={{ color: '#555', fontSize: 12 }}>
          connected: {shortAddress(userAddress ?? '')}<br />
          owner: {shortAddress(owner as string)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'monospace', padding: '24px 0', maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ color: '#555', fontSize: 12, marginBottom: 4 }}>
          artcurve.fun / admin
        </div>
        <h1 style={{ margin: 0, fontSize: 20, color: 'var(--green)' }}>
          [admin dashboard]
        </h1>
        <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
          factory: {appConfig.factoryAddress
            ? <a href={getExplorerUrl('address', appConfig.factoryAddress)} target="_blank" rel="noopener noreferrer" style={{ color: '#555' }}>{shortAddress(appConfig.factoryAddress)}</a>
            : 'not configured'
          }
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <StatsPanel />
        <FeesPanel />
      </div>

      <div style={{ marginTop: 32 }}>
        <ArtworksTable />
      </div>
    </div>
  );
}

// ─── Stats Panel ──────────────────────────────────────────────────────────────

function StatsPanel() {
  const { data: totalArtworks } = useTotalArtworks();
  const { data: listingFee } = useListingFee();
  const { data: artworks } = useAllArtworks();
  const factoryAddress = appConfig.factoryAddress;
  const { data: factoryBalance } = useBalance({ address: factoryAddress });

  const totalVolume = artworks?.reduce((sum, a) => sum + a.totalVolume, 0n) ?? 0n;
  const totalRoyalties = artworks?.reduce((sum, a) => sum + a.totalRoyalties, 0n) ?? 0n;
  const graduatedCount = artworks?.filter((a) => a.graduated).length ?? 0;

  const stats = [
    { label: 'total artworks', value: String(totalArtworks ?? '...') },
    { label: 'graduated', value: String(graduatedCount) },
    { label: 'total volume', value: totalVolume > 0n ? `${formatEth(totalVolume)} ETH` : '...' },
    { label: 'artist royalties', value: totalRoyalties > 0n ? `${formatEth(totalRoyalties)} ETH` : '...' },
    { label: 'listing fee', value: listingFee ? `${formatEther(listingFee as bigint)} ETH` : '...' },
    { label: 'fees in contract', value: factoryBalance ? `${formatEther(factoryBalance.value)} ETH` : '...' },
  ];

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ color: '#888', fontSize: 11, marginBottom: 16 }}>PLATFORM STATS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {stats.map(({ label, value }) => (
          <div key={label}>
            <div style={{ color: '#555', fontSize: 10, marginBottom: 2 }}>{label}</div>
            <div style={{ color: 'var(--foreground)', fontSize: 16, fontWeight: 'bold' }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Fees Panel ───────────────────────────────────────────────────────────────

function FeesPanel() {
  const toast = useToast();
  const { withdraw, isPending: withdrawing, isSuccess: withdrawDone } = useWithdrawFees();
  const { setFee, isPending: settingFee } = useSetListingFee();
  const { data: currentFee } = useListingFee();
  const { data: factoryBalance } = useBalance({ address: appConfig.factoryAddress });
  const [newFeeEth, setNewFeeEth] = useState('');
  const [withdrawToastId, setWithdrawToastId] = useState<string | null>(null);

  // Update toast on withdraw success
  useEffect(() => {
    if (withdrawDone && withdrawToastId) {
      toast.success(withdrawToastId, 'Fees withdrawn successfully!');
      setWithdrawToastId(null);
    }
  }, [withdrawDone, withdrawToastId, toast]);

  const handleWithdraw = async () => {
    if (!factoryBalance?.value || factoryBalance.value === 0n) return;
    const id = toast.pending('Withdrawing listing fees...');
    setWithdrawToastId(id);
    try {
      const txHash = await withdraw();
      if (txHash) toast.success(id, `Withdrawn ${formatEther(factoryBalance.value)} ETH`, txHash);
    } catch (err) {
      toast.error(id, err instanceof Error ? err.message : 'Withdraw failed');
    }
  };

  const handleSetFee = async () => {
    if (!newFeeEth) return;
    const id = toast.pending('Updating listing fee...');
    try {
      const newFeeWei = parseEther(newFeeEth);
      const txHash = await setFee(newFeeWei);
      if (txHash) toast.success(id, `Listing fee updated to ${newFeeEth} ETH`, txHash);
      setNewFeeEth('');
    } catch (err) {
      toast.error(id, err instanceof Error ? err.message : 'Update failed');
    }
  };

  const hasBalance = factoryBalance && factoryBalance.value > 0n;

  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ color: '#888', fontSize: 11 }}>ADMIN ACTIONS</div>

      {/* Withdraw fees */}
      <div>
        <div style={{ color: '#666', fontSize: 11, marginBottom: 8 }}>listing fees (balance)</div>
        <div style={{ color: 'var(--green)', fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          {factoryBalance ? formatEther(factoryBalance.value) : '...'} ETH
        </div>
        <button
          className="btn-green"
          style={{ width: '100%', opacity: !hasBalance || withdrawing ? 0.4 : 1 }}
          disabled={!hasBalance || withdrawing}
          onClick={handleWithdraw}
        >
          {withdrawing ? '[ withdrawing... ]' : '[ withdraw fees ]'}
        </button>
      </div>

      {/* Set listing fee */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div style={{ color: '#666', fontSize: 11, marginBottom: 8 }}>
          update listing fee (current: {currentFee ? formatEther(currentFee as bigint) : '...'} ETH)
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            value={newFeeEth}
            onChange={(e) => setNewFeeEth(e.target.value)}
            placeholder="0.01"
            step="0.001"
            min="0"
            style={{
              flex: 1,
              background: '#0a0a0a',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '8px 10px',
              color: 'var(--foreground)',
              fontFamily: 'monospace',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <button
            className="btn-outline"
            disabled={!newFeeEth || settingFee}
            onClick={handleSetFee}
          >
            {settingFee ? '...' : '[set]'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Artworks Table ───────────────────────────────────────────────────────────

function ArtworksTable() {
  const { data: artworks, isLoading, error } = useAllArtworks();

  const sorted = [...(artworks ?? [])].sort(
    (a, b) => Number(b.totalVolume) - Number(a.totalVolume)
  );

  return (
    <div>
      <div style={{ color: '#888', fontSize: 11, marginBottom: 12 }}>
        ALL ARTWORKS ({artworks?.length ?? 0})
      </div>

      {isLoading && <ArtworkListSkeleton count={5} />}
      {error && <ErrorCard message="Failed to load artworks" />}

      {!isLoading && sorted.length === 0 && (
        <div style={{ color: '#555', fontSize: 13 }}>no artworks yet</div>
      )}

      {sorted.length > 0 && (
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px',
              gap: 12,
              padding: '10px 16px',
              borderBottom: '1px solid var(--border)',
              color: '#555',
              fontSize: 10,
            }}
          >
            <span>ARTWORK</span>
            <span>ARTIST</span>
            <span>SUPPLY</span>
            <span>RESERVE</span>
            <span>VOLUME</span>
            <span>STATUS</span>
          </div>

          {/* Rows */}
          {sorted.map((artwork, i) => (
            <div
              key={artwork.address}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px',
                gap: 12,
                padding: '10px 16px',
                borderBottom: i < sorted.length - 1 ? '1px solid #1a1a1a' : 'none',
                fontSize: 12,
                alignItems: 'center',
              }}
            >
              <div>
                <Link
                  href={`/artwork/${artwork.address}`}
                  style={{ color: 'var(--foreground)', display: 'block', marginBottom: 2 }}
                >
                  {artwork.name}
                </Link>
                <span style={{ color: '#444', fontSize: 10 }}>
                  {shortAddress(artwork.address)}
                </span>
              </div>
              <span style={{ color: '#888' }}>{shortAddress(artwork.artist)}</span>
              <span>{artwork.supply.toLocaleString()}</span>
              <span>{formatEth(artwork.reserve)} ETH</span>
              <span>{formatEth(artwork.totalVolume)} ETH</span>
              <span style={{ color: artwork.graduated ? 'var(--green)' : '#555' }}>
                {artwork.graduated ? '🎓 grad' : 'active'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
