'use client';

/**
 * Global error boundary — catches uncaught errors in the React tree.
 * Shows a friendly UI instead of the Next.js "Application error" white screen.
 *
 * NOTE: This file MUST be a Client Component ('use client') per Next.js spec.
 * It wraps the entire page-level subtree below the root layout.
 */

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for debugging; swap with Sentry/LogRocket in production
    console.error('[ArtCurve] Unhandled error:', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '32px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '48px' }}>⚠️</div>
      <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#fff' }}>
        Something went wrong
      </h2>
      <p style={{ color: '#888', maxWidth: '400px', lineHeight: 1.6 }}>
        An unexpected error occurred. This is usually a temporary issue — please try again.
        {error.digest && (
          <span style={{ display: 'block', marginTop: '8px', fontSize: '12px', color: '#555' }}>
            Error ID: {error.digest}
          </span>
        )}
      </p>
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <button
          onClick={reset}
          style={{
            padding: '10px 24px',
            background: '#00ff88',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Try again
        </button>
        <a
          href="/"
          style={{
            padding: '10px 24px',
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid #333',
            borderRadius: '8px',
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: '14px',
          }}
        >
          Go home
        </a>
      </div>
    </div>
  );
}
