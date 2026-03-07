"use client";

import Link from "next/link";
import { ArtworkInfo, formatEth, ipfsToHttp } from "@/lib/contracts";

interface Props {
  artwork: ArtworkInfo;
  rank?: number;
}

export default function ArtworkCard({ artwork, rank }: Props) {
  const GRAD_THRESHOLD = BigInt("24000000000000000000");
  const progressPct = Math.min(
    Number((artwork.reserve * 10000n) / GRAD_THRESHOLD) / 100,
    100
  );
  const shortArtist = artwork.artist
    ? `${artwork.artist.slice(0, 6)}...${artwork.artist.slice(-4)}`
    : "Unknown";

  const timeAgo = (ts: bigint) => {
    const secs = Math.floor(Date.now() / 1000) - Number(ts);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  };

  return (
    <Link href={`/artwork/${artwork.address}`}>
      {/* Pump.fun style: horizontal card */}
      <div className="group flex gap-3 p-3 bg-[#111] border border-[#1e1e1e] hover:border-[#00ff88]/30 hover:bg-[#141414] rounded-lg transition-all cursor-pointer">
        {/* Image */}
        <div className="relative flex-shrink-0">
          <img
            src={ipfsToHttp(artwork.ipfsCID)}
            alt={artwork.name}
            className="w-16 h-16 rounded-md object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                `https://picsum.photos/seed/${artwork.address}/128/128`;
            }}
          />
          {rank && rank <= 3 && (
            <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-[#00ff88] rounded-full flex items-center justify-center">
              <span className="text-black text-[10px] font-black">{rank}</span>
            </div>
          )}
          {artwork.graduated && (
            <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-black text-[8px] font-black px-1 rounded">
              🎓
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between mb-1">
            <div className="min-w-0">
              <h3 className="text-white font-bold text-sm truncate leading-tight">
                {artwork.name}
              </h3>
              <p className="text-[#555] text-[11px] font-mono">
                by {shortArtist} · {timeAgo(artwork.createdAt)}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 text-[11px] mb-2">
            <span className="text-[#00ff88] font-bold font-mono">
              {formatEth(artwork.price, 5)} ETH
            </span>
            <span className="text-[#444]">|</span>
            <span className="text-[#888]">
              mkt cap: <span className="text-[#bbb]">{formatEth(artwork.marketCap, 3)} ETH</span>
            </span>
            <span className="text-[#444]">|</span>
            <span className="text-[#888]">
              vol: <span className="text-[#bbb]">{formatEth(artwork.totalVolume, 3)} ETH</span>
            </span>
          </div>

          {/* Bonding curve progress — pump.fun signature element */}
          <div>
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-[#444] font-mono">bonding curve progress</span>
              <span className="text-[#00ff88] font-mono">{progressPct.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all progress-bar"
                style={{ width: `${Math.max(progressPct, 1)}%` }}
              />
            </div>
          </div>

          {/* Shares */}
          <div className="mt-1 text-[10px] text-[#444] font-mono">
            {artwork.supply.toString()} shares minted · royalties: {formatEth(artwork.totalRoyalties, 4)} ETH
          </div>
        </div>
      </div>
    </Link>
  );
}
