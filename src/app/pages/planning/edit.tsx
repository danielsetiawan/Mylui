import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { BudgetPlan, BudgetPlanItem } from '../../lib/types';
import { toast } from 'sonner';
import { useWalletCategory } from '../../contexts/WalletCategoryContext';

interface Props {
  plan: BudgetPlan | null;
  onClose: () => void;
  onSuccess: () => void;
  formatCurrency: (val: number) => string;
}

export function PlanningEdit({ plan, onClose, onSuccess, formatCurrency }: Props) {
  const { categories } = useWalletCategory();
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [nominalBudget, setNominalBudget] = useState('');
  const [newItems, setNewItems] = useState<Partial<BudgetPlanItem>[]>([]);

  useEffect(() => {
    if (plan) {
      setTitle(plan.title);
      setDescription(plan.description);
      setNominalBudget(plan.total_budget ? plan.total_budget.toString() : '');
      setNewItems(plan.budget_plan_items || []);
    }
  }, [plan]);

  const handleEditPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || !title) {
      toast.error('Title cannot be empty');
      return;
    }

    const explicitBudget = parseFloat(nominalBudget.replace(/\D/g, '')) || 0;
    const validItems = newItems.filter(item => item.name && item.estimate);
    const calculatedBudget = validItems.reduce((acc, item) => acc + (parseFloat(item.estimate!.toString()) || 0), 0);
    const finalBudget = explicitBudget > 0 ? explicitBudget : calculatedBudget;

    // Save only what changed, instead of deleting every item and inserting them again
    // (that lost all items if the insert failed, and changed every item id).
    // Order: update → insert → delete, so a failure part-way leaves extra items, never missing ones.
    const original = plan.budget_plan_items || [];
    const originalById = new Map(original.map(o => [o.id, o]));
    const kept = validItems.filter(i => i.id && originalById.has(i.id));
    const toUpdate = kept.filter(i => {
      const o = originalById.get(i.id!)!;
      return o.name !== i.name || Number(o.estimate) !== parseFloat(i.estimate!.toString()) || (o.category_id || null) !== (i.category_id || null);
    });
    const toInsert = validItems.filter(i => !i.id || !originalById.has(i.id));
    const keptIds = new Set(kept.map(i => i.id));
    const toDelete = original.filter(o => !keptIds.has(o.id)).map(o => o.id);

    try {
      const { error: planError } = await supabase
        .from('budget_plans')
        .update({ title, description, total_budget: finalBudget })
        .eq('id', plan.id);
      if (planError) throw planError;

      const updates = await Promise.all(toUpdate.map(item =>
        supabase.from('budget_plan_items')
          .update({ name: item.name!, estimate: parseFloat(item.estimate!.toString()), category_id: item.category_id || null })
          .eq('id', item.id!)
      ));
      const updateError = updates.find(r => r.error)?.error;
      if (updateError) throw updateError;

      if (toInsert.length > 0) {
        const { error: itemsError } = await supabase.from('budget_plan_items').insert(
          toInsert.map(item => ({ plan_id: plan.id, name: item.name!, estimate: parseFloat(item.estimate!.toString()), category_id: item.category_id || null }))
        );
        if (itemsError) throw itemsError;
      }

      if (toDelete.length > 0) {
        const { error: deleteError } = await supabase.from('budget_plan_items').delete().in('id', toDelete);
        if (deleteError) throw deleteError;
      }

      toast.success('Plan updated successfully!');
      onSuccess();
    } catch (error: any) {
      toast.error('Failed to update plan: ' + error.message);
    }
  };

  const addItem = () => setNewItems([...newItems, { name: '', estimate: 0 }]);
  const updateItem = (index: number, field: keyof BudgetPlanItem, value: any) => {
    const updated = [...newItems];
    updated[index] = { ...updated[index], [field]: value };
    setNewItems(updated);
  };
  const removeItem = (index: number) => setNewItems(newItems.filter((_, i) => i !== index));

  return (
    <AnimatePresence>
      {plan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
          <motion.div 
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-card border border-border rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h3 className="text-xl font-black">Edit Plan</h3>
              <button onClick={onClose} className="p-2 hover:bg-accent rounded-full">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditPlan} className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-muted-foreground">Plan Title</label>
                  <input 
                    type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Bali Vacation, Room Renovation"
                    className="w-full bg-field border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-muted-foreground">Total Budget Plan</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Rp</span>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      value={nominalBudget.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} 
                      onChange={(e) => setNominalBudget(e.target.value.replace(/\D/g, ''))}
                      placeholder="Total budget (uses item total if left empty)"
                      className="w-full bg-field border-none rounded-2xl py-3 pl-10 pr-4 font-bold outline-none focus:ring-2 ring-primary/20"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-muted-foreground">Short Description</label>
                  <input 
                    type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="Additional notes..."
                    className="w-full bg-field border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-muted-foreground">Budget Items (Estimate)</label>
                  <button type="button" onClick={addItem} className="text-primary text-xs font-black flex items-center gap-1 hover:underline">
                    <Plus size={14} /> Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {newItems.length === 0 && (
                    <p className="text-sm text-center py-6 text-muted-foreground bg-accent/30 rounded-2xl border border-dashed border-border">No budget items yet.</p>
                  )}
                  {newItems.map((item, index) => (
                    <div key={index} className="flex gap-3 items-center">
                      <div className="flex-1">
                        <input 
                          type="text" value={item.name || ''}
                          onChange={(e) => updateItem(index, 'name', e.target.value)}
                          placeholder="Item name (e.g. Flight Ticket)"
                          className="w-full bg-field border-none rounded-xl py-2 px-3 text-sm font-bold outline-none"
                        />
                      </div>
                      {/* Category: gives the item its icon and pre-fills linked expenses */}
                      <div className="w-32 sm:w-40 shrink-0">
                        <select
                          value={item.category_id || ''}
                          onChange={(e) => updateItem(index, 'category_id', e.target.value || null)}
                          aria-label="Item category"
                          className="w-full bg-field border-none rounded-xl py-2 px-3 text-sm font-bold outline-none appearance-none truncate"
                        >
                          <option value="">No category</option>
                          {expenseCategories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-28 sm:w-36 shrink-0">
                        <input 
                          type="text"
                          inputMode="numeric"
                          value={item.estimate?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') || ''}
                          onChange={(e) => updateItem(index, 'estimate', e.target.value.replace(/\D/g, ''))}
                          placeholder="0"
                          className="w-full bg-field border-none rounded-xl py-2 px-3 text-sm font-black outline-none pl-3"
                        />
                      </div>
                      <button type="button" onClick={() => removeItem(index)} className="p-2 text-muted-foreground hover:text-rose-600 transition-colors">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-border mt-4">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-sm font-bold text-muted-foreground">Total Budget:</span>
                  <span className="text-2xl font-black text-primary">
                    {formatCurrency(
                      nominalBudget 
                        ? parseFloat(nominalBudget.replace(/\D/g, ''))
                        : newItems.reduce((acc, item) => acc + (parseFloat(item.estimate?.toString() || '0') || 0), 0)
                    )}
                  </span>
                </div>
                <button type="submit" className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black text-lg transition-all hover:bg-primary/90">
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
