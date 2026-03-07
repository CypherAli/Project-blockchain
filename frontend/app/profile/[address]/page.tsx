"use client";

import { use } from "react";
import Link from "next/link";
import { useAllArtworks } from "@/lib/hooks";
import ArtworkCard from "@/components/ArtworkCard";
import { ArtworkInfo, formatEth } from "@/lib/contracts";
import { useAccount } from "wagmi";
import { useReadContracts, usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ART_BONDING_CURVE_ABI } from "@/lib/contracts";

interface Props {
  params: Promise<{ address: string }>;
}

export default function ProfilePage({ params }: Props) {
  const { address: paramAddress } = use(params);
  const { address: connectedAddress } = useAccount();
  const client = usePublicClient();
  const profileAddress = paramAddress as `0x${string}`;

  const { data: allArtworks, isLoading } = useAllArtworks();
  const isOwn = connectedAddress?.toLowerCase() === profileAddress.toLowerCase();

  // Artworks created by this artist
  const createdArtworks = allArtworks?.filter(
    (a) => a.artist.toLowerCase() === profileAddress.toLowerCase()
  ) ?? [];

  // Total royalties earned
  const totalRoyalties = createdArtworks.reduce((s, a) => s + a.totalRoyalties, 0n);
  const totalVolume = createdArtworks.reduce((s, a) => s + a.totalVolume, 0n);

  // Artworks the user holds shares in
  const { data: holdings } = useQuery({
    queryKey: ["holdings", profileAddress, allArtworks?.length],
    enabled: !!allArtworks && allArtworks.length > 0 && !!client,
    queryFn: async () => {
      if (!allArtworks || !client) return [];
      const results = await Promise.all(
        allArtworks.map(async (artwork) => {
          try {
            const bal = await client.readContract({
              address: artwork.address,
              abi: ART_BONDING_CURVE_ABI,
              functionName: "balanceOf",
              args: [profileAddress],
            }) as bigint;
            return bal > 0n ? { artwork, balance: bal } : null;
          } catch {
            return null;
          }
        })
      );
      return results.filter(Boolean) as { artwork: ArtworkInfo; balance: bigint }[];
    },
    staleTime: 15_000,
  });

  const shortAddr = `${profileAddress.slice(0, 8)}...${profileAddress.slice(-6)}`;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Profile header */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-3xl font-black text-white">
          {profileAddress.slice(2, 4).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-bold text-white font-mono">{shortAddr}</h1>
            {isOwn && (
              <span className="text-xs bg-violet-500/20 text-violet-400 border border-violet-500/30 px-2 py-0.5 rounded-full">
                You
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Artworks Created</p>
              <p className="text-white font-semibold">{createdArtworks.length}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Total Volume</p>
              <p className="text-white font-semibold">{formatEth(totalVolume, 4)} ETH</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Total Royalties Earned</p>
              <p className="text-yellow-400 font-semibold">{formatEth(totalRoyalties, 5)} ETH</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Shares Held In</p>
              <p className="text-white font-semibold">{holdings?.length ?? "..."} artworks</p>
            </div>
          </div>
        </div>
        <a
          href={`https://sepolia.etherscan.io/address/${profileAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-400 text-xs hover:underline"
        >
          View on Etherscan
        </a>
      </div>

      {/* Created artworks */}
      {createdArtworks.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-white mb-4">Artworks Created</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {createdArtworks.map((artwork) => (
              <ArtworkCard key={artwork.address} artwork={artwork} />
            ))}
          </div>
        </section>
      )}

      {/* Portfolio (shares held) */}
      <section>
        <h2 className="text-lg font-bold text-white mb-4">Portfolio (Shares Held)</h2>
        {!holdings ? (
          <div className="text-gray-500 text-sm py-8 text-center">Loading holdings...</div>
        ) : holdings.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <p className="text-gray-500 text-sm">No shares held yet</p>
            <Link href="/explore" className="text-violet-400 text-sm hover:underline mt-2 block">
              Browse artworks to invest in
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {holdings.map(({ artwork, balance }) => (
              <Link key={artwork.address} href={`/artwork/${artwork.address}`}>
                <div className="bg-gray-900 border border-gray-800 hover:border-violet-500/40 rounded-2xl p-4 flex items-center gap-4 transition-all cursor-pointer">
                  <img
                    src={`https://picsum.photos/seed/${artwork.address}/80/80`}
                    alt={artwork.name}
                    className="w-12 h-12 rounded-xl object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{artwork.name}</p>
                    <p className="text-gray-500 text-xs">by {artwork.artist.slice(0, 8)}...</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-sm">{balance.toString()} shares</p>
                    <p className="text-gray-400 text-xs">
                      ~{formatEth(artwork.price * balance, 5)} ETH
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Price</p>
                    <p className="text-violet-400 text-xs">{formatEth(artwork.price, 6)} ETH</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
