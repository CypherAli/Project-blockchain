"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAllArtworks, useTradeHistory } from "@/lib/hooks";
import ArtworkCard from "@/components/ArtworkCard";
import { ArtworkInfo, formatEth } from "@/lib/contracts";

type FilterTab = "trending" | "newest" | "graduating" | "graduated";

// ─── Live feed entry ────────────────────────────────────────────────────────
interface FeedEntry {
  id: string;
  type: "buy" | "sell" | "launch";
  artworkName: string;
  artworkAddr: string;
  user: string;
  amount: string;
  time: number;
}

// ─── King of the Hill card ──────────────────────────────────────────────────
function KingCard({ artwork }: { artwork: ArtworkInfo }) {
  const GRAD_THRESHOLD = BigInt("24000000000000000000");
  const progressPct = Math.min(
    Number((artwork.reserve * 10000n) / GRAD_THRESHOLD) / 100,
    100
  );
  return (
    <Link href={`/artwork/${artwork.address}`}>
      <div className="relative border border-[#00ff88]/30 bg-[#0d1a0f] rounded-xl p-4 flex gap-4 hover:border-[#00ff88]/60 transition-all cursor-pointer overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-[#00ff88]/3 pointer-events-none" />

        <div className="relative flex-shrink-0">
          <img
            src={`https://picsum.photos/seed/${artwork.address}/120/120`}
            alt={artwork.name}
            className="w-24 h-24 rounded-lg object-cover border border-[#00ff88]/20"
          />
          <div className="absolute -top-2 -left-2 bg-[#00ff88] text-black text-[10px] font-black px-2 py-0.5 rounded-full">
            KING
          </div>
        </div>

        <div className="flex-1 min-w-0 relative">
          <p className="text-[#00ff88] text-[10px] font-mono mb-1">
            👑 king of the hill
          </p>
          <h2 className="text-white font-black text-lg mb-1 truncate">{artwork.name}</h2>
          <p className="text-[#555] text-xs font-mono mb-3">
            by {artwork.artist.slice(0, 8)}...{artwork.artist.slice(-6)}
          </p>

          <div className="grid grid-cols-3 gap-3 mb-3 text-xs">
            <div>
              <p className="text-[#444] font-mono">price</p>
              <p className="text-[#00ff88] font-bold font-mono">{formatEth(artwork.price, 5)} ETH</p>
            </div>
            <div>
              <p className="text-[#444] font-mono">mkt cap</p>
              <p className="text-white font-bold">{formatEth(artwork.marketCap, 3)} ETH</p>
            </div>
            <div>
              <p className="text-[#444] font-mono">royalties</p>
              <p className="text-yellow-400 font-bold">{formatEth(artwork.totalRoyalties, 4)} ETH</p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[10px] mb-1 font-mono">
              <span className="text-[#444]">bonding curve progress</span>
              <span className="text-[#00ff88]">{progressPct.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-[#1a1a1a] rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full progress-bar transition-all"
                style={{ width: `${Math.max(progressPct, 2)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Live feed panel ─────────────────────────────────────────────────────────
function LiveFeed({ artworks }: { artworks: ArtworkInfo[] }) {
  const [feed, setFeed] = useState<FeedEntry[]>([]);

  // Simulate feed from artworks data (in real app: from events)
  useEffect(() => {
    if (artworks.length === 0) return;
    const entries: FeedEntry[] = artworks.slice(0, 8).map((a, i) => ({
      id: `${a.address}-${i}`,
      type: i % 3 === 0 ? "sell" : i % 5 === 0 ? "launch" : "buy",
      artworkName: a.name,
      artworkAddr: a.address,
      user: `${a.artist.slice(0, 6)}...${a.artist.slice(-4)}`,
      amount: formatEth(a.totalVolume > 0n ? a.totalVolume / BigInt(Math.max(Number(a.supply), 1)) : a.price, 5),
      time: Date.now() - i * 45_000,
    }));
    setFeed(entries);
  }, [artworks.length]);

  const timeAgo = (t: number) => {
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}h`;
  };

  return (
    <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#00ff88] text-xs font-mono font-bold">live feed</span>
        <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
      </div>
      <div className="space-y-2 overflow-y-auto max-h-80">
        {feed.length === 0 ? (
          <p className="text-[#333] text-xs font-mono text-center py-8">
            no activity yet
          </p>
        ) : (
          feed.map((e) => (
            <div key={e.id} className="feed-item flex items-start gap-2 text-[11px] py-1.5 border-b border-[#1a1a1a]">
              <span className={`font-bold font-mono flex-shrink-0 ${
                e.type === "buy" ? "text-[#00ff88]" : e.type === "sell" ? "text-red-400" : "text-blue-400"
              }`}>
                {e.type === "buy" ? "BUY" : e.type === "sell" ? "SELL" : "NEW"}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-[#777]">{e.user} </span>
                <span className="text-[#555]">
                  {e.type === "buy" ? "bought" : e.type === "sell" ? "sold" : "launched"}{" "}
                </span>
                <Link href={`/artwork/${e.artworkAddr}`} className="text-white hover:text-[#00ff88] transition-colors">
                  {e.artworkName.length > 16 ? e.artworkName.slice(0, 16) + "…" : e.artworkName}
                </Link>
                {e.type !== "launch" && (
                  <span className="text-[#555]"> for {e.amount} ETH</span>
                )}
              </div>
              <span className="text-[#333] font-mono flex-shrink-0">{timeAgo(e.time)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { data: artworks, isLoading } = useAllArtworks();
  const [filter, setFilter] = useState<FilterTab>("trending");

  const totalVolume = artworks?.reduce((s, a) => s + a.totalVolume, 0n) ?? 0n;
  const graduatedCount = artworks?.filter((a) => a.graduated).length ?? 0;

  const sorted = [...(artworks ?? [])].sort((a, b) => {
    if (filter === "trending")   return a.totalVolume > b.totalVolume ? -1 : 1;
    if (filter === "newest")     return a.createdAt > b.createdAt ? -1 : 1;
    if (filter === "graduating") return a.reserve > b.reserve ? -1 : 1;
    if (filter === "graduated")  return a.graduated && !b.graduated ? -1 : 1;
    return 0;
  });

  const king = artworks && artworks.length > 0
    ? [...artworks].sort((a, b) => a.totalVolume > b.totalVolume ? -1 : 1)[0]
    : null;

  return (
    <div className="space-y-6">
      {/* Top bar — pump.fun style */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-2">
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-[#333]">artworks: <span className="text-white">{artworks?.length ?? 0}</span></span>
          <span className="text-[#333]">volume: <span className="text-[#00ff88]">{formatEth(totalVolume, 3)} ETH</span></span>
          <span className="text-[#333]">graduated: <span className="text-yellow-400">{graduatedCount}</span></span>
        </div>
        <Link
          href="/create"
          className="px-5 py-2 bg-[#00ff88] hover:bg-[#00cc6a] text-black font-black text-xs rounded font-mono transition-all"
        >
          [start a new artwork]
        </Link>
      </div>

      {/* Main layout: left = feed + king, right = list */}
      <div className="grid lg:grid-cols-4 gap-6">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-4">
          {/* King of the Hill */}
          {king && <KingCard artwork={king} />}

          {/* Live feed */}
          <LiveFeed artworks={artworks ?? []} />

          {/* How it differs from pump.fun */}
          <div className="border border-[#1e1e1e] bg-[#0d0d0d] rounded-xl p-4 text-xs font-mono space-y-2">
            <p className="text-[#00ff88] font-bold mb-2">why artcurve.fun?</p>
            {[
              ["✓", "real artwork backing"],
              ["✓", "5% royalty EVERY trade"],
              ["✓", "fractional ownership"],
              ["✓", "IPFS permanent storage"],
              ["✓", "on-chain royalty"],
            ].map(([icon, text]) => (
              <div key={text} className="flex gap-2 text-[#555]">
                <span className="text-[#00ff88]">{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: artwork list */}
        <div className="lg:col-span-3">
          {/* Filter tabs — pump.fun style */}
          <div className="flex items-center gap-1 mb-4 border-b border-[#1e1e1e] pb-3">
            {(["trending", "newest", "graduating", "graduated"] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                  filter === tab
                    ? "bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30"
                    : "text-[#444] hover:text-[#888] border border-transparent"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* List */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 bg-[#111] border border-[#1e1e1e] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-20 border border-[#1e1e1e] rounded-xl">
              <p className="text-5xl mb-4">🎨</p>
              <p className="text-white font-bold mb-2 font-mono">no artworks yet</p>
              <p className="text-[#444] text-sm mb-6 font-mono">
                be the first to launch an artwork with a bonding curve
              </p>
              <Link
                href="/create"
                className="px-6 py-2.5 bg-[#00ff88] text-black font-black text-sm rounded font-mono hover:bg-[#00cc6a] transition-all"
              >
                [start a new artwork]
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((artwork, i) => (
                <ArtworkCard
                  key={artwork.address}
                  artwork={artwork}
                  rank={filter === "trending" ? i + 1 : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
