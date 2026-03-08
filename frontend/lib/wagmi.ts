import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { hardhat, sepolia, polygonAmoy, baseSepolia } from 'wagmi/chains';

export const wagmiConfig = getDefaultConfig({
  appName: 'ArtCurve',
  appDescription: 'Bonding Curve Art Trading — pump.fun for real artists',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://artcurve.fun',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'demo',
  chains: [hardhat, sepolia, polygonAmoy, baseSepolia],
  ssr: true,
});

// Re-export chains for use in other files
export { hardhat, sepolia, polygonAmoy, baseSepolia };
