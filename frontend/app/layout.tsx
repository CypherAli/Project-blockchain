import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import { Providers } from './providers';
import Navbar from '@/components/Navbar';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <Navbar />
          <main style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px 48px' }}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
