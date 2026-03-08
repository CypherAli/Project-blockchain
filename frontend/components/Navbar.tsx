'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useFactoryOwner } from '@/lib/hooks';

export default function Navbar() {
  const pathname = usePathname();
  const { address } = useAccount();
  const { data: owner } = useFactoryOwner();

  const isOwner = address && owner && address.toLowerCase() === (owner as string).toLowerCase();

  const navLinks = [
    { href: '/', label: 'home' },
    { href: '/explore', label: 'explore' },
    ...(isOwner ? [{ href: '/admin', label: 'admin' }] : []),
  ];

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(10,10,10,0.98)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #1e1e1e',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 52,
        }}
      >
        {/* Left: Logo + nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link href="/">
            <span
              style={{
                color: 'var(--green)',
                fontFamily: 'monospace',
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: '-0.5px',
              }}
            >
              artcurve.fun
            </span>
          </Link>

          <div style={{ display: 'flex', gap: 2 }}>
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  color: pathname === href ? 'var(--green)' : '#555',
                  transition: 'color 0.15s',
                }}
              >
                [{label}]
              </Link>
            ))}
          </div>
        </div>

        {/* Right: Launch + Wallet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/create"
            style={{
              padding: '6px 16px',
              background: 'var(--green)',
              color: '#000',
              fontFamily: 'monospace',
              fontSize: 12,
              fontWeight: 'bold',
              borderRadius: 4,
            }}
          >
            [launch artwork]
          </Link>
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
        </div>
      </div>
    </nav>
  );
}
