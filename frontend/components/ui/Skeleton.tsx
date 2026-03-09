'use client';

/**
 * Skeleton loading components — Solarpunk edition
 * Uses root-pulse animation from globals.css
 */

import React from 'react';

// ─── Base ─────────────────────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
  style?:     React.CSSProperties;
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

// ─── Artwork Card Skeleton ────────────────────────────────────────────────────

export function ArtworkCardSkeleton() {
  return (
    <div
      style={{
        display:      'flex',
        gap:          14,
        padding:      '14px 16px',
        background:   'var(--surface)',
        border:       '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
      }}
    >
      {/* Image */}
      <Skeleton style={{ width: 80, height: 80, borderRadius: 'var(--r-md)', flexShrink: 0 }} />

      {/* Info */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Name + price */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <Skeleton style={{ width: '50%', height: 16, borderRadius: 4 }} />
          <Skeleton style={{ width: '22%', height: 16, borderRadius: 4 }} />
        </div>
        {/* Artist */}
        <Skeleton style={{ width: '38%', height: 11, borderRadius: 4 }} />
        {/* Progress */}
        <Skeleton style={{ width: '100%', height: 6, borderRadius: 'var(--r-full)' }} />
        {/* Footer stats */}
        <div style={{ display: 'flex', gap: 16 }}>
          <Skeleton style={{ width: 60, height: 10, borderRadius: 4 }} />
          <Skeleton style={{ width: 80, height: 10, borderRadius: 4 }} />
        </div>
      </div>
    </div>
  );
}

/** Renders N artwork card skeletons in a column */
export function ArtworkListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }, (_, i) => <ArtworkCardSkeleton key={i} />)}
    </div>
  );
}

// ─── Artwork Detail Skeleton ──────────────────────────────────────────────────

export function ArtworkDetailSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 360px', gap: 24 }}>
      {/* Left: image + stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton style={{ width: '100%', aspectRatio: '1', borderRadius: 'var(--r-lg)' }} />
        <Skeleton style={{ width: '65%', height: 24, borderRadius: 6 }} />
        <Skeleton style={{ width: '45%', height: 14, borderRadius: 6 }} />
        <Skeleton style={{ width: '100%', height: 8, borderRadius: 'var(--r-full)' }} />
      </div>
      {/* Middle: chart + trade history */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton style={{ width: '100%', height: 220, borderRadius: 'var(--r-lg)' }} />
        <Skeleton style={{ width: '100%', height: 320, borderRadius: 'var(--r-lg)' }} />
      </div>
      {/* Right: trade panel */}
      <div>
        <Skeleton style={{ width: '100%', height: 440, borderRadius: 'var(--r-lg)' }} />
      </div>
    </div>
  );
}

// ─── Stats Row Skeleton ───────────────────────────────────────────────────────

export function StatsSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 20 }}>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton style={{ width: 88, height: 30, borderRadius: 6 }} />
          <Skeleton style={{ width: 64, height: 11, borderRadius: 4 }} />
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
        width:        '100%',
        height:       200,
        background:   'var(--surface)',
        border:       '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
      }}
    >
      <Skeleton style={{ width: '88%', height: '76%', borderRadius: 'var(--r-md)' }} />
    </div>
  );
}
