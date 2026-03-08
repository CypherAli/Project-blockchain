'use client';

/**
 * Skeleton loading components.
 * Use these while data is loading to prevent white-screen flash.
 */

import React from 'react';

// ─── Base Skeleton ────────────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// ─── Artwork Card Skeleton ─────────────────────────────────────────────────────

export function ArtworkCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '12px 16px',
        display: 'flex',
        gap: 12,
      }}
    >
      {/* Image */}
      <Skeleton style={{ width: 64, height: 64, borderRadius: 6, flexShrink: 0 }} />
      {/* Info */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton style={{ width: '55%', height: 16, borderRadius: 4 }} />
        <Skeleton style={{ width: '40%', height: 12, borderRadius: 4 }} />
        <div style={{ display: 'flex', gap: 12 }}>
          <Skeleton style={{ width: '25%', height: 12, borderRadius: 4 }} />
          <Skeleton style={{ width: '25%', height: 12, borderRadius: 4 }} />
          <Skeleton style={{ width: '20%', height: 12, borderRadius: 4 }} />
        </div>
        <Skeleton style={{ width: '100%', height: 6, borderRadius: 3 }} />
      </div>
    </div>
  );
}

/** Renders N artwork card skeletons */
export function ArtworkListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }, (_, i) => (
        <ArtworkCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── Artwork Detail Skeleton ──────────────────────────────────────────────────

export function ArtworkDetailSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 360px', gap: 24 }}>
      {/* Left: image + stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton style={{ width: '100%', aspectRatio: '1', borderRadius: 8 }} />
        <Skeleton style={{ width: '70%', height: 24, borderRadius: 4 }} />
        <Skeleton style={{ width: '45%', height: 16, borderRadius: 4 }} />
      </div>
      {/* Middle: chart + history */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton style={{ width: '100%', height: 200, borderRadius: 8 }} />
        <Skeleton style={{ width: '100%', height: 300, borderRadius: 8 }} />
      </div>
      {/* Right: trade panel */}
      <div>
        <Skeleton style={{ width: '100%', height: 400, borderRadius: 8 }} />
      </div>
    </div>
  );
}

// ─── Stats Row Skeleton ───────────────────────────────────────────────────────

export function StatsSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 24 }}>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton style={{ width: 80, height: 28, borderRadius: 4 }} />
          <Skeleton style={{ width: 60, height: 12, borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}

// ─── Chart Skeleton ───────────────────────────────────────────────────────────

export function ChartSkeleton() {
  return (
    <div
      style={{
        width: '100%',
        height: 200,
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Skeleton style={{ width: '90%', height: '80%', borderRadius: 6 }} />
    </div>
  );
}
