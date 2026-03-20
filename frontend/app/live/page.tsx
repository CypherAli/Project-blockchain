'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DEMO_ARTWORKS } from '@/lib/demo';
import { formatEth, timeAgo, shortAddress } from '@/lib/contracts';

/* Fake live event type */
interface LiveEvent {
  id: string;
  type: 'BUY' | 'SELL' | 'LAUNCH';
  trader: string;
  artworkName: string;
  artworkAddress: string;
  shares?: bigint;
  eth: bigint;
  ts: number;
}

const TRADERS = [
  '0xA1b2C3d4E5f678901234567890AbCd',
  '0xB2c3D4e5F6789012345678901BcDe',
  '0xC3d4E5f67890123456789abcDEF1',
  '0xD4e5F67890123456789012AbcDef2',
  '0xE5f678901234567890123456789012',
];

function generateEvent(id: number): LiveEvent {
  const artwork = DEMO_ARTWORKS[id % DEMO_ARTWORKS.length];
  const types: Array<'BUY' | 'SELL' | 'LAUNCH'> = ['BUY', 'BUY', 'BUY', 'SELL', 'LAUNCH'];
  const type = types[id % types.length];
  return {
    id: `${id}-${Date.now()}`,
    type,
    trader: TRADERS[id % TRADERS.length],
    artworkName: artwork.name,
    artworkAddress: artwork.address,
    shares: type !== 'LAUNCH' ? BigInt(1 + (id % 5)) : undefined,
    eth: artwork.price * BigInt(1 + (id % 3)),
    ts: Math.floor(Date.now() / 1000) - id * 12,
  };
}

const INITIAL_EVENTS = Array.from({ length: 18 }, (_, i) => generateEvent(i + 1));

export default function LivePage() {
  const [events, setEvents] = useState<LiveEvent[]>(INITIAL_EVENTS);
  const [paused, setPaused] = useState(false);
  const [counter, setCounter] = useState(100);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setCounter(c => c + 1);
      setEvents(prev => [generateEvent(counter), ...prev].slice(0, 60));
    }, 3500);
    return () => clearInterval(interval);
  }, [paused, counter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
            Live Feed
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Real-time trades across all artworks
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: paused ? 'var(--text-muted)' : '#ff5555',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: paused ? 'var(--border)' : '#ff5555',
              boxShadow: paused ? 'none' : '0 0 6px #ff5555',
              animation: paused ? 'none' : 'pulse 1.5s infinite',
            }} />
            {paused ? 'PAUSED' : 'LIVE'}
          </span>
          <button onClick={() => setPaused(p => !p)} style={{
            padding: '6px 14px', background: 'var(--surface-2)',
            border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
            color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11,
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {paused ? '▶ resume' : '⏸ pause'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'trades / min', value: '~17', color: 'var(--green)' },
          { label: 'volume 24h',   value: '1,240 Ξ', color: 'var(--text)' },
          { label: 'active traders', value: '384', color: 'var(--teal)' },
          { label: 'new artworks', value: '12', color: 'var(--gold)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)', padding: '12px 16px',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Event stream */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>event stream</span>
          <span style={{ color: 'var(--text-dim)' }}>{events.length} events</span>
        </div>

        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          {events.map((ev, i) => (
            <div key={ev.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '9px 16px',
              borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none',
              opacity: i > 30 ? 0.4 : 1,
              transition: 'opacity 0.3s',
            }}>
              {/* Type badge */}
              <span style={{
                flexShrink: 0, minWidth: 44, textAlign: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800,
                padding: '2px 6px', borderRadius: 4,
                background: ev.type === 'BUY' ? 'hsl(135 56% 54% / 0.15)' : ev.type === 'SELL' ? 'hsl(20 58% 52% / 0.15)' : 'hsl(42 72% 48% / 0.15)',
                color: ev.type === 'BUY' ? 'var(--green)' : ev.type === 'SELL' ? 'var(--terra)' : 'var(--gold)',
                border: `1px solid ${ev.type === 'BUY' ? 'hsl(135 56% 54% / 0.3)' : ev.type === 'SELL' ? 'hsl(20 58% 52% / 0.3)' : 'hsl(42 72% 48% / 0.3)'}`,
              }}>
                {ev.type}
              </span>

              {/* Trader */}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--teal)', minWidth: 90 }}>
                {shortAddress(ev.trader as `0x${string}`, 6)}
              </span>

              {/* Action */}
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
                {ev.type === 'LAUNCH' ? 'launched ' : ev.type === 'BUY' ? `bought ${ev.shares} share${ev.shares === 1n ? '' : 's'} of ` : `sold ${ev.shares} share${ev.shares === 1n ? '' : 's'} of `}
                <Link href={`/artwork/${ev.artworkAddress}`} style={{ color: 'var(--text)', textDecoration: 'none', fontWeight: 600 }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
                >
                  {ev.artworkName}
                </Link>
              </span>

              {/* ETH */}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', flexShrink: 0 }}>
                {formatEth(ev.eth, 4)} Ξ
              </span>

              {/* Time */}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, minWidth: 56, textAlign: 'right' }}>
                {timeAgo(ev.ts)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
