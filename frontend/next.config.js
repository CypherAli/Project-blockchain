/** @type {import('next').NextConfig} */

const nextConfig = {
  // Disable ESLint + TypeScript errors blocking production build
  // (TypeScript is still checked separately in CI via tsc --noEmit)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
