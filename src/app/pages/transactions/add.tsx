import React, { useState } from 'react';
import { Plus, Link2, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Transaction, TransactionType } from '../../lib/types';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  incomeSources: Transaction[];
  formatCurrency: (val: number) => string;
}

export function TransactionAdd({ isOpen, onClose, onSuccess, incomeSources, formatCurrency }: Props) {
  const { user } = useAuth();
  
  // Local state
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [linkedIncomeId, setLinkedIncomeId] = useState('');

  const resetForm = () => {
    setAmount('');
    setCategory('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setLinkedIncomeId('');
    setType('expense');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category || !user) {
      toast.error('Please fill in amount and category');
      return;
    }

    try {
      const payload: any = {
        user_id: user.id,
        type,
        amount: parseFloat(amount),
        category,
        description,
        date,
      };
      if (type === 'expense' && linkedIncomeId) {
        payload.linked_income_id = linkedIncomeId;
      }

      const { error } = await supabase
        .from('transactions')
        .insert(payload)
        .select('*, transaction_details(*)')
        .single();

      if (error) throw error;

      resetForm();
      onSuccess();
      toast.success('Transaction added!');
    } catch (error: any) {
      toast.error('Failed to add transaction: ' + error.message);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm mb-6">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
              <Plus size={20} className="text-primary" />
              Record New Transaction
            </h3>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex p-1 bg-accent rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`px-6 py-1.5 rounded-lg text-sm font-bold transition-all ${type === 'expense' ? 'bg-white shadow-sm text-rose-600' : 'text-muted-foreground'}`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`px-6 py-1.5 rounded-lg text-sm font-bold transition-all ${type === 'income' ? 'bg-white shadow-sm text-emerald-600' : 'text-muted-foreground'}`}
                  >
                    Income
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Rp</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      min="0"
                      className="w-full bg-accent/50 border-none rounded-2xl py-3 pl-10 pr-4 font-black text-xl outline-none focus:ring-2 ring-primary/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Note (Category)</label>
                  <textarea
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Salary, Food, Transport"
                    rows={2}
                    className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 resize-none"
                  />
                </div>

                {type === 'expense' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Link2 size={12} /> Link to Income
                    </label>
                    <select
                      value={linkedIncomeId}
                      onChange={(e) => setLinkedIncomeId(e.target.value)}
                      className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 appearance-none"
                    >
                      <option value="">Select Funding Source (Optional)</option>
                      {incomeSources.map(source => (
                        <option key={source.id} value={source.id}>
                          {source.category} ({formatCurrency(source.amount)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date</label>
                  <input
                    type="date"
                    value={date}
                    onClick={(e) => { (e.target as any).showPicker && (e.target as any).showPicker(); }}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20"
                  />
                </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Additional Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 resize-none"
                    />
                  </div>

                <button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black text-lg transition-all hover:bg-primary/90 mt-4"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
