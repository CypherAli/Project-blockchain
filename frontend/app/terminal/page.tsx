'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DEMO_ARTWORKS } from '@/lib/demo';
import { formatEth, formatUsd, graduationProgress } from '@/lib/contracts';

export default function TerminalPage() {
  const [selected, setSelected] = useState(DEMO_ARTWORKS[0].address);
  const artwork = DEMO_ARTWORKS.find(a => a.address === selected) ?? DEMO_ARTWORKS[0];
  const progress = graduationProgress(artwork.reserve);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
            Terminal
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Advanced trading view
          </p>
        </div>

        {/* Artwork selector */}
        <select value={selected} onChange={e => setSelected(e.target.value as `0x${string}`)} style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', padding: '8px 14px',
          color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12,
          cursor: 'pointer', outline: 'none',
        }}>
          {DEMO_ARTWORKS.map(a => (
            <option key={a.address} value={a.address}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Ticker bar */}
      <div style={{
        display: 'flex', gap: 24, alignItems: 'center',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', padding: '12px 20px',
        overflowX: 'auto',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap' }}>
            {artwork.name}
          </div>
          <Link href={`/artwork/${artwork.address}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal)', textDecoration: 'none' }}>
            view detail ↗
          </Link>
        </div>
        {[
          { label: 'Price',    value: `${formatEth(artwork.price, 5)} Ξ`,      sub: formatUsd(artwork.price),       color: 'var(--green)' },
          { label: 'Mkt Cap', value: formatUsd(artwork.marketCap),               sub: `${formatEth(artwork.marketCap, 4)} Ξ`, color: 'var(--text)' },
          { label: 'Volume',  value: formatUsd(artwork.totalVolume),              sub: `${formatEth(artwork.totalVolume, 3)} Ξ`, color: 'var(--text)' },
          { label: 'Supply',  value: artwork.supply.toString() + ' shares',       sub: '',                              color: 'var(--text-dim)' },
          { label: 'Progress', value: `${progress.toFixed(1)}%`,                 sub: artwork.graduated ? '🎓 graduated' : 'to graduation', color: artwork.graduated ? 'var(--gold)' : progress >= 80 ? 'var(--gold-light)' : 'var(--green)' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color }}>{value}</div>
            {sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>

        {/* Chart placeholder */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', padding: 20, minHeight: 380,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Price Chart
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {['1H', '4H', '1D', '1W', 'ALL'].map(t => (
                <button key={t} style={{
                  padding: '3px 8px', background: t === '1D' ? 'var(--surface-3)' : 'transparent',
                  border: `1px solid ${t === '1D' ? 'var(--border-focus)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-sm)', color: t === '1D' ? 'var(--text)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer',
                }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* SVG bonding curve visualization */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <svg width="100%" height="240" viewBox="0 0 500 240" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--green)" stopOpacity="0.4"/>
                  <stop offset="100%" stopColor="var(--green)" stopOpacity="0.02"/>
                </linearGradient>
              </defs>
              {/* Area fill */}
              <path
                d="M0,220 C40,200 80,180 120,155 C160,130 180,125 220,110 C260,95 280,85 320,70 C360,55 400,42 440,28 L500,20 L500,240 L0,240 Z"
                fill="url(#chartGrad)"
              />
              {/* Line */}
              <path
                d="M0,220 C40,200 80,180 120,155 C160,130 180,125 220,110 C260,95 280,85 320,70 C360,55 400,42 440,28 L500,20"
                fill="none" stroke="var(--green)" strokeWidth="2"
              />
              {/* Dots */}
              {[[0,220],[120,155],[220,110],[320,70],[440,28],[500,20]].map(([x,y], i) => (
                <circle key={i} cx={x} cy={y} r="3" fill="var(--green)" opacity="0.8"/>
              ))}
            </svg>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
              Live chart connects when blockchain is deployed
            </span>
          </div>
        </div>

        {/* Order book + recent trades */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Order book */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 14 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Order Book (Simulated)
            </div>
            {/* Sells */}
            {[5,4,3,2,1].map(i => {
              const p = artwork.price + BigInt(i) * 4_000_000_000_000_000n;
              return (
                <div key={`sell-${i}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  <span style={{ color: 'var(--terra)' }}>{formatEth(p, 5)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{i * 2} Ξ</span>
                </div>
              );
            })}
            <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>
              {formatEth(artwork.price, 5)} Ξ
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
            {/* Buys */}
            {[1,2,3,4,5].map(i => {
              const p = artwork.price - BigInt(i) * 4_000_000_000_000_000n;
              return (
                <div key={`buy-${i}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  <span style={{ color: 'var(--green)' }}>{formatEth(p, 5)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{i * 3} Ξ</span>
                </div>
              );
            })}
          </div>

          {/* Quick trade */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 14 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Quick Trade
            </div>
            <Link href={`/artwork/${artwork.address}`} style={{
              display: 'block', textAlign: 'center',
              padding: '10px', background: 'var(--green)',
              color: 'hsl(135 28% 8%)', borderRadius: 'var(--r-md)',
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
              textDecoration: 'none', transition: 'opacity 0.15s',
            }}>
              Open Full Trade Panel →
            </Link>
          </div>
        </div>
      </div>

      {/* All artworks table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          All Artworks
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Price', 'Market Cap', 'Volume', 'Progress', ''].map(h => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEMO_ARTWORKS.map((a, i) => {
                const prog = graduationProgress(a.reserve);
                return (
                  <tr key={a.address} onClick={() => setSelected(a.address)} style={{
                    background: a.address === selected ? 'var(--surface-2)' : 'transparent',
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                      #{i + 1} {a.name}
                      {a.graduated && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--gold)' }}>🎓</span>}
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--green)', whiteSpace: 'nowrap' }}>
                      {formatEth(a.price, 4)} Ξ
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                      {formatUsd(a.marketCap)}
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatEth(a.totalVolume, 2)} Ξ
                    </td>
                    <td style={{ padding: '10px 16px', minWidth: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 4, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(prog, 100)}%`, height: '100%', background: a.graduated ? 'var(--gold)' : prog >= 80 ? 'var(--gold-light)' : 'var(--green)', borderRadius: 99 }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{prog.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Link href={`/artwork/${a.address}`} onClick={e => e.stopPropagation()} style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal)', textDecoration: 'none',
                      }}>
                        trade →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
