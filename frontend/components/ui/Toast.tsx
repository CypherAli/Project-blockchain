'use client';

/**
 * Toast notification system.
 *
 * Features:
 * - Pending → Success → Error states with animated transitions
 * - Block explorer link for transaction toasts
 * - Auto-dismiss after configurable duration
 * - Stack up to 5 toasts
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.pending('Confirming transaction...');
 *   toast.success('Shares purchased!', txHash);
 *   toast.error('Transaction failed: insufficient ETH');
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import { getExplorerUrl } from '../../lib/config';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'pending' | 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  txHash?: `0x${string}`;
  duration: number; // ms, 0 = sticky
}

type ToastAction =
  | { type: 'ADD'; toast: ToastItem }
  | { type: 'UPDATE'; id: string; patch: Partial<ToastItem> }
  | { type: 'REMOVE'; id: string };

// ─── Reducer ─────────────────────────────────────────────────────────────────

function toastReducer(state: ToastItem[], action: ToastAction): ToastItem[] {
  switch (action.type) {
    case 'ADD':
      return [...state.slice(-4), action.toast]; // max 5 toasts
    case 'UPDATE':
      return state.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t));
    case 'REMOVE':
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ToastContextValue {
  toasts: ToastItem[];
  /** Show a pending toast — returns id for update/dismiss */
  pending: (message: string) => string;
  /** Update an existing toast to success */
  success: (id: string, message: string, txHash?: `0x${string}`) => void;
  /** Update an existing toast to error */
  error: (id: string, message: string) => void;
  /** Standalone success toast */
  successNew: (message: string, txHash?: `0x${string}`) => string;
  /** Standalone error toast */
  errorNew: (message: string) => string;
  /** Info toast */
  info: (message: string) => string;
  /** Manually dismiss */
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const scheduleRemove = useCallback((id: string, duration: number) => {
    if (duration <= 0) return;
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      dispatch({ type: 'REMOVE', id });
      timers.current.delete(id);
    }, duration);
    timers.current.set(id, timer);
  }, []);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    dispatch({ type: 'REMOVE', id });
  }, []);

  const pending = useCallback((message: string): string => {
    const id = Math.random().toString(36).slice(2);
    dispatch({ type: 'ADD', toast: { id, type: 'pending', message, duration: 0 } });
    return id;
  }, []);

  const success = useCallback((id: string, message: string, txHash?: `0x${string}`) => {
    dispatch({ type: 'UPDATE', id, patch: { type: 'success', message, txHash, duration: 5000 } });
    scheduleRemove(id, 5000);
  }, [scheduleRemove]);

  const error = useCallback((id: string, message: string) => {
    dispatch({ type: 'UPDATE', id, patch: { type: 'error', message, duration: 7000 } });
    scheduleRemove(id, 7000);
  }, [scheduleRemove]);

  const successNew = useCallback((message: string, txHash?: `0x${string}`): string => {
    const id = Math.random().toString(36).slice(2);
    dispatch({ type: 'ADD', toast: { id, type: 'success', message, txHash, duration: 5000 } });
    scheduleRemove(id, 5000);
    return id;
  }, [scheduleRemove]);

  const errorNew = useCallback((message: string): string => {
    const id = Math.random().toString(36).slice(2);
    dispatch({ type: 'ADD', toast: { id, type: 'error', message, duration: 7000 } });
    scheduleRemove(id, 7000);
    return id;
  }, [scheduleRemove]);

  const info = useCallback((message: string): string => {
    const id = Math.random().toString(36).slice(2);
    dispatch({ type: 'ADD', toast: { id, type: 'info', message, duration: 4000 } });
    scheduleRemove(id, 4000);
    return id;
  }, [scheduleRemove]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { timers.current.forEach(clearTimeout); };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, pending, success, error, successNew, errorNew, info, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Toast UI ─────────────────────────────────────────────────────────────────

const ICONS: Record<ToastType, string> = {
  pending: '⟳',
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  pending: { bg: '#1a1a2e', border: '#4444ff44', icon: '#8888ff' },
  success: { bg: '#0a1a0e', border: '#00ff8844', icon: '#00ff88' },
  error:   { bg: '#1a0a0a', border: '#ff444444', icon: '#ff4444' },
  info:    { bg: '#0a1520', border: '#00aaff44', icon: '#00aaff' },
};

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 380,
        width: '100%',
      }}
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const colors = COLORS[toast.type];
  const icon = ICONS[toast.type];
  const explorerUrl = toast.txHash ? getExplorerUrl('tx', toast.txHash) : null;

  return (
    <div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        fontFamily: 'monospace',
        fontSize: 13,
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        animation: 'slideIn 0.2s ease-out',
      }}
    >
      {/* Icon */}
      <span
        style={{
          color: colors.icon,
          fontSize: 16,
          lineHeight: 1,
          marginTop: 1,
          flexShrink: 0,
          animation: toast.type === 'pending' ? 'spin 1s linear infinite' : undefined,
          display: 'inline-block',
        }}
      >
        {icon}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#e0e0e0', lineHeight: 1.4 }}>{toast.message}</div>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: colors.icon,
              fontSize: 11,
              textDecoration: 'none',
              opacity: 0.8,
              marginTop: 4,
              display: 'block',
            }}
          >
            view on explorer →
          </a>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          color: '#666',
          cursor: 'pointer',
          padding: 0,
          fontSize: 14,
          lineHeight: 1,
          flexShrink: 0,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
