'use client';

/**
 * ArtCurve — React Hooks for Smart Contract Interaction
 *
 * All reads use wagmi + @tanstack/react-query for caching.
 * Writes return a toast-friendly API: pending → success/error.
 *
 * Pagination: useAllArtworks fetches in batches of BATCH_SIZE
 * to avoid RPC timeouts when there are many artworks.
 */

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useWatchContractEvent,
} from 'wagmi';
import { useAccount, useChainId } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ART_FACTORY_ABI, ART_BONDING_CURVE_ABI, type ArtworkInfo, type TradeEvent } from './contracts';
import { config } from './config';
import { deductFees } from '@/lib/shared/bondingCurve';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Number of artworks to fetch per batch (avoids RPC timeout) */
const BATCH_SIZE = 20;

/** Refetch intervals */
const STALE_ARTWORK_LIST = 10_000;   // 10s
const STALE_ARTWORK_INFO = 6_000;    // 6s
const STALE_TRADE_HISTORY = 15_000;  // 15s
const REFETCH_ARTWORK_LIST = 15_000; // 15s
const REFETCH_ARTWORK_INFO = 10_000; // 10s
const REFETCH_TRADE_HISTORY = 20_000;// 20s

// ─── Factory address ──────────────────────────────────────────────────────────

export function useFactoryAddress(): `0x${string}` | undefined {
  const addr = config.factoryAddress;
  if (!addr || addr === '0x') return undefined;
  return addr;
}

// ─── Factory read hooks ───────────────────────────────────────────────────────

export function useListingFee() {
  const factoryAddress = useFactoryAddress();
  return useReadContract({
    address: factoryAddress,
    abi: ART_FACTORY_ABI,
    functionName: 'listingFee',
    query: { enabled: !!factoryAddress },
  });
}

export function useTotalArtworks() {
  const factoryAddress = useFactoryAddress();
  return useReadContract({
    address: factoryAddress,
    abi: ART_FACTORY_ABI,
    functionName: 'totalArtworks',
    query: { enabled: !!factoryAddress },
  });
}

export function useFactoryOwner() {
  const factoryAddress = useFactoryAddress();
  return useReadContract({
    address: factoryAddress,
    abi: ART_FACTORY_ABI,
    functionName: 'owner',
    query: { enabled: !!factoryAddress },
  });
}

// ─── Fetch all artworks (paginated batches) ───────────────────────────────────

/**
 * Fetches all artworks from the factory in batches of BATCH_SIZE.
 * Calls getInfo() on each address in parallel within each batch.
 *
 * Falls back gracefully if an individual artwork contract fails.
 */
export function useAllArtworks() {
  const factoryAddress = useFactoryAddress();
  const chainId = useChainId();
  const client = usePublicClient();

  return useQuery({
    queryKey: ['allArtworks', chainId, factoryAddress],
    enabled: !!factoryAddress && !!client,
    staleTime: STALE_ARTWORK_LIST,
    refetchInterval: REFETCH_ARTWORK_LIST,

    queryFn: async (): Promise<ArtworkInfo[]> => {
      if (!factoryAddress || !client) return [];

      // 1. Get total count
      const total = (await client.readContract({
        address: factoryAddress,
        abi: ART_FACTORY_ABI,
        functionName: 'totalArtworks',
      })) as bigint;

      if (total === 0n) return [];

      const allInfos: ArtworkInfo[] = [];

      // 2. Fetch in batches to avoid RPC limits
      for (let offset = 0n; offset < total; offset += BigInt(BATCH_SIZE)) {
        const [addresses] = (await client.readContract({
          address: factoryAddress,
          abi: ART_FACTORY_ABI,
          functionName: 'getArtworksPaginated',
          args: [offset, BigInt(BATCH_SIZE)],
        })) as [`0x${string}`[], bigint];

        // 3. Fetch name + info in parallel for this batch
        const batch = await Promise.all(
          addresses.map((addr) => fetchArtworkInfo(client, addr))
        );

        allInfos.push(...batch.filter((x): x is ArtworkInfo => x !== null));
      }

      return allInfos;
    },
  });
}

// ─── Single artwork info ──────────────────────────────────────────────────────

