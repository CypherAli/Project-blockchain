'use client';

/**
 * TradePanel — Buy/Sell UI for a single artwork
 *
 * Features:
 * - Tab switcher: [buy] / [sell]
 * - Amount input with quick-select buttons
 * - Live quote with breakdown (curve cost + royalty + platform fee)
 * - Toast notifications: pending → success/error with explorer link
 * - 1% slippage tolerance automatically applied
 */

import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useBuyShares, useSellShares, useQuoteBuy, useQuoteSell, useShareBalance } from '@/lib/hooks';
import { useToast } from '@/components/ui/Toast';
import { formatEth } from '@/lib/contracts';
import type { ArtworkInfo } from '@/lib/contracts';

interface TradePanelProps {
  artwork: ArtworkInfo;
}

const QUICK_AMOUNTS = [1, 5, 10, 100];

export default function TradePanel({ artwork }: TradePanelProps) {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [amountStr, setAmountStr] = useState('');
  const { address, isConnected } = useAccount();
  const toast = useToast();

  const amount = amountStr && parseInt(amountStr) > 0 ? BigInt(parseInt(amountStr)) : undefined;

  // Quotes
  const { data: buyQuote } = useQuoteBuy(artwork.address, amount);
  const { data: sellQuote } = useQuoteSell(artwork.address, amount);

  // Balance
  const { data: balance } = useShareBalance(artwork.address);
  const userBalance = typeof balance === 'bigint' ? balance : 0n;

  // Write hooks
  const { buy, isPending: buyPending, isConfirming: buyConfirming } = useBuyShares(artwork.address);
  const { sell, isPending: sellPending, isConfirming: sellConfirming } = useSellShares(artwork.address);

  const isLoading = buyPending || buyConfirming || sellPending || sellConfirming;

  useEffect(() => { setAmountStr(''); }, [tab]);

  const hasInsufficientShares = tab === 'sell' && amount !== undefined && userBalance < amount;

  // ── Buy handler ─────────────────────────────────────────────────────────────

  const handleBuy = async () => {
    if (!amount || !buyQuote) return;
    const [totalCost] = buyQuote as [bigint, bigint, bigint, bigint];
    const id = toast.pending(`Buying ${amount} share${amount > 1n ? 's' : ''}...`);
    try {
      const txHash = await buy(amount, totalCost);
      if (txHash) {
        toast.success(id, `Bought ${amount} share${amount > 1n ? 's' : ''} of ${artwork.name}`, txHash);
        setAmountStr('');
      }
    } catch (err) {
      toast.error(id, parseContractError(err));
    }
  };

  // ── Sell handler ────────────────────────────────────────────────────────────

  const handleSell = async () => {
    if (!amount || !sellQuote) return;
    const [netReturn] = sellQuote as [bigint, bigint, bigint, bigint];
    const id = toast.pending(`Selling ${amount} share${amount > 1n ? 's' : ''}...`);
    try {
      const txHash = await sell(amount, netReturn);
      if (txHash) {
        toast.success(id, `Sold ${amount} share${amount > 1n ? 's' : ''} of ${artwork.name}`, txHash);
        setAmountStr('');
      }
    } catch (err) {
      toast.error(id, parseContractError(err));
    }
  };

  // ── Quote breakdown ──────────────────────────────────────────────────────────

  const buyBreakdown = buyQuote
    ? { totalCost: (buyQuote as bigint[])[0], curveCost: (buyQuote as bigint[])[1], royalty: (buyQuote as bigint[])[2], platformFee: (buyQuote as bigint[])[3] }
    : null;

  const sellBreakdown = sellQuote
    ? { netReturn: (sellQuote as bigint[])[0], grossReturn: (sellQuote as bigint[])[1], royalty: (sellQuote as bigint[])[2], platformFee: (sellQuote as bigint[])[3] }
    : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'monospace' }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4 }}>
        {(['buy', 'sell'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '8px 0',
              background: tab === t ? (t === 'buy' ? 'var(--green)' : 'var(--red)') : 'transparent',
              color: tab === t ? '#000' : '#555',
              border: `1px solid ${tab === t ? (t === 'buy' ? 'var(--green)' : 'var(--red)') : 'var(--border)'}`,
              borderRadius: 4, fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', cursor: 'pointer',
            }}
          >
            [{t}]
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div>
        <div style={{ color: '#555', fontSize: 11, marginBottom: 6 }}>shares to {tab}</div>
        <input
          type="number"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          placeholder="0"
          min="1"
          step="1"
          style={{
            width: '100%', background: '#0a0a0a',
            border: `1px solid ${hasInsufficientShares ? 'var(--red)' : 'var(--border)'}`,
            borderRadius: 4, padding: '10px 12px',
            color: 'var(--foreground)', fontFamily: 'monospace', fontSize: 16, outline: 'none',
          }}
        />
        {hasInsufficientShares && (
          <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 4 }}>
            insufficient shares (balance: {userBalance.toString()})
          </div>
        )}

        {/* Quick amounts */}
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {QUICK_AMOUNTS.map((n) => (
            <button
              key={n}
              onClick={() => setAmountStr(String(n))}
              style={{
                flex: 1, padding: '4px 0',
                background: amountStr === String(n) ? '#1e1e1e' : 'transparent',
                border: '1px solid var(--border)', color: '#666',
                fontFamily: 'monospace', fontSize: 11, borderRadius: 3, cursor: 'pointer',
              }}
            >
              {n}
            </button>
          ))}
          {tab === 'sell' && userBalance > 0n && (
            <button
              onClick={() => setAmountStr(userBalance.toString())}
              style={{
                flex: 1, padding: '4px 0',
                background: 'transparent', border: '1px solid var(--border)',
                color: '#666', fontFamily: 'monospace', fontSize: 11, borderRadius: 3, cursor: 'pointer',
              }}
            >
              max
            </button>
          )}
        </div>
      </div>

      {/* Quote breakdown */}
      {amount && amount > 0n && (
        <div style={{ background: '#0d0d0d', border: '1px solid var(--border)', borderRadius: 4, padding: 12, fontSize: 12 }}>
          {tab === 'buy' && buyBreakdown ? (
            <>
              <QuoteLine label="curve cost" value={`${formatEth(buyBreakdown.curveCost)} ETH`} />
              <QuoteLine label="artist royalty (5%)" value={`${formatEth(buyBreakdown.royalty)} ETH`} />
              <QuoteLine label="platform fee (1%)" value={`${formatEth(buyBreakdown.platformFee)} ETH`} />
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
                <QuoteLine label="you pay" value={`${formatEth(buyBreakdown.totalCost)} ETH`} highlight />
              </div>
            </>
          ) : tab === 'sell' && sellBreakdown ? (
            <>
              <QuoteLine label="curve return" value={`${formatEth(sellBreakdown.grossReturn)} ETH`} />
              <QuoteLine label="artist royalty (5%)" value={`-${formatEth(sellBreakdown.royalty)} ETH`} />
              <QuoteLine label="platform fee (1%)" value={`-${formatEth(sellBreakdown.platformFee)} ETH`} />
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
                <QuoteLine label="you receive" value={`${formatEth(sellBreakdown.netReturn)} ETH`} highlight />
              </div>
            </>
          ) : (
            <div style={{ color: '#555', textAlign: 'center' }}>calculating...</div>
          )}
        </div>
      )}

      {/* Action button */}
      {!isConnected ? (
        <ConnectButton />
      ) : (
        <button
          onClick={tab === 'buy' ? handleBuy : handleSell}
          disabled={!amount || amount <= 0n || isLoading || hasInsufficientShares}
          style={{
            width: '100%', padding: '12px 0',
            background: isLoading ? '#1e1e1e' : tab === 'buy' ? 'var(--green)' : 'var(--red)',
            color: isLoading ? '#555' : '#000',
            border: 'none', borderRadius: 4,
            fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold',
            cursor: isLoading ? 'wait' : 'pointer',
            opacity: (!amount || hasInsufficientShares) && !isLoading ? 0.4 : 1,
          }}
        >
          {isLoading
            ? '[ confirming... ]'
            : amount && amount > 0n
            ? `[${tab} ${amount} share${amount > 1n ? 's' : ''}]`
            : '[enter amount]'
          }
        </button>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#555' }}>
        <span>price: <span style={{ color: 'var(--green)' }}>{formatEth(artwork.price)} ETH</span></span>
        {address && <span>balance: {userBalance.toString()} shares</span>}
      </div>
      <div style={{ fontSize: 10, color: '#444', lineHeight: 1.6 }}>
        5% artist royalty + 1% platform fee on every trade
      </div>
    </div>
  );
}

function QuoteLine({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: highlight ? 'var(--foreground)' : '#666', fontWeight: highlight ? 'bold' : 'normal' }}>
      <span>{label}</span>
      <span style={{ color: highlight ? 'var(--green)' : '#555' }}>{value}</span>
    </div>
  );
}

function parseContractError(err: unknown): string {
  if (!(err instanceof Error)) return 'Transaction failed';
  const msg = err.message;
  if (msg.includes('User rejected')) return 'Transaction cancelled';
  if (msg.includes('slippage price moved up')) return 'Price moved — try again';
  if (msg.includes('slippage price moved down')) return 'Price moved — try again';
  if (msg.includes('insufficient ETH')) return 'Not enough ETH';
  if (msg.includes('insufficient shares')) return 'Not enough shares';
  if (msg.includes('exceeds max supply')) return 'Would exceed max supply';
  const m = msg.match(/reverted with reason string '(.+)'/);
  if (m) return m[1];
  return 'Transaction failed';
}
