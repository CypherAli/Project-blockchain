'use client';

/**
 * Client-side providers wrapper.
 * Separated from layout.tsx so layout can remain a server component (for metadata export).
 *
 * SSR hydration: layout.tsx reads the raw cookie string and passes it here.
 * We call cookieToInitialState() client-side so wagmiConfig (getDefaultConfig from
 * RainbowKit) is never evaluated on the server, avoiding the "client-only" error.
 */

import { useMemo, useState } from 'react';
import { WagmiProvider, cookieToInitialState } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { wagmiConfig } from '@/lib/wagmi';
import { ToastProvider } from '@/components/ui/Toast';

export function Providers({
  children,
  cookie,
}: {
  children: React.ReactNode;
  cookie?: string | null;
}) {
  // Derive wagmi initial state from cookie — prevents hydration mismatch.
  // cookieToInitialState() is safe to call client-side.
  const initialState = useMemo(
    () => cookieToInitialState(wagmiConfig, cookie ?? undefined),
    [cookie]
  );

  // Must be inside useState to prevent sharing state across requests in SSR
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              if (error instanceof Error && error.message.includes('revert')) return false;
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#00ff88',
            accentColorForeground: '#000000',
            borderRadius: 'small',
            fontStack: 'system',
          })}
        >
          <ToastProvider>{children}</ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
