'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useEffect, useState } from 'react';
import { useFactoryOwner } from '@/lib/hooks';

/* ─── Navbar ─────────────────────────────────────────────────────────────── */
export default function Navbar() {
  const pathname    = usePathname();
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

  const navLinks = [
    { href: '/',        label: 'FEED',    exact: true },
    { href: '/explore', label: 'EXPLORE', exact: false },
    ...(address ? [{ href: `/profile/${address}`, label: 'PROFILE', exact: false }] : []),
    ...(isOwner ? [{ href: '/admin', label: 'ADMIN', exact: false }] : []),
  ];

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      style={{
        position:           'sticky',
        top:                0,
        zIndex:             200,
        background:         scrolled
          ? 'hsl(220 22% 4% / 0.96)'
          : 'hsl(220 22% 4% / 0.75)',
        backdropFilter:         'blur(28px) saturate(160%)',
        WebkitBackdropFilter:   'blur(28px) saturate(160%)',
        borderBottom:       `1px solid ${scrolled ? 'var(--border-hover)' : 'var(--border)'}`,
        boxShadow:          scrolled ? '0 4px 40px hsl(0 0% 0% / 0.6)' : 'none',
        transition:         'all 0.3s var(--ease-out)',
      }}
    >
      <div
        style={{
          maxWidth:   1280,
          margin:     '0 auto',
          padding:    '0 24px',
          height:     64,
          display:    'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap:        16,
        }}
      >
        {/* ── Logo (left) ── */}
        <Link
          href="/"
          aria-label="ArtCurve home"
          style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', transition: 'opacity 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <Image
            src="/artcurve-logo-transparent.png"
            alt="ArtCurve"
            width={936}
            height={267}
            style={{ height: 36, width: 'auto', display: 'block' }}
            priority
          />
        </Link>

        {/* ── Nav links (center) ── */}
        <div style={{ display: 'flex', gap: 0 }} role="list">
          {navLinks.map(({ href, label, exact }) => {
            const active = exact ? pathname === href : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                role="listitem"
                style={{
                  display:        'inline-flex',
                  alignItems:     'center',
                  padding:        '6px 16px',
                  fontSize:       12,
                  fontWeight:     active ? 700 : 400,
                  letterSpacing:  '0.12em',
                  color:          active ? 'var(--gold)' : 'var(--text-dim)',
                  textDecoration: 'none',
                  transition:     'color 0.15s',
                  fontFamily:     'var(--font-sans)',
                  position:       'relative',
                }}
                onMouseEnter={e => !active && (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => !active && (e.currentTarget.style.color = 'var(--text-dim)')}
              >
                {label}
                {/* Active underline */}
                {active && (
                  <span
                    aria-hidden="true"
                    style={{
                      position:    'absolute',
                      bottom:      -1,
                      left:        '50%',
                      transform:   'translateX(-50%)',
                      width:       '60%',
                      height:      1,
                      background:  'var(--gold)',
                      borderRadius: 'var(--r-full)',
                      boxShadow:   '0 0 8px var(--gold-glow)',
                    }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* ── Right: launch + wallet ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
          <Link
            href="/create"
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              gap:            5,
              padding:        '8px 16px',
              background:     'transparent',
              color:          'var(--text-dim)',
              border:         '1px solid var(--border-hover)',
              borderRadius:   'var(--r-sm)',
              fontSize:       12,
              fontWeight:     600,
              letterSpacing:  '0.06em',
              fontFamily:     'var(--font-sans)',
              textDecoration: 'none',
              transition:     'all 0.18s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--text-dim)';
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-hover)';
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-dim)';
            }}
          >
            + LAUNCH
          </Link>
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="avatar"
          />
        </div>
      </div>
    </nav>
  );
}
