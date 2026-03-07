"use client";

import { use } from "react";
import Link from "next/link";
import { useArtworkInfo, useTradeHistory, useShareBalance } from "@/lib/hooks";
import TradePanel from "@/components/TradePanel";
import PriceChart from "@/components/PriceChart";
import { formatEth, ipfsToHttp } from "@/lib/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";

interface Props {
  params: Promise<{ address: string }>;
}

export default function ArtworkPage({ params }: Props) {
  const { address } = use(params);
  const artworkAddress = address as `0x${string}`;
  const { address: userAddress } = useAccount();
  const queryClient = useQueryClient();

  const { data: artwork, isLoading } = useArtworkInfo(artworkAddress);
  const { data: events = [] } = useTradeHistory(artworkAddress);
  const { data: balance } = useShareBalance(artworkAddress);

  const handleTradeSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["artworkInfo", artworkAddress] });
    queryClient.invalidateQueries({ queryKey: ["tradeHistory", artworkAddress] });
    queryClient.invalidateQueries({ queryKey: ["allArtworks"] });
  };

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-3 gap-6 animate-pulse">
        <div className="md:col-span-2 space-y-4">
          <div className="aspect-square bg-[#111] rounded-lg max-w-sm" />
          <div className="h-32 bg-[#111] rounded-lg" />
        </div>
        <div className="h-64 bg-[#111] rounded-lg" />
      </div>
    );
  }

  if (!artwork) {
    return (
      <div className="text-center py-20 font-mono">
        <p className="text-[#00ff88] text-xl mb-3">404</p>
        <p className="text-white mb-2">artwork not found</p>
        <Link href="/explore" className="text-[#555] hover:text-[#00ff88] text-sm transition-colors">
          [← back to explore]
        </Link>
      </div>
    );
  }

  const GRAD_THRESHOLD = BigInt("24000000000000000000");
  const progressPct = Math.min(Number((artwork.reserve * 100n) / GRAD_THRESHOLD), 100);
  const shortArtist = `${artwork.artist.slice(0, 8)}...${artwork.artist.slice(-6)}`;

  return (
    <div className="space-y-5 font-mono">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[#444]">
        <Link href="/" className="hover:text-[#00ff88] transition-colors">[home]</Link>
        <span>/</span>
        <Link href="/explore" className="hover:text-[#00ff88] transition-colors">[explore]</Link>
        <span>/</span>
        <span className="text-[#888] truncate max-w-40">{artwork.name}</span>
        {artwork.graduated && (
          <span className="ml-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-[10px] px-2 py-0.5 rounded">
            🎓 graduated
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: image + info */}
        <div className="md:col-span-2 space-y-4">
          {/* Image + title row — pump.fun style */}
          <div className="flex gap-4">
            <img
              src={ipfsToHttp(artwork.ipfsCID)}
              alt={artwork.name}
              className="w-32 h-32 rounded-lg object-cover border border-[#1e1e1e] flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  `https://picsum.photos/seed/${artwork.address}/256/256`;
              }}
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-white font-black text-xl mb-1 truncate">{artwork.name}</h1>
              <p className="text-[#555] text-xs mb-3">
                created by{" "}
                <Link
                  href={`/profile/${artwork.artist}`}
                  className="text-[#00ff88] hover:underline"
                >
                  {shortArtist}
                </Link>
              </p>

              {/* Key stats inline */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "price", value: `${formatEth(artwork.price, 6)} ETH`, green: true },
                  { label: "market cap", value: `${formatEth(artwork.marketCap, 4)} ETH`, green: false },
                  { label: "volume", value: `${formatEth(artwork.totalVolume, 4)} ETH`, green: false },
                  { label: "shares minted", value: artwork.supply.toString(), green: false },
                ].map((s) => (
                  <div key={s.label} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-2">
                    <p className="text-[#444] text-[10px]">{s.label}</p>
                    <p className={`font-bold text-xs ${s.green ? "text-[#00ff88]" : "text-white"}`}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bonding curve progress */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-[#555]">bonding curve progress ({formatEth(artwork.reserve, 4)} / 24 ETH)</span>
              <span className="text-[#00ff88]">{progressPct.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-[#1a1a1a] rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full progress-bar transition-all"
                style={{ width: `${Math.max(progressPct, 1)}%` }}
              />
            </div>
            <p className="text-[#333] text-[10px] mt-2">
              when reserve reaches 24 ETH, artwork graduates 🎓
            </p>
          </div>

          {/* Price chart */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4">
            <p className="text-[#555] text-xs mb-3">price history</p>
            <PriceChart events={events} k={artwork.k} p0={artwork.p0} />
          </div>

          {/* Trade history */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4">
            <p className="text-[#555] text-xs mb-3">trade history ({events.length})</p>
            {events.length === 0 ? (
              <p className="text-[#333] text-xs text-center py-4">no trades yet — be the first!</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {[...events].reverse().slice(0, 20).map((event, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-[#1a1a1a]">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${event.type === "buy" ? "text-[#00ff88]" : "text-red-400"}`}>
                        {event.type.toUpperCase()}
                      </span>
                      <span className="text-[#555]">
                        {`${event.address.slice(0, 6)}...${event.address.slice(-4)}`}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-white">{event.shares.toString()} shares</span>
                      <span className="text-[#444] ml-2">{formatEth(event.ethAmount, 5)} ETH</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contract info */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 text-[11px] space-y-2">
            <p className="text-[#555] mb-2">contract info</p>
            <div className="flex justify-between">
              <span className="text-[#444]">contract address</span>
              <a
                href={`https://sepolia.etherscan.io/address/${artworkAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00ff88] hover:underline"
              >
                {artworkAddress.slice(0, 10)}...{artworkAddress.slice(-8)} ↗
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-[#444]">artist royalties earned</span>
              <span className="text-yellow-400">{formatEth(artwork.totalRoyalties, 5)} ETH</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#444]">reserve</span>
              <span className="text-white">{formatEth(artwork.reserve, 5)} ETH</span>
            </div>
          </div>
        </div>

        {/* Right: trade panel (sticky) */}
        <div className="md:col-span-1">
          <div className="sticky top-20 space-y-3">
            <TradePanel artwork={artwork} onTradeSuccess={handleTradeSuccess} />

            {/* Your position */}
            {typeof balance === "bigint" && balance > 0n && (
              <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-lg p-3 text-xs">
                <p className="text-[#00ff88] mb-1">your position</p>
                <p className="text-white font-bold">{(balance as bigint).toString()} shares</p>
                <p className="text-[#555] mt-0.5">
                  value ~{formatEth(artwork.price * (balance as bigint), 5)} ETH
                </p>
              </div>
            )}

            {/* Fee info */}
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3 text-[11px] space-y-1.5">
              <p className="text-[#555] mb-2">fee structure</p>
              <div className="flex justify-between text-[#444]">
                <span>artist royalty (buy + sell)</span>
                <span className="text-yellow-400">5%</span>
              </div>
              <div className="flex justify-between text-[#444]">
                <span>platform fee</span>
                <span>1%</span>
              </div>
              <div className="flex justify-between text-[#444] pt-1 border-t border-[#1a1a1a]">
                <span>total artist earned</span>
                <span className="text-white">{formatEth(artwork.totalRoyalties, 5)} ETH</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