export function useArtworkInfo(address?: `0x${string}`) {
  const client = usePublicClient();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['artworkInfo', address],
    enabled: !!address && !!client,
    staleTime: STALE_ARTWORK_INFO,
    refetchInterval: REFETCH_ARTWORK_INFO,
    queryFn: async (): Promise<ArtworkInfo | null> => {
      if (!address || !client) return null;
      return fetchArtworkInfo(client, address);
    },
    // Seed from allArtworks cache if available
    initialData: () => {
      const all = queryClient.getQueryData<ArtworkInfo[]>(
        ['allArtworks', config.chainId, config.factoryAddress]
      );
      return all?.find((a) => a.address.toLowerCase() === address?.toLowerCase());
    },
    initialDataUpdatedAt: 0, // always refetch despite initialData
  });
}

// ─── Internal: fetch single artwork info ──────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchArtworkInfo(client: any, addr: `0x${string}`): Promise<ArtworkInfo | null> {
  try {
    const [name, info] = await Promise.all([
      client.readContract({ address: addr, abi: ART_BONDING_CURVE_ABI, functionName: 'name' }) as Promise<string>,
      client.readContract({ address: addr, abi: ART_BONDING_CURVE_ABI, functionName: 'getInfo' }) as Promise<readonly [string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint]>,
    ]);

    return {
      address: addr,
      name: name as string,
      artist:       info[0] as `0x${string}`,
      ipfsCID:      info[1] as string,
      k:            info[2] as bigint,
      p0:           info[3] as bigint,
      supply:       info[4] as bigint,
      price:        info[5] as bigint,
      reserve:      info[6] as bigint,
      marketCap:    info[7] as bigint,
      graduated:    info[8] as boolean,
      createdAt:    info[9] as bigint,
      totalRoyalties: info[10] as bigint,
      totalVolume:  info[11] as bigint,
    };
  } catch {
    return null;
  }
}

// ─── Share balance ────────────────────────────────────────────────────────────

export function useShareBalance(artworkAddress?: `0x${string}`) {
  const { address: userAddress } = useAccount();
  return useReadContract({
    address: artworkAddress,
    abi: ART_BONDING_CURVE_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!artworkAddress && !!userAddress },
  });
}

// ─── Quote hooks ──────────────────────────────────────────────────────────────

export function useQuoteBuy(artworkAddress?: `0x${string}`, amount?: bigint) {
  return useReadContract({
    address: artworkAddress,
    abi: ART_BONDING_CURVE_ABI,
    functionName: 'quoteBuy',
    args: amount && amount > 0n ? [amount] : undefined,
    query: {
      enabled: !!artworkAddress && typeof amount === 'bigint' && amount > 0n,
      staleTime: 3_000,
    },
  });
}

export function useQuoteSell(artworkAddress?: `0x${string}`, amount?: bigint) {
  return useReadContract({
    address: artworkAddress,
    abi: ART_BONDING_CURVE_ABI,
    functionName: 'quoteSell',
    args: amount && amount > 0n ? [amount] : undefined,
    query: {
      enabled: !!artworkAddress && typeof amount === 'bigint' && amount > 0n,
      staleTime: 3_000,
    },
  });
}

// ─── Trade history from events ────────────────────────────────────────────────

