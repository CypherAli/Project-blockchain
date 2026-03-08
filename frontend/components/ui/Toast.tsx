'use client';

/**
 * Toast notification system — Solarpunk edition
 *
 * States: pending → success | error | info
 * Features:
 *   - Glassmorphism panels with forest green tint
 *   - Block explorer link for tx toasts
 *   - Auto-dismiss with configurable duration
 *   - Stack up to 5 toasts, oldest drops off
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
  id:       string;
  type:     ToastType;
  message:  string;
  txHash?:  `0x${string}`;
  duration: number; // ms; 0 = sticky
}

type ToastAction =
  | { type: 'ADD';    toast: ToastItem }
  | { type: 'UPDATE'; id: string; patch: Partial<ToastItem> }
  | { type: 'REMOVE'; id: string };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function toastReducer(state: ToastItem[], action: ToastAction): ToastItem[] {
  switch (action.type) {
    case 'ADD':    return [...state.slice(-4), action.toast];
    case 'UPDATE': return state.map(t => t.id === action.id ? { ...t, ...action.patch } : t);
    case 'REMOVE': return state.filter(t => t.id !== action.id);
    default:       return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ToastContextValue {
  toasts:     ToastItem[];
  pending:    (message: string) => string;
  success:    (id: string, message: string, txHash?: `0x${string}`) => void;
  error:      (id: string, message: string) => void;
  successNew: (message: string, txHash?: `0x${string}`) => string;
  errorNew:   (message: string) => string;
  info:       (message: string) => string;
  dismiss:    (id: string) => void;
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
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
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

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  return (
    <ToastContext.Provider
      value={{ toasts, pending, success, error, successNew, errorNew, info, dismiss }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>');
  return ctx;
}

// ─── Visual tokens — Solarpunk palette ────────────────────────────────────────

const TOKENS: Record<ToastType, {
  bg: string; border: string; icon: string; iconColor: string; label: string;
}> = {
  pending: {
    bg:        'hsl(135 28% 8% / 0.92)',
    border:    'hsl(135 40% 40% / 0.35)',
    icon:      '⟳',
    iconColor: 'var(--green)',
    label:     'working',
  },
  success: {
    bg:        'hsl(135 30% 7% / 0.92)',
    border:    'hsl(135 56% 54% / 0.40)',
    icon:      '✓',
    iconColor: 'var(--green)',
    label:     'done',
  },
  error: {
    bg:        'hsl(20 30% 8% / 0.92)',
    border:    'hsl(20 58% 52% / 0.40)',
    icon:      '✕',
    iconColor: 'var(--terra)',
    label:     'error',
  },
  info: {
    bg:        'hsl(168 28% 8% / 0.92)',
    border:    'hsl(168 50% 44% / 0.40)',
    icon:      'ℹ',
    iconColor: 'var(--teal)',
    label:     'info',
  },
};

// ─── Toast container ──────────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts:    ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      style={{
        position:      'fixed',
        bottom:        24,
        right:         24,
        zIndex:        9999,
        display:       'flex',
        flexDirection: 'column',
        gap:           8,
        maxWidth:      380,
        width:         '100%',
      }}
    >
      {toasts.map(toast => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ─── Single toast card ────────────────────────────────────────────────────────

function ToastCard({
  toast,
  onDismiss,
}: {
  toast:     ToastItem;
  onDismiss: (id: string) => void;
}) {
  const tokens      = TOKENS[toast.type];
  const explorerUrl = toast.txHash ? getExplorerUrl('tx', toast.txHash) : null;

  return (
    <div
      role="alert"
      style={{
        background:         tokens.bg,
        backdropFilter:     'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        border:             `1px solid ${tokens.border}`,
        borderRadius:       'var(--r-lg)',
        padding:            '12px 14px',
        display:            'flex',
        alignItems:         'flex-start',
        gap:                10,
        boxShadow:          '0 8px 32px rgba(0,0,0,0.5)',
        animation:          'slideIn 0.22s var(--ease-spring)',
      }}
    >
      {/* ── Icon ── */}
      <span
        aria-hidden="true"
        style={{
          color:       tokens.iconColor,
          fontSize:    16,
          lineHeight:  1,
          marginTop:   2,
          flexShrink:  0,
          display:     'inline-block',
          animation:   toast.type === 'pending' ? 'spin 1.1s linear infinite' : undefined,
          fontFamily:  'var(--font-sans)',
        }}
      >
        {tokens.icon}
      </span>

      {/* ── Body ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Label */}
        <div
          style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      9,
            fontWeight:    700,
            color:         tokens.iconColor,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            marginBottom:  3,
            opacity:       0.75,
          }}
        >
          {tokens.label}
        </div>

        {/* Message */}
        <div
          style={{
            color:      'var(--text)',
            fontSize:   13,
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.45,
          }}
        >
          {toast.message}
        </div>

        {/* Explorer link */}
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:    'inline-flex',
              alignItems: 'center',
              gap:        4,
              color:      tokens.iconColor,
              fontSize:   11,
              fontFamily: 'var(--font-mono)',
              marginTop:  5,
              opacity:    0.8,
            }}
          >
            view on explorer →
          </a>
        )}
      </div>

      {/* ── Dismiss ── */}
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        style={{
          background:  'none',
          border:      'none',
          color:       'var(--text-muted)',
          cursor:      'pointer',
          padding:     '0 2px',
          fontSize:    16,
          lineHeight:  1,
          flexShrink:  0,
          transition:  'color 0.15s',
          fontFamily:  'var(--font-sans)',
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
      >
        ×
      </button>
    </div>
  );
}
