/**
 * Indexer API Client
 *
 * Wraps all calls to the indexer REST API.
 * Automatically falls back to direct RPC reads if indexer is unavailable.
 *
 * API Base URL: NEXT_PUBLIC_INDEXER_URL (e.g. http://localhost:3001)
 */

import type { ApiArtwork, ApiTrade, ApiStats, PaginatedResponse } from '../../shared/types';
import { config } from './config';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ArtworkSortOption = 'trending' | 'newest' | 'price' | 'graduating' | 'graduated';

export interface GetArtworksParams {
  sort?: ArtworkSortOption;
  page?: number;
  limit?: number;
  search?: string;
  artist?: string;
}

// ─── Base fetch with timeout ──────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 8_000;

async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const url = `${config.indexerUrl}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new ApiError(res.status, text);
    }

    return (await res.json()) as T;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new ApiError(408, 'Request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Artwork endpoints ────────────────────────────────────────────────────────

/** Fetch paginated artwork list from indexer */
export async function getArtworks(
  params: GetArtworksParams = {}
): Promise<PaginatedResponse<ApiArtwork>> {
  const { sort = 'trending', page = 1, limit = 20, search, artist } = params;
  const query = new URLSearchParams({
    sort,
    page: String(page),
    limit: String(limit),
    ...(search && { search }),
    ...(artist && { artist }),
  });
  return apiFetch<PaginatedResponse<ApiArtwork>>(`/api/artworks?${query}`);
}

/** Fetch single artwork detail */
export async function getArtwork(address: string): Promise<ApiArtwork> {
  return apiFetch<ApiArtwork>(`/api/artworks/${address.toLowerCase()}`);
}

// ─── Trade endpoints ──────────────────────────────────────────────────────────

/** Fetch trade history for a specific artwork */
export async function getArtworkTrades(
  address: string,
  params: { page?: number; limit?: number } = {}
): Promise<PaginatedResponse<ApiTrade>> {
  const { page = 1, limit = 50 } = params;
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch<PaginatedResponse<ApiTrade>>(
    `/api/artworks/${address.toLowerCase()}/trades?${query}`
  );
}

// ─── Stats endpoint ───────────────────────────────────────────────────────────

/** Fetch platform-wide stats */
export async function getPlatformStats(): Promise<ApiStats> {
  return apiFetch<ApiStats>('/api/stats');
}

// ─── Health check ─────────────────────────────────────────────────────────────

/** Check if the indexer is alive */
export async function pingIndexer(): Promise<boolean> {
  try {
    await apiFetch('/health', undefined, 3_000);
    return true;
  } catch {
    return false;
  }
}
