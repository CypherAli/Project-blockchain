'use client';

import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useBuyShares, useSellShares, useQuoteBuy, useQuoteSell, useShareBalance } from '@/lib/hooks';
import { useToast } from '@/components/ui/Toast';
import { formatEth } from '@/lib/contracts';
import type { ArtworkInfo } from '@/lib/contracts';

interface TradePanelProps {
  artwork:         ArtworkInfo;
  onTradeSuccess?: () => void;
}

// Quick share amounts
const QUICK_AMOUNTS = [1, 5, 10, 100];
// Quick ETH amounts for buy
const QUICK_ETH = [
  { label: '0.01 Ξ', wei: 10_000_000_000_000_000n },
  { label: '0.05 Ξ', wei: 50_000_000_000_000_000n },
  { label: '0.1 Ξ',  wei: 100_000_000_000_000_000n },
  { label: '0.5 Ξ',  wei: 500_000_000_000_000_000n },
];

/** Estimate shares you can buy with `ethWei` given current price and k */
function estimateSharesFromEth(ethWei: bigint, price: bigint, k: bigint): bigint {
  if (price === 0n) return 0n;
  // Approximate: shares ≈ ethWei / price (ignores curve steepness & fees for quick estimate)
  // Use gross estimate then round down
  const gross = ethWei * 10n / 16n; // ~94% after 6% fees
  const est = gross / price;
  return est > 0n ? est : 1n;
}

function QuoteLine({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', marginBottom: 4,
      fontFamily: 'var(--font-mono)', fontSize: highlight ? 12 : 11,
      fontWeight: highlight ? 700 : 400, color: highlight ? 'var(--text)' : 'var(--text-muted)',
    }}>
      <span>{label}</span>
      <span style={{ color: highlight ? 'var(--green)' : 'var(--text-dim)' }}>{value}</span>
    </div>
  );
}

