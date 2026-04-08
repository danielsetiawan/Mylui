import React, { useState } from 'react';
import { Plus, Link2, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Transaction, TransactionType } from '../../lib/types';
import { toast } from 'sonner';

import { useMonthRange } from '../../contexts/MonthRangeContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  formatCurrency: (val: number) => string;
}

export function TransactionAdd({ isOpen, onClose, onSuccess, formatCurrency }: Props) {
  const { user } = useAuth();
  const { monthOptions } = useMonthRange();

  // Local state
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [linkedIncomeId, setLinkedIncomeId] = useState('');

  // Income Sources State
  const [incomeMonth, setIncomeMonth] = useState(new Date().toISOString().substring(0, 7));
  const [localIncomeSources, setLocalIncomeSources] = useState<Transaction[]>([]);

  React.useEffect(() => {
    if (!user || type !== 'expense' || !isOpen) return;

    const fetchIncomes = async () => {
      const parts = incomeMonth.split('-');
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const lastDay = new Date(year, month, 0).getDate();

      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .gte('date', `${incomeMonth}-01`)
        .lte('date', `${incomeMonth}-${lastDay}`)
        .order('date', { ascending: false });

      if (data) setLocalIncomeSources(data as Transaction[]);
    };

    fetchIncomes();
  }, [incomeMonth, type, user, isOpen]);

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
              Record New Activity
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
                  <label className="text-xs font-bold text-muted-foreground">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={amount.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                      onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                      placeholder="0"
                      className="w-full bg-accent/50 border-none rounded-2xl py-3 pl-10 pr-4 font-black text-xl outline-none focus:ring-2 ring-primary/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">Note (Category)</label>
                  <textarea
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Salary, Food, Transport"
                    rows={2}
                    className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 resize-none"
                  />
                </div>

                {type === 'expense' && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                        <Link2 size={12} /> Link to Income
                      </label>
                      <select
                        value={incomeMonth}
                        onChange={(e) => setIncomeMonth(e.target.value)}
                        className="bg-accent/50 border-none rounded-xl py-1.5 px-3 pr-8 text-xs font-bold outline-none focus:ring-2 ring-primary/20 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20fill%3D%22none%22%20stroke%3D%22%23717182%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.2em_1.2em] bg-[right_0.5rem_center] bg-no-repeat cursor-pointer"
                      >
                        {monthOptions.map(({ value, label }) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <select
                      value={linkedIncomeId}
                      onChange={(e) => setLinkedIncomeId(e.target.value)}
                      className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 appearance-none"
                    >
                      <option value="">Select Funding Source (Optional)</option>
                      {localIncomeSources.map(source => (
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
                  <label className="text-xs font-bold text-muted-foreground">Date</label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-accent/50 rounded-2xl py-3 px-4 font-bold flex items-center pointer-events-none peer-focus:ring-2 ring-primary/20">
                      {date.split('-').reverse().join('/')}
                    </div>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      onClick={(e) => { (e.target as any).showPicker && (e.target as any).showPicker(); }}
                      className="w-full bg-transparent border-none rounded-2xl py-3 px-4 font-bold outline-none opacity-0 cursor-pointer h-[52px]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">Additional Description</label>
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
