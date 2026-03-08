import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import { Providers } from './providers';
import Navbar from '@/components/Navbar';
// NOTE: wagmiConfig uses getDefaultConfig() which is client-only (RainbowKit).
// Do NOT import wagmiConfig here. Pass raw cookie to Providers instead.

const inter = Inter({ subsets: ['latin'] });

// ─── SEO Metadata ─────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    default: 'ArtCurve — Trade Art on a Bonding Curve',
    template: '%s | ArtCurve',
  },
  description:
    'Buy and sell shares of digital artworks. Artists earn 5% royalty on every trade. ' +
    'Instant liquidity via bonding curve — pump.fun for real art.',
  keywords: ['NFT', 'bonding curve', 'art trading', 'DeFi', 'fractional ownership', 'royalties'],
  authors: [{ name: 'ArtCurve' }],
  openGraph: {
    type: 'website',
    siteName: 'ArtCurve',
    title: 'ArtCurve — Trade Art on a Bonding Curve',
    description: 'Instant liquidity for digital art. Perpetual on-chain royalties.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ArtCurve',
    description: 'Buy and sell fractional shares of digital artworks.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  colorScheme: 'dark',
};

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read the raw cookie string and pass it to the client Providers component,
  // which calls cookieToInitialState() with wagmiConfig on the client side.
  const cookie = (await headers()).get('cookie');

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers cookie={cookie}>
          <Navbar />
          <main style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px 48px' }}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