export function useTradeHistory(artworkAddress?: `0x${string}`, limit = 50) {
  const client = usePublicClient();

  return useQuery({
    queryKey: ['tradeHistory', artworkAddress, limit],
    enabled: !!artworkAddress && !!client,
    staleTime: STALE_TRADE_HISTORY,
    refetchInterval: REFETCH_TRADE_HISTORY,

    queryFn: async (): Promise<TradeEvent[]> => {
      if (!artworkAddress || !client) return [];

      const BUY_EVENT = {
        type: 'event' as const,
        name: 'SharesBought',
        inputs: [
          { type: 'address' as const, name: 'buyer', indexed: true },
          { type: 'uint256' as const, name: 'shares', indexed: false },
          { type: 'uint256' as const, name: 'ethCost', indexed: false },
          { type: 'uint256' as const, name: 'royalty', indexed: false },
          { type: 'uint256' as const, name: 'platformFee', indexed: false },
          { type: 'uint256' as const, name: 'newTotalSupply', indexed: false },
          { type: 'uint256' as const, name: 'newPrice', indexed: false },
        ],
      };

      const SELL_EVENT = {
        type: 'event' as const,
        name: 'SharesSold',
        inputs: [
          { type: 'address' as const, name: 'seller', indexed: true },
          { type: 'uint256' as const, name: 'shares', indexed: false },
          { type: 'uint256' as const, name: 'ethReturned', indexed: false },
          { type: 'uint256' as const, name: 'royalty', indexed: false },
          { type: 'uint256' as const, name: 'platformFee', indexed: false },
          { type: 'uint256' as const, name: 'newTotalSupply', indexed: false },
          { type: 'uint256' as const, name: 'newPrice', indexed: false },
        ],
      };

      const [buyLogs, sellLogs] = await Promise.all([
        client.getLogs({ address: artworkAddress, event: BUY_EVENT, fromBlock: 'earliest', toBlock: 'latest' }),
        client.getLogs({ address: artworkAddress, event: SELL_EVENT, fromBlock: 'earliest', toBlock: 'latest' }),
      ]);

      // Fetch block timestamps for time display
      const blockNumbers = [...new Set([
        ...buyLogs.map((l) => l.blockNumber),
        ...sellLogs.map((l) => l.blockNumber),
      ])].filter(Boolean) as bigint[];

      const timestampMap = new Map<bigint, number>();
      await Promise.all(
        blockNumbers.slice(0, 100).map(async (bn) => {
          try {
            const block = await client.getBlock({ blockNumber: bn });
            timestampMap.set(bn, Number(block.timestamp));
          } catch { /* skip */ }
        })
      );

      const events: TradeEvent[] = [
        ...buyLogs.map((log) => ({
          type: 'BUY' as const,
          trader:    (log.args as Record<string, unknown>).buyer as `0x${string}`,
          shares:    (log.args as Record<string, unknown>).shares as bigint,
          ethAmount: (log.args as Record<string, unknown>).ethCost as bigint,
          royalty:   (log.args as Record<string, unknown>).royalty as bigint,
          newSupply: (log.args as Record<string, unknown>).newTotalSupply as bigint,
          newPrice:  (log.args as Record<string, unknown>).newPrice as bigint,
          blockNumber: log.blockNumber ?? 0n,
          timestamp: log.blockNumber ? (timestampMap.get(log.blockNumber) ?? 0) : 0,
          txHash:    log.transactionHash ?? ('0x' as `0x${string}`),
        })),
        ...sellLogs.map((log) => ({
          type: 'SELL' as const,
          trader:    (log.args as Record<string, unknown>).seller as `0x${string}`,
          shares:    (log.args as Record<string, unknown>).shares as bigint,
          ethAmount: (log.args as Record<string, unknown>).ethReturned as bigint,
          royalty:   (log.args as Record<string, unknown>).royalty as bigint,
          newSupply: (log.args as Record<string, unknown>).newTotalSupply as bigint,
          newPrice:  (log.args as Record<string, unknown>).newPrice as bigint,
          blockNumber: log.blockNumber ?? 0n,
          timestamp: log.blockNumber ? (timestampMap.get(log.blockNumber) ?? 0) : 0,
          txHash:    log.transactionHash ?? ('0x' as `0x${string}`),
        })),
      ]
        .sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber)) // newest first
        .slice(0, limit);

      return events;
    },
  });
}

// ─── Real-time event watching (for live feed) ─────────────────────────────────

export type LiveTradeEvent = TradeEvent & { artworkAddress: `0x${string}`; artworkName: string };

/**
 * Watches for new trades on ALL artworks in real-time.
 * Used for the homepage live feed.
 */
export function useLiveFeed(artworkAddresses: `0x${string}`[], artworkNames: Record<string, string>) {
  const queryClient = useQueryClient();
  const factoryAddress = useFactoryAddress();

  // Watch SharesBought on factory-registered artworks
  // Note: We watch the factory for ArtworkCreated events to refresh the list
  useWatchContractEvent({
    address: factoryAddress,
    abi: ART_FACTORY_ABI,
    eventName: 'ArtworkCreated',
    onLogs: () => {
      // Invalidate artwork list to include new artwork
      queryClient.invalidateQueries({ queryKey: ['allArtworks'] });
    },
  });
}