export default function TradePanel({ artwork, onTradeSuccess }: TradePanelProps) {
  const [tab, setTab]            = useState<'buy' | 'sell'>('buy');
  const [amountStr, setAmount]   = useState('');
  const [inputMode, setInputMode] = useState<'shares' | 'eth'>('shares');
  const { address, isConnected } = useAccount();
  const toast                    = useToast();

  // In ETH mode, estimate shares from ETH input
  const ethInputWei = inputMode === 'eth' && amountStr && parseFloat(amountStr) > 0
    ? BigInt(Math.floor(parseFloat(amountStr) * 1e18))
    : undefined;
  const amountFromEth = ethInputWei ? estimateSharesFromEth(ethInputWei, artwork.price, artwork.k) : undefined;
  const amount = inputMode === 'eth'
    ? amountFromEth
    : (amountStr && parseInt(amountStr) > 0 ? BigInt(parseInt(amountStr)) : undefined);

  const { data: buyQuote }  = useQuoteBuy(artwork.address, amount);
  const { data: sellQuote } = useQuoteSell(artwork.address, amount);
  const { data: balance }   = useShareBalance(artwork.address);
  const userBalance         = typeof balance === 'bigint' ? balance : 0n;

  const { buy,  isPending: buyPending,  isConfirming: buyConfirming  } = useBuyShares(artwork.address);
  const { sell, isPending: sellPending, isConfirming: sellConfirming } = useSellShares(artwork.address);
  const isLoading = buyPending || buyConfirming || sellPending || sellConfirming;

  useEffect(() => { setAmount(''); setInputMode('shares'); }, [tab]);

  const hasInsufficientShares = tab === 'sell' && amount !== undefined && userBalance < amount;

  const handleBuy = async () => {
    if (!amount || !buyQuote) return;
    const [totalCost] = buyQuote as [bigint, bigint, bigint, bigint];
    const id = toast.pending(`Buying ${amount} share${amount > 1n ? 's' : ''}...`);
    try {
      const txHash = await buy(amount, totalCost);
      if (txHash) {
        toast.success(id, `Bought ${amount} share${amount > 1n ? 's' : ''} of ${artwork.name}`, txHash);
        setAmount('');
        onTradeSuccess?.();
      }
    } catch (err) { toast.error(id, parseContractError(err)); }
  };

  const handleSell = async () => {
    if (!amount || !sellQuote) return;
    const [netReturn] = sellQuote as [bigint, bigint, bigint, bigint];
    const id = toast.pending(`Selling ${amount} share${amount > 1n ? 's' : ''}...`);
    try {
      const txHash = await sell(amount, netReturn);
      if (txHash) {
        toast.success(id, `Sold ${amount} share${amount > 1n ? 's' : ''} of ${artwork.name}`, txHash);
        setAmount('');
        onTradeSuccess?.();
      }
    } catch (err) { toast.error(id, parseContractError(err)); }
  };

  const buyBreakdown  = buyQuote  ? {
    totalCost: (buyQuote as bigint[])[0], curveCost: (buyQuote as bigint[])[1],
    royalty: (buyQuote as bigint[])[2], platformFee: (buyQuote as bigint[])[3],
  } : null;
  const sellBreakdown = sellQuote ? {
    netReturn: (sellQuote as bigint[])[0], grossReturn: (sellQuote as bigint[])[1],
    royalty: (sellQuote as bigint[])[2], platformFee: (sellQuote as bigint[])[3],
  } : null;

  const BUY_COLOR  = 'var(--green)';
  const SELL_COLOR = 'var(--terra)';

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {(['buy', 'sell'] as const).map((t) => {
          const active = tab === t;
          const col    = t === 'buy' ? BUY_COLOR : SELL_COLOR;
          const bg     = t === 'buy' ? 'hsl(135 56% 54% / 0.18)' : 'hsl(20 58% 52% / 0.18)';
          return (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '9px 0', background: active ? bg : 'transparent', color: active ? col : 'var(--text-muted)', border: `1px solid ${active ? col : 'var(--border)'}`, borderRadius: 'var(--r-md)', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => !active && ((e.currentTarget as HTMLElement).style.color = col)}
              onMouseLeave={e => !active && ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
            >[{t}]</button>
          );
        })}
      </div>

      {/* Amount */}
      <div>
        {/* Mode toggle (buy only) */}
        {tab === 'buy' && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {(['shares', 'eth'] as const).map(m => (
              <button key={m} onClick={() => { setInputMode(m); setAmount(''); }}
                style={{ flex: 1, padding: '4px 0', background: inputMode === m ? 'var(--surface-3)' : 'transparent', border: `1px solid ${inputMode === m ? 'var(--border-focus)' : 'var(--border)'}`, borderRadius: 'var(--r-sm)', color: inputMode === m ? 'var(--text)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer', transition: 'all 0.15s' }}>
                {m === 'shares' ? 'by shares' : 'by ETH'}
              </button>
            ))}
          </div>
        )}

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
          {tab === 'sell' ? 'shares to sell' : inputMode === 'eth' ? 'ETH amount to spend' : 'shares to buy'}
        </div>
        <input type="number" value={amountStr} onChange={(e) => setAmount(e.target.value)}
          placeholder={inputMode === 'eth' ? '0.00' : '0'} min={inputMode === 'eth' ? '0.001' : '1'} step={inputMode === 'eth' ? '0.01' : '1'}
          style={{ width: '100%', background: 'var(--surface-2)', border: `1px solid ${hasInsufficientShares ? 'var(--terra)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', padding: '10px 12px', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 16, outline: 'none', boxSizing: 'border-box' as const }}
          onFocus={e => (e.currentTarget.style.borderColor = hasInsufficientShares ? 'var(--terra)' : 'var(--border-focus)')}
          onBlur={e  => (e.currentTarget.style.borderColor = hasInsufficientShares ? 'var(--terra)' : 'var(--border)')}
        />
        {hasInsufficientShares && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--terra)', marginTop: 4 }}>
            insufficient shares (balance: {userBalance.toString()})
          </div>
        )}

        {/* Quick presets */}
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          {tab === 'buy' && inputMode === 'eth' ? (
            <>
              {QUICK_ETH.map((q) => (
                <button key={q.label} onClick={() => setAmount(String(Number(q.wei) / 1e18))}
                  style={{ flex: 1, padding: '4px 0', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer' }}>
                  {q.label}
                </button>
              ))}
            </>
          ) : (
            <>
              {QUICK_AMOUNTS.map((n) => (
                <button key={n} onClick={() => setAmount(String(n))}
                  style={{ flex: 1, padding: '4px 0', background: amountStr === String(n) ? 'var(--surface-3)' : 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: amountStr === String(n) ? 'var(--text)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>
                  {n}
                </button>
              ))}
              {tab === 'sell' && userBalance > 0n && (
                <button onClick={() => setAmount(userBalance.toString())}
                  style={{ flex: 1, padding: '4px 0', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--terra)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>
                  max
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quote */}
      {amount && amount > 0n && (
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
          {tab === 'buy' && buyBreakdown ? (
            <>
              <QuoteLine label="curve cost"          value={`${formatEth(buyBreakdown.curveCost)} ETH`} />
              <QuoteLine label="artist royalty (5%)" value={`${formatEth(buyBreakdown.royalty)} ETH`} />
              <QuoteLine label="platform fee (1%)"   value={`${formatEth(buyBreakdown.platformFee)} ETH`} />
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
                <QuoteLine label="you pay" value={`${formatEth(buyBreakdown.totalCost)} ETH`} highlight />
              </div>
            </>
          ) : tab === 'sell' && sellBreakdown ? (
            <>
              <QuoteLine label="curve return"        value={`${formatEth(sellBreakdown.grossReturn)} ETH`} />
              <QuoteLine label="artist royalty (5%)" value={`-${formatEth(sellBreakdown.royalty)} ETH`} />
              <QuoteLine label="platform fee (1%)"   value={`-${formatEth(sellBreakdown.platformFee)} ETH`} />
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
                <QuoteLine label="you receive" value={`${formatEth(sellBreakdown.netReturn)} ETH`} highlight />
              </div>
            </>
          ) : (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>calculating...</div>
          )}
        </div>
      )}

      {/* Action */}
      {!isConnected ? (
        <ConnectButton />
      ) : (
        <button
          onClick={tab === 'buy' ? handleBuy : handleSell}
          disabled={!amount || amount <= 0n || isLoading || hasInsufficientShares}
          style={{ width: '100%', padding: '13px 0', background: isLoading ? 'var(--surface-3)' : (tab === 'buy' ? BUY_COLOR : SELL_COLOR), color: isLoading ? 'var(--text-muted)' : 'hsl(135 28% 8%)', border: 'none', borderRadius: 'var(--r-md)', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, cursor: isLoading ? 'wait' : ((!amount || hasInsufficientShares) ? 'not-allowed' : 'pointer'), opacity: (!amount || hasInsufficientShares) && !isLoading ? 0.38 : 1, transition: 'opacity 0.15s' }}
        >
          {isLoading ? '[ confirming... ]' : (amount && amount > 0n) ? `[${tab} ${amount} share${amount > 1n ? 's' : ''}]` : '[enter amount]'}
        </button>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
        <span>price <span style={{ color: 'var(--green)', fontWeight: 700 }}>{formatEth(artwork.price)} ETH</span></span>
        {address && <span>balance: {userBalance.toString()} shares</span>}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: -8 }}>
        5% artist royalty + 1% platform fee on every trade
      </div>
    </div>
  );
}

function parseContractError(err: unknown): string {
  if (!(err instanceof Error)) return 'Transaction failed';
  const msg = err.message;
  if (msg.includes('User rejected'))             return 'Transaction cancelled';
  if (msg.includes('slippage price moved up'))   return 'Price moved — try again';
  if (msg.includes('slippage price moved down')) return 'Price moved — try again';
  if (msg.includes('insufficient ETH'))          return 'Not enough ETH';
  if (msg.includes('insufficient shares'))       return 'Not enough shares';
  if (msg.includes('exceeds max supply'))        return 'Would exceed max supply';
  const m = msg.match(/reverted with reason string '(.+)'/);
  if (m) return m[1];
  return 'Transaction failed';
}
