import React from 'react';
import { Target } from 'lucide-react';
import { usePlanOptions } from '../../lib/planOptions';

interface Props {
  planId: string;
  itemId: string;
  onChange: (planId: string, itemId: string) => void;
  /** Called with the item's category when an item that has one is picked */
  onItemCategory?: (categoryId: string) => void;
  enabled: boolean;
}

/**
 * "Plan" + "Plan item" fields of the expense form (add and edit).
 * Saved as transactions.budget_plan_id / budget_plan_item_id; Planning sums
 * these expenses as the plan's real spending.
 */
export function PlanLinkFields({ planId, itemId, onChange, onItemCategory, enabled }: Props) {
  const { options } = usePlanOptions(enabled, planId);
  const plan = options.find(p => p.id === planId);
  const items = plan?.budget_plan_items ?? [];

  if (options.length === 0 && !planId) return null;

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
        <Target size={12} /> Plan <span className="font-normal opacity-60">(optional)</span>
      </label>
      <div className={`grid gap-2 ${items.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <select
          value={planId}
          onChange={e => onChange(e.target.value, '')}
          aria-label="Plan"
          className="w-full min-w-0 bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 appearance-none truncate"
        >
          <option value="">No plan</option>
          {options.map(p => (
            <option key={p.id} value={p.id}>
              {p.title}{p.status === 'active' ? '' : ` (${p.status})`}
            </option>
          ))}
        </select>
        {items.length > 0 && (
          <select
            value={itemId}
            onChange={e => {
              const id = e.target.value;
              onChange(planId, id);
              const categoryId = items.find(i => i.id === id)?.category_id;
              if (categoryId && onItemCategory) onItemCategory(categoryId);
            }}
            aria-label="Plan item"
            className="w-full min-w-0 bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 appearance-none truncate"
          >
            <option value="">Any item</option>
            {items.map(i => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
