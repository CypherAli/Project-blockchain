'use client';

/**
 * Error Boundary — prevents white screen on runtime errors.
 *
 * Usage (React class component — required for error boundaries):
 *   <ErrorBoundary fallback="Failed to load artwork">
 *     <ArtworkPage />
 *   </ErrorBoundary>
 *
 * For async errors (contract calls, fetches), use <AsyncError> instead.
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

// ─── Class-based ErrorBoundary ────────────────────────────────────────────────

interface Props {
  children: ReactNode;
  /** Custom fallback UI or message string */
  fallback?: ReactNode | string;
  /** Called on error — useful for logging */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'string') {
        return (
          <ErrorCard
            message={this.props.fallback}
            error={this.state.error}
            onRetry={this.handleReset}
          />
        );
      }
      return this.props.fallback ?? (
        <ErrorCard
          message="Something went wrong"
          error={this.state.error}
          onRetry={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}

// ─── Functional error display (for async errors / not-found states) ──────────

interface ErrorCardProps {
  message?: string;
  error?: Error | null;
  onRetry?: () => void;
}

export function ErrorCard({ message = 'Failed to load', error, onRetry }: ErrorCardProps) {
  return (
    <div
      style={{
        background: 'var(--card-bg)',
        border: '1px solid #ff444433',
        borderRadius: 8,
        padding: '24px 20px',
        textAlign: 'center',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>⚠</div>
      <div style={{ color: '#ff4444', marginBottom: 6, fontSize: 14 }}>{message}</div>
      {error && process.env.NODE_ENV === 'development' && (
        <div
          style={{
            color: '#666',
            fontSize: 11,
            marginBottom: 12,
            padding: '8px',
            background: '#1a0a0a',
            borderRadius: 4,
            textAlign: 'left',
            wordBreak: 'break-all',
          }}
        >
          {error.message}
        </div>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'transparent',
            border: '1px solid var(--green)',
            color: 'var(--green)',
            padding: '6px 16px',
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          [retry]
        </button>
      )}
    </div>
  );
}

// ─── Async error helper (for useQuery/hooks error states) ─────────────────────

interface AsyncErrorProps {
  error: unknown;
  onRetry?: () => void;
  context?: string;
}

export function AsyncError({ error, onRetry, context }: AsyncErrorProps) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
    ? error
    : 'Unknown error';

  return (
    <ErrorCard
      message={context ? `Failed to load ${context}` : 'Failed to load'}
      error={error instanceof Error ? error : new Error(message)}
      onRetry={onRetry}
    />
  );
}

// ─── Not Found helper ─────────────────────────────────────────────────────────

export function NotFound({ message = 'Not found' }: { message?: string }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '60px 20px',
        fontFamily: 'monospace',
        color: '#555',
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 12 }}>404</div>
      <div>{message}</div>
    </div>
  );
}
