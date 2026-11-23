import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import type { Query } from '@tanstack/react-query';

/**
 * Keeps the last data of the main pages in the browser (localStorage), so a
 * page opened again shows it at once while TanStack Query refreshes it from
 * Supabase in the background (the first request after the server was idle can
 * take several seconds). Same idea as the mobile app's offline copy.
 *
 * Kept small on purpose:
 *   - only the default views: Dashboard, first page of Activity / Plans / Notes,
 *     Activity totals, the month's income list — never search results
 *   - lists are cut to their first page
 *   - thrown away after 24 h (MAX_AGE), on logout (clearPersistedCache) and
 *     whenever CACHE_VERSION changes
 */

const STORAGE_KEY = 'mylui-query-cache';

/** Maximum age of the saved data; older data is dropped and the page waits for the server. */
export const MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * Bump when the shape of a saved query changes (select columns, returned
 * object), so old saved data with the wrong shape is never shown.
 */
export const CACHE_VERSION = '2026-11-23';

const isDefaultList = (filters: unknown) =>
  typeof filters === 'object' && filters !== null && !(filters as Record<string, string>).search;

/** Which queries are saved in the browser (see queryKeys in lib/queryClient.ts). */
export function shouldPersistQuery(query: Query): boolean {
  if (query.state.status !== 'success') return false;
  const [scope, , kind, filters] = query.queryKey as unknown[];
  if (scope === 'transactions') {
    if (kind === 'dashboard-rows' || kind === 'dashboard-recent' || kind === 'stats' || kind === 'month-incomes') return true;
    return kind === 'list' && isDefaultList(filters);
  }
  if (scope === 'budget_plans') {
    return kind === 'dashboard-preview' || (kind === 'list' && isDefaultList(filters));
  }
  if (scope === 'notes') return kind === 'list' && isDefaultList(filters);
  return false;
}

/** Infinite lists are saved with their first page only (older pages load again on scroll). */
function firstPageOnly(client: PersistedClient): PersistedClient {
  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: client.clientState.queries.map((q) => {
        const data = q.state.data as { pages?: unknown[]; pageParams?: unknown[] } | undefined;
        if (!data || !Array.isArray(data.pages) || data.pages.length <= 1) return q;
        return {
          ...q,
          state: { ...q.state, data: { pages: data.pages.slice(0, 1), pageParams: (data.pageParams ?? []).slice(0, 1) } },
        };
      }),
    },
  };
}

export const queryPersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: STORAGE_KEY,
  throttleTime: 1000, // write at most once per second
  serialize: (client) => JSON.stringify(firstPageOnly(client)),
});

// ── Wallets & categories (WalletCategoryContext keeps them in React state, not
// in TanStack Query). The Dashboard needs the category names / colours for its
// donut, so a copy is kept the same way: per user, 24 h, removed on logout. ──

const MASTER_KEY = 'mylui-master-data';

type MasterData = { userId: string; savedAt: number; version: string; wallets?: unknown[]; categories?: unknown[] };

function readMaster(): MasterData | null {
  try {
    const raw = window.localStorage.getItem(MASTER_KEY);
    return raw ? (JSON.parse(raw) as MasterData) : null;
  } catch {
    return null;
  }
}

/** Saved wallets / categories of this user, if still fresh. */
export function readMasterData(userId: string): { wallets?: unknown[]; categories?: unknown[] } | null {
  const saved = readMaster();
  if (!saved || saved.userId !== userId || saved.version !== CACHE_VERSION) return null;
  if (Date.now() - saved.savedAt > MAX_AGE) return null;
  return saved;
}

export function saveMasterData(userId: string, part: { wallets?: unknown[]; categories?: unknown[] }) {
  try {
    const saved = readMaster();
    const base = saved && saved.userId === userId && saved.version === CACHE_VERSION ? saved : { userId };
    window.localStorage.setItem(
      MASTER_KEY,
      JSON.stringify({ ...base, ...part, userId, version: CACHE_VERSION, savedAt: Date.now() }),
    );
  } catch {
    // storage full / blocked: the page simply waits for the server next time
  }
}

/** Remove the saved data (logout / session ended). */
export function clearPersistedCache() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(MASTER_KEY);
  } catch {
    // storage blocked (private mode): nothing was saved
  }
}
