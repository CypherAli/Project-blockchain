/** @type {import('next').NextConfig} */

// Next.js 15+ removed the eslint/typescript keys from next.config.js.
// TypeScript is checked separately in CI via `tsc --noEmit`.
// ESLint is run separately via `eslint .`.
const nextConfig = {
  reactStrictMode: false,
};

module.exports = nextConfig;
