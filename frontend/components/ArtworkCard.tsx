"use client";

import { useState } from "react";
import Link from "next/link";
import { ArtworkInfo, formatEth, getIpfsUrlsForFallback, graduationProgress, timeAgo, shortAddress } from "@/lib/contracts";

interface Props {
  artwork: ArtworkInfo;
  rank?: number;
}

export default function ArtworkCard({ artwork, rank }: Props) {
  const progressPct = graduationProgress(artwork.reserve);

  // IPFS multi-gateway fallback — tries each gateway in order on error
  const ipfsUrls = getIpfsUrlsForFallback(artwork.ipfsCID);
  const [imgIndex, setImgIndex] = useState(0);

  const handleImgError = () => {
    if (imgIndex < ipfsUrls.length - 1) {
      setImgIndex((i) => i + 1);
    } else {
      // All IPFS gateways failed — use deterministic placeholder
      setImgIndex(ipfsUrls.length); // sentinel: show placeholder
    }
  };

  const imgSrc =
    imgIndex < ipfsUrls.length
      ? ipfsUrls[imgIndex]
      : `https://picsum.photos/seed/${artwork.address}/128/128`;

  return (
    <Link href={`/artwork/${artwork.address}`}>
      {/* pump.fun style horizontal card */}
      <div className="group flex gap-3 p-3 bg-[#111] border border-[#1e1e1e] hover:border-[#00ff88]/30 hover:bg-[#141414] rounded-lg transition-all cursor-pointer">

        {/* Artwork image */}
        <div className="relative flex-shrink-0">
          <img
            src={imgSrc}
            alt={artwork.name}
            width={64}
            height={64}
            className="w-16 h-16 rounded-md object-cover bg-[#0d0d0d]"
            onError={handleImgError}
          />

          {/* Top-3 rank badge */}
          {rank && rank <= 3 && (
            <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-[#00ff88] rounded-full flex items-center justify-center">
              <span className="text-black text-[10px] font-black">{rank}</span>
            </div>
          )}

          {/* Graduated badge */}
          {artwork.graduated && (
            <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-black text-[8px] font-black px-1 rounded">
              🎓
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Name + artist */}
          <div className="flex items-start justify-between mb-1">
            <div className="min-w-0">
              <h3 className="text-white font-bold text-sm truncate leading-tight">
                {artwork.name}
              </h3>
              <p className="text-[#555] text-[11px] font-mono">
                by {shortAddress(artwork.artist)} · {timeAgo(Number(artwork.createdAt))}
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
              mcap:{" "}
              <span className="text-[#bbb]">{formatEth(artwork.marketCap, 3)} ETH</span>
            </span>
            <span className="text-[#444]">|</span>
            <span className="text-[#888]">
              vol:{" "}
              <span className="text-[#bbb]">{formatEth(artwork.totalVolume, 3)} ETH</span>
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

          {/* Supply / royalties */}
          <div className="mt-1 text-[10px] text-[#444] font-mono">
            {artwork.supply.toString()} shares · royalties: {formatEth(artwork.totalRoyalties, 4)} ETH
          </div>
        </div>
      </div>
    </Link>
  );
}
