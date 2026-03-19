'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useState } from 'react';

/* ─── Nav items ──────────────────────────────────────────────────────────── */
const NAV_ITEMS = [
  {
    href: '/',
    exact: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
        <path d="M9 21V12h6v9"/>
      </svg>
    ),
    label: 'Home',
  },
  {
    href: '/live',
    exact: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="2"/>
        <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
      </svg>
    ),
    label: 'Live',
    badge: 'LIVE',
  },
  {
    href: '/terminal',
    exact: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8m-4-4v4"/>
        <path d="M7 8l3 3-3 3m5 0h3"/>
      </svg>
    ),
    label: 'Terminal',
  },
  {
    href: '/chat',
    exact: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    label: 'Chat',
  },
  {
    href: '/support',
    exact: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3m.08 4h.01"/>
      </svg>
    ),
    label: 'Support',
  },
];

const MORE_ITEMS = [
  { href: '/explore', label: 'Explore' },
  { href: '/board',   label: 'Board'   },
];

/* ─── Sidebar ────────────────────────────────────────────────────────────── */
export default function Sidebar() {
  const pathname = usePathname();
  const { address } = useAccount();
  const [moreOpen, setMoreOpen] = useState(false);

  const profileHref = address ? `/profile/${address}` : '/profile';

  const allNavItems = [
    ...NAV_ITEMS,
    {
      href: profileHref,
      exact: false,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
      ),
      label: 'Profile',
    },
  ];

  return (
    <aside style={{
      position:       'sticky',
      top:            64,
      height:         'calc(100vh - 64px)',
      width:          220,
      flexShrink:     0,
      display:        'flex',
      flexDirection:  'column',
      background:     'var(--bg)',
      borderRight:    '1px solid var(--border)',
      padding:        '16px 0',
      overflowY:      'auto',
      overflowX:      'hidden',
      zIndex:         10001,
    }}>

      {/* Nav items */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px' }}>
        {allNavItems.map(({ href, exact, icon, label, badge }: any) => {
          const active = exact ? pathname === href : pathname?.startsWith(href.split('/').slice(0,2).join('/'));
          return (
            <Link key={href} href={href} style={{
              display:        'flex',
              alignItems:     'center',
              gap:            10,
              padding:        '10px 12px',
              borderRadius:   'var(--r-md)',
              textDecoration: 'none',
              color:          active ? 'var(--text)' : 'var(--text-muted)',
              background:     active ? 'var(--surface-2)' : 'transparent',
              fontFamily:     'var(--font-sans)',
              fontSize:       14,
              fontWeight:     active ? 600 : 400,
              transition:     'all 0.15s',
              position:       'relative',
            }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; } }}
            >
              <span style={{ flexShrink: 0, color: active ? 'var(--green)' : 'currentColor', display: 'flex' }}>{icon}</span>
              <span>{label}</span>
              {badge && (
                <span style={{
                  marginLeft: 'auto', fontSize: 8, fontWeight: 800, fontFamily: 'var(--font-mono)',
                  background: 'hsl(0 72% 52% / 0.18)', color: '#ff5555',
                  border: '1px solid hsl(0 72% 52% / 0.4)',
                  padding: '1px 5px', borderRadius: 4, letterSpacing: '0.06em',
                  animation: 'pulse 2s infinite',
                }}>
                  {badge}
                </span>
              )}
              {active && (
                <span style={{
                  position: 'absolute', left: 0, top: '20%', bottom: '20%',
                  width: 3, borderRadius: '0 2px 2px 0',
                  background: 'var(--green)',
                }} />
              )}
            </Link>
          );
        })}

        {/* More */}
        <div>
          <button onClick={() => setMoreOpen(o => !o)} style={{
            display:        'flex',
            alignItems:     'center',
            gap:            10,
            padding:        '10px 12px',
            borderRadius:   'var(--r-md)',
            background:     moreOpen ? 'var(--surface)' : 'transparent',
            color:          'var(--text-muted)',
            border:         'none',
            cursor:         'pointer',
            fontFamily:     'var(--font-sans)',
            fontSize:       14,
            fontWeight:     400,
            width:          '100%',
            textAlign:      'left',
            transition:     'all 0.15s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
            onMouseLeave={e => { if (!moreOpen) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; } }}
          >
            <span style={{ display: 'flex', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>
              </svg>
            </span>
            <span>More</span>
            <span style={{ marginLeft: 'auto', transition: 'transform 0.15s', transform: moreOpen ? 'rotate(180deg)' : 'none', display: 'flex' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </span>
          </button>

          {moreOpen && (
            <div style={{ paddingLeft: 12 }}>
              {MORE_ITEMS.map(({ href, label }) => {
                const active = pathname?.startsWith(href);
                return (
                  <Link key={href} href={href} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: 'var(--r-md)',
                    color: active ? 'var(--text)' : 'var(--text-muted)',
                    background: active ? 'var(--surface-2)' : 'transparent',
                    fontFamily: 'var(--font-sans)', fontSize: 13,
                    textDecoration: 'none', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
                    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; } }}
                  >
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', display: 'inline-block', flexShrink: 0 }} />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

      {/* Launch button */}
      <div style={{ padding: '0 10px', marginBottom: 8 }}>
        <Link href="/create" style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            8,
          padding:        '11px 16px',
          background:     'var(--green)',
          color:          'hsl(135 28% 8%)',
          borderRadius:   'var(--r-md)',
          fontFamily:     'var(--font-sans)',
          fontSize:       13,
          fontWeight:     700,
          textDecoration: 'none',
          transition:     'opacity 0.15s, transform 0.15s',
          letterSpacing:  '0.02em',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.88'; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; (e.currentTarget as HTMLAnchorElement).style.transform = 'none'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Launch Artwork
        </Link>
      </div>

      {/* Wallet (collapsed) */}
      <div style={{ padding: '0 10px 4px', display: 'flex', justifyContent: 'center' }}>
        <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar" />
      </div>
    </aside>
  );
}
