import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { hardhat, sepolia, polygonAmoy, baseSepolia } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "ArtCurve — Bonding Curve Art Trading",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [
    hardhat,
    sepolia,
    polygonAmoy,
    baseSepolia,
  ],
  ssr: true,
});

export { hardhat, sepolia, polygonAmoy, baseSepolia };
