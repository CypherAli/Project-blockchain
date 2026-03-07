"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { useAccount, useChainId } from "wagmi";
import { parseEther } from "viem";
import { useQuery } from "@tanstack/react-query";
import {
  ART_FACTORY_ABI,
  ART_BONDING_CURVE_ABI,
  getFactoryAddress,
  ArtworkInfo,
  TradeEvent,
  addFees,
  deductFees,
} from "./contracts";

// ─────────────────────────────────────────────────────────────────────────────
// Factory hooks
// ─────────────────────────────────────────────────────────────────────────────

export function useFactory() {
  const chainId = useChainId();
  let factoryAddress: `0x${string}` | undefined;
  try {
    factoryAddress = getFactoryAddress(chainId);
  } catch {
    factoryAddress = undefined;
  }
  return { factoryAddress, chainId };
}

export function useListingFee() {
  const { factoryAddress } = useFactory();
  return useReadContract({
    address: factoryAddress,
    abi: ART_FACTORY_ABI,
    functionName: "listingFee",
    query: { enabled: !!factoryAddress },
  });
}

export function useTotalArtworks() {
  const { factoryAddress } = useFactory();
  return useReadContract({
    address: factoryAddress,
    abi: ART_FACTORY_ABI,
    functionName: "totalArtworks",
    query: { enabled: !!factoryAddress },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch all artworks with their info
// ─────────────────────────────────────────────────────────────────────────────

export function useAllArtworks() {
  const { factoryAddress, chainId } = useFactory();
  const client = usePublicClient();

  return useQuery({
    queryKey: ["allArtworks", chainId, factoryAddress],
    enabled: !!factoryAddress && !!client,
    queryFn: async (): Promise<ArtworkInfo[]> => {
      if (!factoryAddress || !client) return [];

      const addresses = (await client.readContract({
        address: factoryAddress,
        abi: ART_FACTORY_ABI,
        functionName: "getAllArtworks",
      })) as `0x${string}`[];

      if (addresses.length === 0) return [];

      const infos = await Promise.all(
        addresses.map(async (addr) => {
          try {
            const name = (await client.readContract({
              address: addr,
              abi: ART_BONDING_CURVE_ABI,
              functionName: "name",
            })) as string;

            const info = (await client.readContract({
              address: addr,
              abi: ART_BONDING_CURVE_ABI,
              functionName: "getInfo",
            })) as [string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint];

            return {
              address: addr,
              name,
              artist: info[0] as `0x${string}`,
              ipfsCID: info[1],
              k: info[2],
              p0: info[3],
              supply: info[4],
              price: info[5],
              reserve: info[6],
              marketCap: info[7],
              graduated: info[8],
              createdAt: info[9],
              totalRoyalties: info[10],
              totalVolume: info[11],
            } as ArtworkInfo;
          } catch {
            return null;
          }
        })
      );

      return infos.filter(Boolean) as ArtworkInfo[];
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Single artwork info
// ─────────────────────────────────────────────────────────────────────────────

export function useArtworkInfo(address?: `0x${string}`) {
  const client = usePublicClient();

  return useQuery({
    queryKey: ["artworkInfo", address],
    enabled: !!address && !!client,
    queryFn: async (): Promise<ArtworkInfo | null> => {
      if (!address || !client) return null;
      try {
        const [name, info] = await Promise.all([
          client.readContract({ address, abi: ART_BONDING_CURVE_ABI, functionName: "name" }) as Promise<string>,
          client.readContract({ address, abi: ART_BONDING_CURVE_ABI, functionName: "getInfo" }) as Promise<[string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint]>,
        ]);
        return {
          address,
          name,
          artist: info[0] as `0x${string}`,
          ipfsCID: info[1],
          k: info[2],
          p0: info[3],
          supply: info[4],
          price: info[5],
          reserve: info[6],
          marketCap: info[7],
          graduated: info[8],
          createdAt: info[9],
          totalRoyalties: info[10],
          totalVolume: info[11],
        };
      } catch {
        return null;
      }
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

export function useShareBalance(artworkAddress?: `0x${string}`) {
  const { address } = useAccount();
  return useReadContract({
    address: artworkAddress,
    abi: ART_BONDING_CURVE_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!artworkAddress && !!address },
  });
}

export function useQuoteBuy(artworkAddress?: `0x${string}`, amount?: bigint) {
  return useReadContract({
    address: artworkAddress,
    abi: ART_BONDING_CURVE_ABI,
    functionName: "quoteBuy",
    args: amount && amount > 0n ? [amount] : undefined,
    query: { enabled: !!artworkAddress && !!amount && amount > 0n },
  });
}

export function useQuoteSell(artworkAddress?: `0x${string}`, amount?: bigint) {
  return useReadContract({
    address: artworkAddress,
    abi: ART_BONDING_CURVE_ABI,
    functionName: "quoteSell",
    args: amount && amount > 0n ? [amount] : undefined,
    query: { enabled: !!artworkAddress && !!amount && amount > 0n },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Trade history from events
// ─────────────────────────────────────────────────────────────────────────────

export function useTradeHistory(artworkAddress?: `0x${string}`) {
  const client = usePublicClient();

  return useQuery({
    queryKey: ["tradeHistory", artworkAddress],
    enabled: !!artworkAddress && !!client,
    queryFn: async (): Promise<TradeEvent[]> => {
      if (!artworkAddress || !client) return [];

      const [buyLogs, sellLogs] = await Promise.all([
        client.getLogs({
          address: artworkAddress,
          event: {
            type: "event",
            name: "SharesBought",
            inputs: [
              { type: "address", name: "buyer", indexed: true },
              { type: "uint256", name: "shares" },
              { type: "uint256", name: "ethCost" },
              { type: "uint256", name: "royalty" },
              { type: "uint256", name: "platformFee" },
              { type: "uint256", name: "newTotalSupply" },
              { type: "uint256", name: "newPrice" },
            ],
          },
          fromBlock: "earliest",
          toBlock: "latest",
        }),
        client.getLogs({
          address: artworkAddress,
          event: {
            type: "event",
            name: "SharesSold",
            inputs: [
              { type: "address", name: "seller", indexed: true },
              { type: "uint256", name: "shares" },
              { type: "uint256", name: "ethReturned" },
              { type: "uint256", name: "royalty" },
              { type: "uint256", name: "platformFee" },
              { type: "uint256", name: "newTotalSupply" },
              { type: "uint256", name: "newPrice" },
            ],
          },
          fromBlock: "earliest",
          toBlock: "latest",
        }),
      ]);

      const events: TradeEvent[] = [
        ...buyLogs.map((log) => ({
          type: "buy" as const,
          address: log.args.buyer as string,
          shares: log.args.shares as bigint,
          ethAmount: log.args.ethCost as bigint,
          royalty: log.args.royalty as bigint,
          newSupply: log.args.newTotalSupply as bigint,
          newPrice: log.args.newPrice as bigint,
          blockNumber: log.blockNumber,
        })),
        ...sellLogs.map((log) => ({
          type: "sell" as const,
          address: log.args.seller as string,
          shares: log.args.shares as bigint,
          ethAmount: log.args.ethReturned as bigint,
          royalty: log.args.royalty as bigint,
          newSupply: log.args.newTotalSupply as bigint,
          newPrice: log.args.newPrice as bigint,
          blockNumber: log.blockNumber,
        })),
      ].sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));

      return events;
    },
    staleTime: 15_000,
    refetchInterval: 20_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Write: Buy shares
// ─────────────────────────────────────────────────────────────────────────────

export function useBuyShares(artworkAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const buy = (amount: bigint, totalCost: bigint) => {
    if (!artworkAddress) return;
    const slippage = (totalCost * 101n) / 100n; // 1% slippage tolerance
    writeContract({
      address: artworkAddress,
      abi: ART_BONDING_CURVE_ABI,
      functionName: "buy",
      args: [amount, slippage],
      value: slippage,
    });
  };

  return { buy, hash, isPending, isConfirming, isSuccess, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// Write: Sell shares
// ─────────────────────────────────────────────────────────────────────────────

export function useSellShares(artworkAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const sell = (amount: bigint, grossReturn: bigint) => {
    if (!artworkAddress) return;
    const { netReturn } = deductFees(grossReturn);
    const minReturn = (netReturn * 99n) / 100n; // 1% slippage tolerance
    writeContract({
      address: artworkAddress,
      abi: ART_BONDING_CURVE_ABI,
      functionName: "sell",
      args: [amount, minReturn],
    });
  };

  return { sell, hash, isPending, isConfirming, isSuccess, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// Write: Create artwork
// ─────────────────────────────────────────────────────────────────────────────

export function useCreateArtwork() {
  const { factoryAddress } = useFactory();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const create = (name: string, ipfsCID: string, listingFee: bigint) => {
    if (!factoryAddress) return;
    writeContract({
      address: factoryAddress,
      abi: ART_FACTORY_ABI,
      functionName: "createArtworkDefault",
      args: [name, ipfsCID],
      value: listingFee,
    });
  };

  return { create, hash, isPending, isConfirming, isSuccess, error };
}
