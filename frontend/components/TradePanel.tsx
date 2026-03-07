"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  ArtworkInfo,
  formatEth,
  addFees,
  deductFees,
  calcBuyCost,
  calcSellReturn,
} from "@/lib/contracts";
import { useBuyShares, useSellShares, useShareBalance } from "@/lib/hooks";

interface Props {
  artwork: ArtworkInfo;
  onTradeSuccess?: () => void;
}

export default function TradePanel({ artwork, onTradeSuccess }: Props) {
  const { isConnected } = useAccount();
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState<string>("1");

  const amountBig = (() => {
    try {
      const n = parseInt(amount);
      return n > 0 ? BigInt(n) : 0n;
    } catch {
      return 0n;
    }
  })();

  const { data: balance } = useShareBalance(artwork.address);
  const { buy, isPending: isBuying, isConfirming: isBuyConfirming, isSuccess: buySuccess } = useBuyShares(artwork.address);
  const { sell, isPending: isSelling, isConfirming: isSellConfirming, isSuccess: sellSuccess } = useSellShares(artwork.address);

  const buyGross = amountBig > 0n ? calcBuyCost(artwork.k, artwork.p0, artwork.supply, amountBig) : 0n;
  const { totalCost, royalty: buyRoyalty, platformFee: buyFee } = addFees(buyGross);

  const sellGross = amountBig > 0n ? calcSellReturn(artwork.k, artwork.p0, artwork.supply, amountBig) : 0n;
  const { netReturn, royalty: sellRoyalty, platformFee: sellFee } = deductFees(sellGross);

  useEffect(() => {
    if (buySuccess || sellSuccess) {
      setAmount("1");
      onTradeSuccess?.();
    }
  }, [buySuccess, sellSuccess]);

  const isBusy = isBuying || isBuyConfirming || isSelling || isSellConfirming;

  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 font-mono">
      {/* Tab switcher — pump.fun style */}
      <div className="flex gap-0 mb-4 border border-[#1e1e1e] rounded overflow-hidden">
        {(["buy", "sell"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setAmount("1"); }}
            className={`flex-1 py-2 text-xs font-bold transition-all ${
              tab === t
                ? t === "buy"
                  ? "bg-[#00ff88] text-black"
                  : "bg-red-500 text-white"
                : "text-[#444] hover:text-[#888] bg-transparent"
            }`}
          >
            [{t}]
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[#555] text-[11px]">
            {tab === "buy" ? "shares to buy" : "shares to sell"}
          </span>
          {tab === "sell" && typeof balance === "bigint" && (
            <span className="text-[#00ff88] text-[11px]">
              you own: {(balance as bigint).toString()}
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00ff88]/50 transition-colors"
            placeholder="1"
          />
          {[1, 5, 10, 100].map((n) => (
            <button
              key={n}
              onClick={() => setAmount(String(n))}
              className="px-2 py-1.5 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] rounded text-[11px] text-[#555] hover:text-white transition-colors"
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Quote breakdown — pump.fun compact style */}
      {amountBig > 0n && (
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-3 mb-3 text-[11px] space-y-1.5">
          {tab === "buy" ? (
            <>
              <div className="flex justify-between text-[#555]">
                <span>curve cost ({amountBig.toString()} shares)</span>
                <span>{formatEth(buyGross, 6)} ETH</span>
              </div>
              <div className="flex justify-between text-yellow-500/80">
                <span>artist royalty (5%)</span>
                <span>+{formatEth(buyRoyalty, 6)} ETH</span>
              </div>
              <div className="flex justify-between text-[#333]">
                <span>platform (1%)</span>
                <span>+{formatEth(buyFee, 6)} ETH</span>
              </div>
              <div className="border-t border-[#1e1e1e] pt-1.5 flex justify-between font-bold">
                <span className="text-[#888]">total</span>
                <span className="text-[#00ff88]">{formatEth(totalCost, 6)} ETH</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between text-[#555]">
                <span>gross return ({amountBig.toString()} shares)</span>
                <span>{formatEth(sellGross, 6)} ETH</span>
              </div>
              <div className="flex justify-between text-yellow-500/80">
                <span>artist royalty (5%)</span>
                <span>-{formatEth(sellRoyalty, 6)} ETH</span>
              </div>
              <div className="flex justify-between text-[#333]">
                <span>platform (1%)</span>
                <span>-{formatEth(sellFee, 6)} ETH</span>
              </div>
              <div className="border-t border-[#1e1e1e] pt-1.5 flex justify-between font-bold">
                <span className="text-[#888]">you receive</span>
                <span className="text-red-400">{formatEth(netReturn, 6)} ETH</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Action button */}
      {!isConnected ? (
        <ConnectButton.Custom>
          {({ openConnectModal }) => (
            <button
              onClick={openConnectModal}
              className="w-full py-2.5 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-[#888] text-xs rounded transition-all"
            >
              [connect wallet to trade]
            </button>
          )}
        </ConnectButton.Custom>
      ) : (
        <button
          onClick={tab === "buy" ? () => buy(amountBig, totalCost) : () => sell(amountBig, sellGross)}
          disabled={isBusy || amountBig <= 0n}
          className={`w-full py-2.5 rounded text-xs font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            tab === "buy"
              ? "bg-[#00ff88] hover:bg-[#00cc6a] text-black"
              : "bg-red-500 hover:bg-red-400 text-white"
          }`}
        >
          {isBusy
            ? isBuyConfirming || isSellConfirming
              ? "[confirming on-chain...]"
              : "[waiting for signature...]"
            : tab === "buy"
            ? `[buy ${amountBig > 0n ? amountBig.toString() : ""} shares]`
            : `[sell ${amountBig > 0n ? amountBig.toString() : ""} shares]`}
        </button>
      )}

      {(buySuccess || sellSuccess) && (
        <div className="mt-2 p-2 bg-[#00ff88]/10 border border-[#00ff88]/20 rounded text-[#00ff88] text-[11px] text-center">
          ✓ transaction confirmed
        </div>
      )}

      {/* Stats footer */}
      <div className="mt-3 pt-3 border-t border-[#1a1a1a] grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <p className="text-[#444]">current price</p>
          <p className="text-[#00ff88] font-bold">{formatEth(artwork.price, 6)} ETH</p>
        </div>
        <div>
          <p className="text-[#444]">your balance</p>
          <p className="text-white">
            {typeof balance === "bigint" ? `${(balance as bigint).toString()} shares` : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