// ─── Write: Buy shares ────────────────────────────────────────────────────────

export function useBuyShares(artworkAddress?: `0x${string}`) {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const queryClient = useQueryClient();

  /**
   * @param amount    Number of shares to buy
   * @param totalCost Quoted total cost in wei (from quoteBuy)
   */
  const buy = async (amount: bigint, totalCost: bigint): Promise<`0x${string}` | null> => {
    if (!artworkAddress) return null;
    // 1% slippage tolerance
    const maxEth = totalCost + (totalCost * 100n) / 10_000n;

    const txHash = await writeContractAsync({
      address: artworkAddress,
      abi: ART_BONDING_CURVE_ABI,
      functionName: 'buy',
      args: [amount, maxEth],
      value: maxEth,
    });

    // Invalidate cache after buy
    queryClient.invalidateQueries({ queryKey: ['artworkInfo', artworkAddress] });
    queryClient.invalidateQueries({ queryKey: ['tradeHistory', artworkAddress] });

    return txHash;
  };

  return { buy, hash, isPending, isConfirming, isSuccess, error };
}

// ─── Write: Sell shares ───────────────────────────────────────────────────────

export function useSellShares(artworkAddress?: `0x${string}`) {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const queryClient = useQueryClient();

  /**
   * @param amount      Number of shares to sell
   * @param netReturn   Quoted net return in wei (from quoteSell)
   */
  const sell = async (amount: bigint, netReturn: bigint): Promise<`0x${string}` | null> => {
    if (!artworkAddress) return null;
    // 1% slippage tolerance on minimum received
    const minEth = netReturn - (netReturn * 100n) / 10_000n;

    const txHash = await writeContractAsync({
      address: artworkAddress,
      abi: ART_BONDING_CURVE_ABI,
      functionName: 'sell',
      args: [amount, minEth],
    });

    queryClient.invalidateQueries({ queryKey: ['artworkInfo', artworkAddress] });
    queryClient.invalidateQueries({ queryKey: ['tradeHistory', artworkAddress] });

    return txHash;
  };

  return { sell, hash, isPending, isConfirming, isSuccess, error };
}

// ─── Write: Create artwork ────────────────────────────────────────────────────

export function useCreateArtwork() {
  const factoryAddress = useFactoryAddress();
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const queryClient = useQueryClient();

  const create = async (
    name: string,
    ipfsCID: string,
    listingFee: bigint
  ): Promise<`0x${string}` | null> => {
    if (!factoryAddress) return null;

    const txHash = await writeContractAsync({
      address: factoryAddress,
      abi: ART_FACTORY_ABI,
      functionName: 'createArtworkDefault',
      args: [name, ipfsCID],
      value: listingFee,
    });

    queryClient.invalidateQueries({ queryKey: ['allArtworks'] });
    return txHash;
  };

  return { create, hash, isPending, isConfirming, isSuccess, error };
}

// ─── Write: Admin — withdraw fees ─────────────────────────────────────────────

export function useWithdrawFees() {
  const factoryAddress = useFactoryAddress();
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const withdraw = async (): Promise<`0x${string}` | null> => {
    if (!factoryAddress) return null;
    return writeContractAsync({
      address: factoryAddress,
      abi: ART_FACTORY_ABI,
      functionName: 'withdrawFees',
    });
  };

  return { withdraw, hash, isPending, isConfirming, isSuccess, error };
}

// ─── Write: Admin — set listing fee ──────────────────────────────────────────

export function useSetListingFee() {
  const factoryAddress = useFactoryAddress();
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const setFee = async (newFee: bigint): Promise<`0x${string}` | null> => {
    if (!factoryAddress) return null;
    return writeContractAsync({
      address: factoryAddress,
      abi: ART_FACTORY_ABI,
      functionName: 'setListingFee',
      args: [newFee],
    });
  };

  return { setFee, hash, isPending, isConfirming, isSuccess, error };
}

// ─── Re-export for convenience ────────────────────────────────────────────────

export { deductFees };
