'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useEffect, useState } from 'react';
import { useFactoryOwner } from '@/lib/hooks';

/* ─── Sprout icon — inline SVG, zero dependency ─────────────────────────── */
function SproutIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {/* Stem */}
      <path d="M10 17V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Left leaf — facing sun */}
      <path
        d="M10 13C10 13 5.5 12 5 8C8 7.5 10 10.5 10 13Z"
        fill="currentColor"
        opacity="0.75"
      />
      {/* Right leaf — primary */}
      <path d="M10 9.5C10 9.5 13.5 8 15 4.5C12.5 4.5 10 7 10 9.5Z" fill="currentColor" />
      {/* Ground line */}
      <path
        d="M8 17H12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}

/* ─── Plus icon ───────────────────────────────────────────────────────────── */
function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Navbar ─────────────────────────────────────────────────────────────── */
export default function Navbar() {
  const pathname    = usePathname();
  const { address } = useAccount();
  const { data: owner } = useFactoryOwner();
  const [scrolled, setScrolled] = useState(false);

  const isOwner =
    address && owner &&
    address.toLowerCase() === (owner as string).toLowerCase();

  /* Scroll-reactive background */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { href: '/',        label: 'feed',    exact: true },
    { href: '/explore', label: 'explore', exact: false },
    ...(isOwner ? [{ href: '/admin', label: 'admin', exact: false }] : []),
  ];

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      style={{
        position:           'sticky',
        top:                0,
        zIndex:             100,
        background:         scrolled
          ? 'hsl(135 28% 8% / 0.94)'
          : 'hsl(135 28% 8% / 0.70)',
        backdropFilter:         'blur(24px) saturate(180%)',
        WebkitBackdropFilter:   'blur(24px) saturate(180%)',
        borderBottom:       '1px solid var(--border)',
        boxShadow:          scrolled ? '0 4px 32px hsl(135 28% 4% / 0.5)' : 'none',
        transition:         'background 0.35s ease, box-shadow 0.35s ease',
      }}
    >
      <div
        style={{
          maxWidth:   1280,
          margin:     '0 auto',
          padding:    '0 20px',
          height:     60,
          display:    'flex',
          alignItems: 'center',
          gap:        8,
        }}
      >
        {/* ── Logo ── */}
        <Link
          href="/"
          aria-label="ArtCurve home"
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            8,
            color:          'var(--green)',
            fontFamily:     'var(--font-sans)',
            fontSize:       18,
            fontWeight:     800,
            letterSpacing:  '-0.02em',
            marginRight:    16,
            flexShrink:     0,
            textDecoration: 'none',
            transition:     'color 0.15s',
          }}
        >
          <SproutIcon />
          artcurve
        </Link>

        {/* ── Nav links ── */}
        <div style={{ display: 'flex', gap: 2 }} role="list">
          {navLinks.map(({ href, label, exact }) => {
            const active = exact ? pathname === href : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                role="listitem"
                style={{
                  position:       'relative',
                  display:        'inline-flex',
                  alignItems:     'center',
                  gap:            6,
                  padding:        '6px 12px',
                  borderRadius:   'var(--r-md)',
                  fontSize:       14,
                  fontWeight:     active ? 600 : 400,
                  color:          active ? 'var(--text)' : 'var(--text-dim)',
                  background:     active ? 'var(--surface-2)' : 'transparent',
                  border:         active ? '1px solid var(--border)' : '1px solid transparent',
                  textDecoration: 'none',
                  transition:     'color 0.15s, background 0.15s',
                  fontFamily:     'var(--font-sans)',
                }}
              >
                {/* Active indicator — living green dot */}
                {active && (
                  <span
                    aria-hidden="true"
                    style={{
                      width:        5,
                      height:       5,
                      borderRadius: '50%',
                      background:   'var(--green)',
                      boxShadow:    '0 0 6px var(--green-glow)',
                      flexShrink:   0,
                    }}
                  />
                )}
                {label}
              </Link>
            );
          })}
        </div>

        {/* ── Spacer ── */}
        <div style={{ flex: 1 }} />

        {/* ── Launch CTA ── */}
        <Link
          href="/create"
          aria-label="Launch a new artwork"
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            gap:            6,
            padding:        '8px 18px',
            borderRadius:   'var(--r-md)',
            fontSize:       13,
            fontWeight:     600,
            fontFamily:     'var(--font-sans)',
            color:          'hsl(135 28% 8%)',
            background:     'var(--green)',
            textDecoration: 'none',
            letterSpacing:  '0.01em',
            flexShrink:     0,
            transition:     'background 0.15s, box-shadow 0.15s, transform 0.1s var(--ease-spring)',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget;
            el.style.background  = 'var(--green-dim)';
            el.style.boxShadow   = '0 0 22px var(--green-glow)';
            el.style.transform   = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget;
            el.style.background = 'var(--green)';
            el.style.boxShadow  = 'none';
            el.style.transform  = 'translateY(0)';
          }}
        >
          <PlusIcon />
          launch artwork
        </Link>

        {/* ── Wallet ── */}
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
      </div>
    </nav>
  );
}
