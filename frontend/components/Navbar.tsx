'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useEffect, useState } from 'react';
import { useFactoryOwner } from '@/lib/hooks';

/* ─── Navbar ─────────────────────────────────────────────────────────────── */
export default function Navbar() {
  const { address } = useAccount();
  const { data: owner } = useFactoryOwner();
  const [scrolled, setScrolled] = useState(false);

  const isOwner =
    address && owner &&
    address.toLowerCase() === (owner as string).toLowerCase();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      style={{
        position:             'sticky',
        top:                  0,
        zIndex:               200,
        background:           scrolled ? 'hsl(220 22% 4% / 0.96)' : 'hsl(220 22% 4% / 0.75)',
        backdropFilter:       'blur(28px) saturate(160%)',
        WebkitBackdropFilter: 'blur(28px) saturate(160%)',
        borderBottom:         `1px solid ${scrolled ? 'var(--border-hover)' : 'var(--border)'}`,
        boxShadow:            scrolled ? '0 4px 40px hsl(0 0% 0% / 0.6)' : 'none',
        transition:           'all 0.3s var(--ease-out)',
      }}
    >
      <div style={{
        padding:    '0 24px',
        height:     64,
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* ── Logo ── */}
        <Link href="/" aria-label="ArtCurve home"
          style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', transition: 'opacity 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <Image
            src="/artcurve-logo-transparent.png"
            alt="ArtCurve"
            width={936}
            height={267}
            style={{ height: 34, width: 'auto', display: 'block' }}
            priority
          />
        </Link>

        {/* ── Right: admin link + wallet ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!!isOwner && (
            <Link href="/admin" style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--terra)',
              border: '1px solid var(--terra)', borderRadius: 'var(--r-sm)',
              padding: '4px 10px', textDecoration: 'none', letterSpacing: '0.06em',
            }}>
              ADMIN
            </Link>
          )}
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
        </div>
      </div>
    </nav>
  );
}
