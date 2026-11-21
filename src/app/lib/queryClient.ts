import { QueryClient } from '@tanstack/react-query';

/**
 * Cache data server (TanStack Query).
 *
 * staleTime 0: data di cache langsung ditampilkan saat halaman dibuka lagi,
 * lalu diperbarui di belakang layar. Jadi halaman tidak pernah mulai dari
 * kosong, tetapi juga tidak pernah menampilkan data lama terlalu lama.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 30 * 60 * 1000,
      retry: 1,
    },
  },
});

/**
 * Query key. Semua yang berasal dari tabel `transactions` diawali
 * ['transactions', userId] supaya bisa di-invalidate sekaligus setelah
 * tambah/ubah/hapus transaksi.
 */
export const queryKeys = {
  transactions: (userId?: string) => ['transactions', userId] as const,
  transactionList: (userId: string | undefined, filters: Record<string, string>) =>
    ['transactions', userId, 'list', filters] as const,
  transactionLists: (userId?: string) => ['transactions', userId, 'list'] as const,
  transactionStats: (userId: string | undefined, filters: Record<string, string>) =>
    ['transactions', userId, 'stats', filters] as const,
  monthIncomes: (userId: string | undefined, month: string) =>
    ['transactions', userId, 'month-incomes', month] as const,
  dashboardRows: (userId: string | undefined, month: string) =>
    ['transactions', userId, 'dashboard-rows', month] as const,
  dashboardRecent: (userId?: string) => ['transactions', userId, 'dashboard-recent'] as const,
  dashboardPlans: (userId?: string) => ['budget_plans', userId, 'dashboard-preview'] as const,
  // Everything from budget_plans starts with ['budget_plans', userId] so one invalidate refreshes it all
  plans: (userId?: string) => ['budget_plans', userId] as const,
  planList: (userId: string | undefined, filters: Record<string, string>) =>
    ['budget_plans', userId, 'list', filters] as const,
};

// PostgREST membatasi jumlah baris per request (default Supabase: 1000).
const ROWS_PER_REQUEST = 1000;

/**
 * Mengambil semua baris sebuah query dengan membaginya per 1000 baris.
 * `build` harus mengembalikan query baru yang urutannya stabil (pakai .order).
 */
export async function fetchAllRows<T>(build: () => any): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += ROWS_PER_REQUEST) {
    const { data, error } = await build().range(from, from + ROWS_PER_REQUEST - 1);
    if (error) throw error;
    if (data) rows.push(...(data as T[]));
    if (!data || data.length < ROWS_PER_REQUEST) break;
  }
  return rows;
}
