import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { fetchAllRows, queryKeys } from './queryClient';
import { useAuth } from '../contexts/AuthContext';

/**
 * Real spending per budget plan: the sum of EXPENSES linked to the plan through
 * transactions.budget_plan_id (and per item through budget_plan_item_id).
 * Cached under ['transactions', userId, ...] so adding/editing/deleting a
 * transaction refreshes it.
 */
export interface PlanSpending {
  spent: number;                     // all linked expenses
  byItem: Record<string, number>;    // budget_plan_item_id → spent
  unitemized: number;                // linked to the plan but not to an item
  count: number;                     // number of linked expenses
}

type Row = { budget_plan_id: string; budget_plan_item_id: string | null; amount: number };

const EMPTY: PlanSpending = { spent: 0, byItem: {}, unitemized: 0, count: 0 };
const NO_SPENDING: Record<string, PlanSpending> = {};

export function usePlanSpending() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: [...queryKeys.transactions(user?.id), 'plan-spending'],
    enabled: !!user,
    queryFn: async () => {
      const rows = await fetchAllRows<Row>(() =>
        supabase
          .from('transactions')
          .select('budget_plan_id, budget_plan_item_id, amount')
          .eq('user_id', user!.id)
          .eq('type', 'expense')
          .not('budget_plan_id', 'is', null)
          .order('date', { ascending: true })
          .order('id', { ascending: true })
      );
      const byPlan: Record<string, PlanSpending> = {};
      for (const r of rows) {
        const s = (byPlan[r.budget_plan_id] ??= { spent: 0, byItem: {}, unitemized: 0, count: 0 });
        const amount = Number(r.amount ?? 0);
        s.spent += amount;
        s.count++;
        if (r.budget_plan_item_id) s.byItem[r.budget_plan_item_id] = (s.byItem[r.budget_plan_item_id] ?? 0) + amount;
        else s.unitemized += amount;
      }
      return byPlan;
    },
  });
  const data = query.data ?? NO_SPENDING;
  return {
    spendingOf: (planId: string): PlanSpending => data[planId] ?? EMPTY,
    isPending: query.isPending,
    isError: query.isError,
  };
}

export interface PlanTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  budget_plan_item_id: string | null;
  transaction_category: { name: string; color: string; icon: string } | null;
}

/** Expenses linked to one plan, newest first (plan detail "Spending" list, up to 100) */
export function usePlanTransactions(planId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.transactions(user?.id), 'plan-transactions', planId],
    enabled: !!user && !!planId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, description, amount, date, budget_plan_item_id, transaction_category:transaction_categories!category_id(name,color,icon)')
        .eq('user_id', user!.id)
        .eq('type', 'expense')
        .eq('budget_plan_id', planId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as PlanTransaction[];
    },
  });
}
