import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono, Playfair_Display } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import { Providers } from './providers';
import Navbar from '@/components/Navbar';
// NOTE: wagmiConfig uses getDefaultConfig() which is client-only (RainbowKit).
// Do NOT import wagmiConfig here — pass raw cookie to Providers instead.

/* ─── Fonts — editorial system ───────────────────────────────────────────── */
const jakarta = Plus_Jakarta_Sans({
  subsets:  ['latin'],
  weight:   ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display:  'swap',
});

const jetbrains = JetBrains_Mono({
  subsets:  ['latin'],
  weight:   ['400', '500', '600'],
  variable: '--font-mono',
  display:  'swap',
});

const playfair = Playfair_Display({
  subsets:  ['latin'],
  weight:   ['400', '700', '900'],
  style:    ['normal', 'italic'],
  variable: '--font-display',
  display:  'swap',
});

/* ─── SEO ─────────────────────────────────────────────────────────────────── */
export const metadata: Metadata = {
  title: {
    default:  'ArtCurve — Trade Art on a Bonding Curve',
    template: '%s | ArtCurve',
  },
  description:
    'Buy and sell shares of digital artworks. Artists earn 5% royalty on every trade. ' +
    'Instant liquidity via bonding curve — pump.fun for real art.',
  keywords: ['NFT', 'bonding curve', 'art trading', 'DeFi', 'fractional ownership', 'royalties'],
  authors:  [{ name: 'ArtCurve' }],
  openGraph: {
    type:        'website',
    siteName:    'ArtCurve',
    title:       'ArtCurve — Trade Art on a Bonding Curve',
    description: 'Instant liquidity for digital art. Perpetual on-chain royalties.',
  },
  twitter: {
    card:        'summary_large_image',
    title:       'ArtCurve',
    description: 'Buy and sell fractional shares of digital artworks.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor:  '#07080d',
  colorScheme: 'dark',
};

/* ─── Root Layout ─────────────────────────────────────────────────────────── */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookie = (await headers()).get('cookie');

  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${jetbrains.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers cookie={cookie}>
          <Navbar />
          <main style={{ maxWidth: 1400, margin: '0 auto', padding: '0 88px 64px', overflowX: 'hidden' }}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
