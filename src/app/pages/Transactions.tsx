import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  Tag, 
  Trash2,
  ChevronUp,
  Link2,
  CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as kv from '../lib/kv_client';
import { Transaction, TransactionType } from '../lib/types';
import { toast } from 'sonner';
import { ConfirmationDialog } from '../components/ConfirmationDialog';

export function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date filter state. Default is current month (YYYY-MM).
  const currentDate = new Date();
  const defaultMonthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const [filterMonthYear, setFilterMonthYear] = useState<string>(defaultMonthYear);

  // Form State
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [linkedIncomeId, setLinkedIncomeId] = useState('');

  // Delete Dialog State
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  // Infinite Scroll State
  const [visibleCount, setVisibleCount] = useState(15);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const stored = await kv.getByPrefix('transaction:');
      setTransactions((stored as Transaction[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category) {
      toast.error('Mohon isi jumlah dan kategori');
      return;
    }

    const newTransaction: Transaction = {
      id: `transaction:${Date.now()}`,
      type,
      amount: parseFloat(amount),
      category,
      description,
      date,
      linkedIncomeId: type === 'expense' ? linkedIncomeId : undefined
    };

    try {
      await kv.set(newTransaction.id, newTransaction);
      setTransactions([newTransaction, ...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setIsAdding(false);
      resetForm();
      toast.success('Transaksi ditambahkan!');
    } catch (error) {
      toast.error('Gagal menambahkan transaksi');
    }
  };

  const handleDelete = async () => {
    if (!transactionToDelete) return;
    try {
      await kv.del(transactionToDelete);
      setTransactions(transactions.filter(t => t.id !== transactionToDelete));
      toast.success('Transaksi dihapus');
    } catch (error) {
      toast.error('Gagal menghapus transaksi');
    } finally {
      setTransactionToDelete(null);
    }
  };

  const resetForm = () => {
    setAmount('');
    setCategory('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setLinkedIncomeId('');
  };

  const incomeSources = transactions.filter(t => t.type === 'income');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const formatMonthYear = (dateString: string) => {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(d);
  };

  // 1. Filter Transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesSearch = t.category.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         t.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesDate = true;
    if (filterMonthYear) {
      const tMonthYear = t.date.substring(0, 7); // 'YYYY-MM'
      matchesDate = tMonthYear === filterMonthYear;
    }

    return matchesType && matchesSearch && matchesDate;
  });

  // 2. Group Transactions by Month
  const groupedTransactions = filteredTransactions.reduce((acc, transaction) => {
    const groupKey = formatMonthYear(transaction.date);
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(transaction);
    return acc;
  }, {} as Record<string, Transaction[]>);

  // Flatten the grouped transactions for infinite scroll while keeping track of group headers
  const flattenedList: (Transaction | { isHeader: true, title: string })[] = [];
  Object.entries(groupedTransactions).forEach(([groupKey, groupTransactions]) => {
    flattenedList.push({ isHeader: true, title: groupKey });
    flattenedList.push(...groupTransactions);
  });

  const visibleItems = flattenedList.slice(0, visibleCount);

  // Infinite Scroll Observer
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting) {
      setVisibleCount((prev) => prev + 15);
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "20px",
      threshold: 1.0
    });
    
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    
    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [handleObserver]);

  // Reset infinite scroll when filters change
  useEffect(() => {
    setVisibleCount(15);
  }, [filterType, searchTerm, filterMonthYear]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="space-y-6 pb-20"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Transaksi</h1>
          <p className="text-muted-foreground">Kelola pemasukan dan pengeluaran Anda.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
        >
          {isAdding ? <ChevronUp size={20} /> : <Plus size={20} />}
          {isAdding ? 'Tutup Form' : 'Tambah Transaksi'}
        </button>
      </header>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm mb-6">
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                <Plus size={20} className="text-primary" />
                Catat Transaksi Baru
              </h3>
              <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex p-1 bg-accent rounded-xl w-fit">
                    <button 
                      type="button"
                      onClick={() => setType('expense')}
                      className={`px-6 py-1.5 rounded-lg text-sm font-bold transition-all ${type === 'expense' ? 'bg-white shadow-sm text-rose-600' : 'text-muted-foreground'}`}
                    >
                      Pengeluaran
                    </button>
                    <button 
                      type="button"
                      onClick={() => setType('income')}
                      className={`px-6 py-1.5 rounded-lg text-sm font-bold transition-all ${type === 'income' ? 'bg-white shadow-sm text-emerald-600' : 'text-muted-foreground'}`}
                    >
                      Pemasukan
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Jumlah</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Rp</span>
                      <input 
                        type="number" 
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        className="w-full bg-accent/50 border-none rounded-2xl py-3 pl-10 pr-4 font-black text-xl outline-none focus:ring-2 ring-primary/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Kategori</label>
                    <input 
                      type="text" 
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Misal: Gaji, Makan, Transport"
                      className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tanggal</label>
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Deskripsi (Opsional)</label>
                    <input 
                      type="text" 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Keterangan tambahan..."
                      className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20"
                    />
                  </div>

                  {type === 'expense' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Link2 size={12} /> Hubungkan ke Pemasukan
                      </label>
                      <select 
                        value={linkedIncomeId}
                        onChange={(e) => setLinkedIncomeId(e.target.value)}
                        className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 appearance-none"
                      >
                        <option value="">Pilih Sumber Dana (Opsional)</option>
                        {incomeSources.map(source => (
                          <option key={source.id} value={source.id}>
                            {source.category} ({formatCurrency(source.amount)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button 
                    type="submit"
                    className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black text-lg transition-all hover:bg-primary/90 mt-4"
                  >
                    Simpan Transaksi
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input 
            type="text" 
            placeholder="Cari transaksi..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-card border border-border rounded-2xl py-3 pl-11 pr-4 font-medium outline-none focus:ring-2 ring-primary/20"
          />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <CalendarDays size={18} />
            </div>
            <input 
              type="month" 
              value={filterMonthYear}
              onChange={(e) => setFilterMonthYear(e.target.value)}
              className="bg-card border border-border rounded-2xl py-3 pl-10 pr-4 font-bold outline-none focus:ring-2 ring-primary/20 cursor-pointer h-full min-w-[160px]"
            />
            {filterMonthYear && (
              <button 
                onClick={() => setFilterMonthYear('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                Reset
              </button>
            )}
          </div>

          <div className="flex p-1 bg-card border border-border rounded-2xl w-fit">
            <FilterButton active={filterType === 'all'} onClick={() => setFilterType('all')} label="Semua" />
            <FilterButton active={filterType === 'income'} onClick={() => setFilterType('income')} label="Masuk" />
            <FilterButton active={filterType === 'expense'} onClick={() => setFilterType('expense')} label="Keluar" />
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-card border border-border rounded-3xl shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Memuat data...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Tidak ada transaksi ditemukan untuk bulan ini.</div>
        ) : (
          <div className="divide-y divide-border">
            {visibleItems.map((item, index) => {
              if ('isHeader' in item) {
                return (
                  <div key={`header-${item.title}`} className="bg-accent/40 px-6 py-3 sticky top-0 backdrop-blur-md z-10 border-b border-border">
                    <h3 className="text-sm font-black text-muted-foreground">{item.title}</h3>
                  </div>
                );
              }
              return (
                <TransactionItem 
                  key={item.id} 
                  transaction={item as Transaction} 
                  onDelete={() => setTransactionToDelete(item.id)} 
                  linkedIncome={item.linkedIncomeId ? transactions.find(it => it.id === item.linkedIncomeId) : undefined}
                />
              );
            })}
            
            {visibleCount < flattenedList.length && (
              <div ref={observerTarget} className="p-6 text-center text-muted-foreground text-sm font-medium">
                Memuat lebih banyak...
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmationDialog 
        isOpen={!!transactionToDelete}
        title="Hapus Transaksi"
        message="Apakah Anda yakin ingin menghapus transaksi ini? Data yang sudah dihapus tidak dapat dikembalikan."
        onConfirm={handleDelete}
        onCancel={() => setTransactionToDelete(null)}
      />
    </motion.div>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 sm:py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
    >
      {label}
    </button>
  );
}

function TransactionItem({ transaction, onDelete, linkedIncome }: { transaction: Transaction, onDelete: () => void, linkedIncome?: Transaction }) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="p-4 md:p-6 flex items-center justify-between hover:bg-accent/30 transition-colors group">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl shrink-0 ${transaction.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {transaction.type === 'income' ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-black text-base line-clamp-1">{transaction.category}</h4>
            {linkedIncome && (
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1 font-bold shrink-0">
                <Link2 size={10} /> {linkedIncome.category}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
              <Calendar size={12} /> {new Date(transaction.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {transaction.description && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 line-clamp-1">
                <Tag size={12} /> {transaction.description}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-4 ml-4 shrink-0">
        <div className="text-right">
          <p className={`font-black text-sm sm:text-lg whitespace-nowrap ${transaction.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
            {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
          </p>
        </div>
        <button 
          onClick={onDelete}
          className="p-2 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
