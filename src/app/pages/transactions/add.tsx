import React, { useState, useEffect } from 'react';
import { Plus, ArrowRightLeft, Link2, ListTree, X, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Transaction, TransactionType } from '../../lib/types';
import { useWalletCategory } from '../../contexts/WalletCategoryContext';
import { QuickSelectWithAdd } from '../../components/QuickSelectWithAdd';
import { useMonthRange } from '../../contexts/MonthRangeContext';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  formatCurrency: (val: number) => string;
}

type TabType = 'expense' | 'income' | 'transfer';

// Local (not UTC) date/month, so the defaults are right around midnight in WIB
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const thisMonthLocal = () => todayLocal().substring(0, 7);

// An income counts as salary when its category, description or legacy category says so
const SALARY_PATTERN = /\b(gaji|salary)\b/i;

export function TransactionAdd({ isOpen, onClose, onSuccess, formatCurrency }: Props) {
  const { user } = useAuth();
  const { wallets, categories, addWallet, addCategory } = useWalletCategory();

  const [tab, setTab] = useState<TabType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [walletId, setWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayLocal);
  const [linkedIncomeId, setLinkedIncomeId] = useState('');
  // true once the user picks a linked income (or "Not linked") themselves
  const [linkTouched, setLinkTouched] = useState(false);
  const [incomeMonth, setIncomeMonth] = useState(thisMonthLocal);
  const [localIncomeSources, setLocalIncomeSources] = useState<Transaction[]>([]);
  const { monthOptions } = useMonthRange();

  // Details state
  const [details, setDetails] = useState<{ name: string; amount: number | '' }[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!user || tab !== 'expense' || !isOpen) return;
    const fetchIncomes = async () => {
      const parts = incomeMonth.split('-');
      const year = parseInt(parts[0]); const month = parseInt(parts[1]);
      const lastDay = new Date(year, month, 0).getDate();
      const { data } = await supabase
        .from('transactions').select('*').eq('user_id', user.id).eq('type', 'income')
        .gte('date', `${incomeMonth}-01`).lte('date', `${incomeMonth}-${lastDay}`)
        .order('date', { ascending: false });
      if (data) setLocalIncomeSources(data as Transaction[]);
    };
    fetchIncomes();
  }, [incomeMonth, tab, user, isOpen]);

  // Default "Link to Income" for a new expense: this month's salary ("Gaji").
  // Only while the user has not chosen anything themselves.
  useEffect(() => {
    if (tab !== 'expense' || !isOpen || linkTouched || linkedIncomeId) return;
    if (incomeMonth !== thisMonthLocal()) return;
    const categoryName = new Map(categories.map(c => [c.id, c.name]));
    // localIncomeSources is newest first, so this picks the latest salary of the month
    const salary = localIncomeSources.find(src =>
      SALARY_PATTERN.test(
        [src.category_id ? categoryName.get(src.category_id) : '', src.description, src.category].filter(Boolean).join(' ')
      )
    );
    if (salary) setLinkedIncomeId(salary.id);
  }, [localIncomeSources, categories, incomeMonth, tab, isOpen, linkTouched, linkedIncomeId]);

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  const resetForm = () => {
    setAmount(''); setCategoryId(''); setWalletId('');
    setToWalletId(''); setDescription(''); setLinkedIncomeId('');
    setLinkTouched(false); setIncomeMonth(thisMonthLocal());
    setDate(todayLocal());
    setDetails([]); setShowDetails(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount) { toast.error('Please fill in the amount'); return; }

    if (tab !== 'transfer' && !walletId) { toast.error('Please select a wallet'); return; }
    if (tab === 'transfer' && (!walletId || !toWalletId)) { toast.error('Please select both wallets'); return; }
    if (tab === 'transfer' && walletId === toWalletId) { toast.error('From and To wallet cannot be the same'); return; }

    try {
      const numAmount = parseInt(amount, 10);
      const payload: any = {
        user_id: user.id,
        type: tab as TransactionType,
        amount: numAmount,
        category: '',  // legacy field, kept blank
        description,
        date,
        wallet_id: walletId || null,
        to_wallet_id: tab === 'transfer' ? (toWalletId || null) : null,
        category_id: tab !== 'transfer' ? (categoryId || null) : null,
        linked_income_id: tab === 'expense' ? (linkedIncomeId || null) : null,
      };

      const { data: txData, error } = await supabase
        .from('transactions')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      // Insert details if any
      const validDetails = details.filter(d => d.name.trim() && d.amount !== '');
      if (validDetails.length > 0 && txData) {
        await supabase.from('transaction_details').insert(
          validDetails.map(d => ({ transaction_id: txData.id, name: d.name, amount: d.amount }))
        );
      }

      resetForm();
      onSuccess();
      toast.success(tab === 'transfer' ? 'Transfer recorded!' : 'Transaction added!');
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    }
  };

  const tabStyle = (t: TabType) =>
    `px-5 py-1.5 rounded-lg text-sm font-bold transition-all ${tab === t
      ? t === 'income' ? 'bg-white shadow-sm text-emerald-600'
        : t === 'transfer' ? 'bg-white shadow-sm text-blue-600'
          : 'bg-white shadow-sm text-rose-600'
      : 'text-muted-foreground hover:text-foreground'}`;

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
            <h3 className="font-bold text-lg mb-5 flex items-center gap-2">
              <Plus size={20} className="text-primary" /> Record New Activity
            </h3>

            {/* Tab Switcher */}
            <div className="flex p-1 bg-accent rounded-xl w-fit mb-6 gap-0.5">
              <button type="button" onClick={() => setTab('expense')} className={tabStyle('expense')}>Expense</button>
              <button type="button" onClick={() => setTab('income')} className={tabStyle('income')}>Income</button>
              <button type="button" onClick={() => setTab('transfer')} className={tabStyle('transfer')}>
                <span className="flex items-center gap-1"><Repeat size={14} /> Transfer</span>
              </button>
            </div>

            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* --- LEFT COLUMN --- */}
              <div className="space-y-4">
                {/* Amount */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Rp</span>
                    <input
                      type="text" inputMode="numeric"
                      value={amount.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                      onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
                      placeholder="0"
                      className="w-full bg-accent/50 border-none rounded-2xl py-3 pl-10 pr-4 font-black text-xl outline-none focus:ring-2 ring-primary/20"
                    />
                  </div>
                </div>

                {/* Wallet From */}
                <QuickSelectWithAdd
                  label={tab === 'transfer' ? 'From Wallet' : 'Wallet'}
                  value={walletId}
                  options={wallets}
                  onChange={setWalletId}
                  onAdd={async (name) => addWallet({ name, icon: 'Wallet', color: '#10b981', balance: 0 })}
                  placeholder="Select wallet..."
                  required
                />

                {/* To Wallet — only for Transfer */}
                {tab === 'transfer' && (
                  <QuickSelectWithAdd
                    label="To Wallet"
                    value={toWalletId}
                    options={wallets.filter(w => w.id !== walletId)}
                    onChange={setToWalletId}
                    onAdd={async (name) => addWallet({ name, icon: 'Wallet', color: '#3b82f6', balance: 0 })}
                    placeholder="Select destination..."
                    required
                  />
                )}

                {/* Category — only for Income/Expense */}
                {tab !== 'transfer' && (
                  <QuickSelectWithAdd
                    label="Category"
                    value={categoryId}
                    options={tab === 'expense' ? expenseCategories : incomeCategories}
                    onChange={setCategoryId}
                    onAdd={async (name) => addCategory({ name, icon: 'Tag', color: '#64748b', type: tab })}
                    placeholder="Select category..."
                  />
                )}

                {/* Link to Income — only for expense */}
                {tab === 'expense' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                        <Link2 size={12} /> Link to Income <span className="font-normal opacity-60">(optional)</span>
                      </label>
                      <select
                        value={incomeMonth}
                        onChange={e => {
                          // A different month has different incomes; drop the old choice
                          setIncomeMonth(e.target.value);
                          setLinkedIncomeId('');
                          setLinkTouched(true);
                        }}
                        aria-label="Income month"
                        className="text-xs font-bold bg-accent/50 border-none rounded-lg py-1 px-2 outline-none appearance-none cursor-pointer"
                      >
                        {monthOptions.map(({ value, label }) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <select
                      value={linkedIncomeId}
                      onChange={e => { setLinkedIncomeId(e.target.value); setLinkTouched(true); }}
                      aria-label="Linked income"
                      className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 appearance-none"
                    >
                      <option value="">Not linked</option>
                      {localIncomeSources.map(src => (
                        <option key={src.id} value={src.id}>
                          {src.description || src.category} ({formatCurrency(src.amount)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* --- RIGHT COLUMN --- */}
              <div className="space-y-4">
                {/* Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Date</label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-accent/50 rounded-2xl py-3 px-4 font-bold flex items-center pointer-events-none">
                      {date.split('-').reverse().join('/')}
                    </div>
                    <input
                      type="date" value={date}
                      onChange={e => setDate(e.target.value)}
                      onClick={e => { (e.target as any).showPicker?.(); }}
                      className="w-full bg-transparent border-none rounded-2xl py-3 px-4 font-bold outline-none opacity-0 cursor-pointer h-[52px]"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Description / Notes</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={3}
                    placeholder={tab === 'transfer' ? 'Transfer note (optional)' : 'Additional note (optional)'}
                    className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 resize-none"
                  />
                </div>

                {/* Details Toggle — only for income/expense */}
                {tab !== 'transfer' && (
                  <button
                    type="button"
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-xs font-bold text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    <ListTree size={14} /> {showDetails ? 'Hide' : 'Add'} Detail Items {details.length > 0 ? `(${details.length})` : ''}
                  </button>
                )}

                <button type="submit" className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black text-base transition-all hover:bg-primary/90">
                  {tab === 'transfer' ? 'Record Transfer' : 'Save Transaction'}
                </button>
              </div>
            </form>

            {/* Details panel */}
            <AnimatePresence>
              {showDetails && tab !== 'transfer' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-5"
                >
                  <div className="border-t border-border pt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">Detail Items</span>
                      <button
                        type="button"
                        onClick={() => setDetails([{ name: '', amount: '' }, ...details])}
                        className="text-primary text-xs font-black flex items-center gap-1 bg-primary/10 px-2 py-1 rounded"
                      >
                        <Plus size={14} /> Add Row
                      </button>
                    </div>
                    <div className="space-y-2">
                      {details.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 bg-accent/20 p-2 rounded-xl">
                          <div className="relative flex items-center w-32 shrink-0">
                            <span className="absolute left-3 text-xs font-black text-muted-foreground">Rp</span>
                            <input
                              type="text" inputMode="numeric"
                              value={d.amount ? d.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                              onChange={e => { const a = [...details]; a[i].amount = parseInt(e.target.value.replace(/\D/g, ''), 10) || ''; setDetails(a); }}
                              placeholder="0"
                              className="w-full bg-background border border-border rounded-lg py-2 pl-8 pr-2 text-sm font-black outline-none focus:border-primary"
                            />
                          </div>
                          <input
                            type="text" value={d.name}
                            onChange={e => { const a = [...details]; a[i].name = e.target.value; setDetails(a); }}
                            placeholder="Description..."
                            className="flex-1 bg-background border border-border rounded-lg py-2 px-3 text-sm font-semibold outline-none focus:border-primary"
                          />
                          <button type="button" onClick={() => setDetails(details.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-rose-500 p-1.5 rounded-lg">
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      {details.length === 0 && <p className="text-xs text-muted-foreground italic">Click "Add Row" to add a detail.</p>}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
