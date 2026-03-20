'use client';

import { useState } from 'react';
import Link from 'next/link';

const FAQS = [
  {
    q: 'What is ArtCurve?',
    a: 'ArtCurve is a platform where artists can tokenize their artwork as shares on a bonding curve. Anyone can buy and sell shares, with prices determined automatically by supply and demand.',
  },
  {
    q: 'How does the bonding curve work?',
    a: 'Each artwork has its own bonding curve: price = k × supply + p0. As more shares are bought, the price increases linearly. When shares are sold, price decreases. This creates automatic liquidity without needing a counterparty.',
  },
  {
    q: 'What fees are charged?',
    a: 'Every buy and sell has a 5% artist royalty (paid to the original creator) and a 1% platform fee. These are deducted automatically from the transaction.',
  },
  {
    q: 'What is "graduation"?',
    a: 'When an artwork\'s reserve reaches 24 ETH, it "graduates" — the liquidity is migrated to a DEX (like Uniswap) for deeper trading. Graduated artworks get a special 🎓 badge.',
  },
  {
    q: 'How do I list my artwork?',
    a: 'Click "Launch Artwork" in the sidebar, upload your image to IPFS, set a name, and pay the 0.01 ETH listing fee. Your artwork will be live immediately with its own bonding curve.',
  },
  {
    q: 'Is this on mainnet?',
    a: 'ArtCurve supports Ethereum mainnet, Sepolia testnet, Base, and Polygon Amoy. Make sure your wallet is on the correct network before trading.',
  },
  {
    q: 'What wallets are supported?',
    a: 'Any EVM-compatible wallet works: MetaMask, Rainbow, Coinbase Wallet, WalletConnect, and more. Connect via the wallet button in the top right.',
  },
  {
    q: 'Can I sell my shares at any time?',
    a: 'Yes. The bonding curve provides instant liquidity — you can always sell back to the curve. The price you receive depends on the current supply.',
  },
];

const GUIDES = [
  { icon: '🚀', title: 'Getting Started', desc: 'Connect your wallet and buy your first artwork share in under 2 minutes.', href: '#' },
  { icon: '🎨', title: 'For Artists',     desc: 'Learn how to list your artwork, set parameters, and earn royalties forever.', href: '#' },
  { icon: '📈', title: 'Trading Guide',   desc: 'Understand bonding curves, slippage, and trading strategies.', href: '#' },
  { icon: '🔒', title: 'Security',        desc: 'Smart contract audits, risks, and best practices for staying safe.', href: '#' },
];

export default function SupportPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [search, setSearch] = useState('');

  const filtered = FAQS.filter(f =>
    search === '' || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Header */}
      <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 28, fontWeight: 800, margin: '0 0 8px', color: 'var(--text)' }}>
          Help & Support
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', margin: '0 0 20px' }}>
          Everything you need to know about ArtCurve
        </p>
        <div style={{ maxWidth: 440, margin: '0 auto', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>⌕</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search help articles..."
            style={{
              width: '100%', background: 'var(--surface-2)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
              padding: '11px 14px 11px 36px', color: 'var(--text)',
              fontFamily: 'var(--font-sans)', fontSize: 13, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Guides */}
      {!search && (
        <div>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            Quick Guides
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {GUIDES.map(({ icon, title, desc, href }) => (
              <Link key={title} href={href} style={{
                display: 'block', textDecoration: 'none',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg)', padding: '16px',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* FAQ */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
          {search ? `Results (${filtered.length})` : 'Frequently Asked Questions'}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
              No results for "{search}"
            </div>
          ) : filtered.map((faq, i) => (
            <div key={i} style={{
              background: 'var(--surface)', border: `1px solid ${openIdx === i ? 'var(--border-hover)' : 'var(--border)'}`,
              borderRadius: 'var(--r-lg)', overflow: 'hidden', transition: 'border-color 0.15s',
            }}>
              <button onClick={() => setOpenIdx(openIdx === i ? null : i)} style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer',
                textAlign: 'left', gap: 12,
              }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  {faq.q}
                </span>
                <span style={{
                  flexShrink: 0, width: 20, height: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)', transition: 'transform 0.2s',
                  transform: openIdx === i ? 'rotate(45deg)' : 'none',
                  fontSize: 18,
                }}>+</span>
              </button>
              {openIdx === i && (
                <div style={{
                  padding: '0 18px 16px',
                  fontFamily: 'var(--font-sans)', fontSize: 13,
                  color: 'var(--text-muted)', lineHeight: 1.7,
                  borderTop: '1px solid var(--border)',
                  paddingTop: 14,
                }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', padding: '24px', textAlign: 'center',
      }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          Still need help?
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
          Join our community or reach out directly
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { label: 'Discord', icon: '💬', color: '#5865F2' },
            { label: 'Twitter / X', icon: '𝕏', color: 'var(--text-dim)' },
            { label: 'GitHub', icon: '⌥', color: 'var(--text-dim)' },
          ].map(({ label, icon, color }) => (
            <button key={label} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', background: 'var(--surface-2)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
              color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
              fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
