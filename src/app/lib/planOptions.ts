import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { queryKeys } from './queryClient';
import { useAuth } from '../contexts/AuthContext';

export interface PlanOption {
  id: string;
  title: string;
  status: 'planning' | 'active' | 'completed';
  budget_plan_items: { id: string; name: string; category_id: string | null }[];
}

const NO_PLANS: PlanOption[] = [];
const STATUS_ORDER = { active: 0, planning: 1, completed: 2 } as const;

/**
 * Plans an expense can be linked to (expense form "Plan" field).
 * Active first, then planning; completed plans are included only when
 * `includeId` points at one (so an old expense keeps showing its plan).
 * Cached under ['budget_plans', userId, ...] so plan changes refresh it.
 */
export function usePlanOptions(enabled: boolean, includeId?: string | null) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: [...queryKeys.plans(user?.id), 'options'],
    enabled: !!user && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_plans')
        .select('id, title, status, budget_plan_items(id, name, category_id)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlanOption[];
    },
  });
  const all = query.data ?? NO_PLANS;
  const options = all
    .filter(p => p.status !== 'completed' || p.id === includeId)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  return { options, isPending: query.isPending };
}
