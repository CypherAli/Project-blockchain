"use client";

import { useState } from "react";
import { useAllArtworks } from "@/lib/hooks";
import ArtworkCard from "@/components/ArtworkCard";

type SortOption = "volume" | "newest" | "price" | "graduating";

export default function ExplorePage() {
  const { data: artworks, isLoading, refetch } = useAllArtworks();
  const [sort, setSort] = useState<SortOption>("volume");
  const [search, setSearch] = useState("");
  const [showGradOnly, setShowGradOnly] = useState(false);

  const sorted = [...(artworks ?? [])]
    .filter((a) => {
      if (showGradOnly && !a.graduated) return false;
      if (search) return a.name.toLowerCase().includes(search.toLowerCase());
      return true;
    })
    .sort((a, b) => {
      if (sort === "volume") return a.totalVolume > b.totalVolume ? -1 : 1;
      if (sort === "newest") return a.createdAt > b.createdAt ? -1 : 1;
      if (sort === "price") return a.price > b.price ? -1 : 1;
      if (sort === "graduating") return a.reserve > b.reserve ? -1 : 1;
      return 0;
    });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-black text-xl font-mono">
            [explore artworks]
          </h1>
          <p className="text-[#444] text-xs font-mono mt-0.5">
            {artworks?.length ?? 0} artworks with live bonding curves
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 border border-[#1e1e1e] text-[#444] hover:text-[#00ff88] hover:border-[#00ff88]/30 text-xs font-mono rounded transition-all"
        >
          [refresh]
        </button>
      </div>

      {/* Filter bar — pump.fun style */}
      <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-[#1e1e1e]">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search artworks..."
          className="bg-[#111] border border-[#1e1e1e] rounded px-3 py-1.5 text-xs text-white placeholder-[#333] focus:outline-none focus:border-[#00ff88]/40 transition-colors font-mono min-w-48"
        />

        <div className="flex items-center gap-0.5">
          {(["volume", "newest", "price", "graduating"] as SortOption[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                sort === s
                  ? "bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30"
                  : "text-[#444] hover:text-[#888] border border-transparent"
              }`}
            >
              {s === "volume" ? "trending" : s}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowGradOnly(!showGradOnly)}
          className={`px-3 py-1.5 rounded text-xs font-mono border transition-all ${
            showGradOnly
              ? "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"
              : "border-[#1e1e1e] text-[#444] hover:text-[#888]"
          }`}
        >
          🎓 graduated
        </button>
      </div>

      {/* Artwork list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-24 bg-[#111] border border-[#1e1e1e] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20 border border-[#1e1e1e] rounded-xl">
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-white font-mono text-sm">
            {search ? "no results found" : "no artworks yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((artwork, i) => (
            <ArtworkCard
              key={artwork.address}
              artwork={artwork}
              rank={sort === "volume" ? i + 1 : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
