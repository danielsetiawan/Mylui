import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { queryKeys } from './queryClient';
import { useAuth } from '../contexts/AuthContext';

/**
 * Shortcuts for the transaction form, learned from your latest transactions:
 *  - walletOrder / categoryOrder: ids, most used first (chips are shown in this order)
 *  - lastWalletId: wallet of your most recent income/expense (pre-selected in a new form)
 *  - guessCategory(description, type): category you used most for the same description
 * Cached under ['transactions', userId, ...] so it refreshes after saving a transaction.
 */
type Row = {
  type: 'income' | 'expense' | 'transfer';
  wallet_id: string | null;
  category_id: string | null;
  description: string | null;
};

const SAMPLE_SIZE = 500;
const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');
const firstWord = (text: string) => normalize(text).split(' ')[0] ?? '';

const byCount = (counts: Map<string, number>) =>
  [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);

export function useEntryHints(enabled: boolean) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: [...queryKeys.transactions(user?.id), 'entry-hints'],
    enabled: !!user && enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('type, wallet_id, category_id, description')
        .eq('user_id', user!.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(SAMPLE_SIZE);
      if (error) throw error;
      const rows = (data ?? []) as Row[];

      const walletCount = new Map<string, number>();
      const categoryCount = new Map<string, number>();
      // description → category → count, per type; also the same by first word
      const exact = new Map<string, Map<string, number>>();
      const word = new Map<string, Map<string, number>>();
      const bump = (m: Map<string, Map<string, number>>, key: string, cat: string) => {
        const inner = m.get(key) ?? new Map<string, number>();
        inner.set(cat, (inner.get(cat) ?? 0) + 1);
        m.set(key, inner);
      };

      let lastWalletId: string | null = null;
      for (const r of rows) {
        if (r.wallet_id) {
          walletCount.set(r.wallet_id, (walletCount.get(r.wallet_id) ?? 0) + 1);
          if (!lastWalletId && r.type !== 'transfer') lastWalletId = r.wallet_id;
        }
        if (r.category_id) {
          categoryCount.set(r.category_id, (categoryCount.get(r.category_id) ?? 0) + 1);
          const d = r.description ? normalize(r.description) : '';
          if (d) {
            bump(exact, `${r.type}|${d}`, r.category_id);
            const w = firstWord(d);
            if (w.length >= 3) bump(word, `${r.type}|${w}`, r.category_id);
          }
        }
      }
      return {
        walletOrder: byCount(walletCount),
        categoryOrder: byCount(categoryCount),
        lastWalletId,
        exact,
        word,
      };
    },
  });

  const guessCategory = (description: string, type: 'income' | 'expense'): string | null => {
    if (!data) return null;
    const d = normalize(description);
    if (d.length < 3) return null;
    const hit = data.exact.get(`${type}|${d}`) ?? data.word.get(`${type}|${firstWord(d)}`);
    return hit ? byCount(hit)[0] ?? null : null;
  };

  return {
    walletOrder: data?.walletOrder ?? [],
    categoryOrder: data?.categoryOrder ?? [],
    lastWalletId: data?.lastWalletId ?? null,
    guessCategory,
  };
}
