import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { SplitBillAdd } from './add';
import { SplitBillEdit } from './edit';
import { Split, Plus, Trash2, Calendar, Receipt } from 'lucide-react';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { toast } from 'sonner';

export function SplitBill() {
  const { user } = useAuth();
  const [bills, setBills] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeView, setActiveView] = useState<'list' | 'add' | 'edit'>('list');
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [billToDelete, setBillToDelete] = useState<any>(null);

  const fetchBills = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('split_bills')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    if (data) setBills(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (user && activeView === 'list') fetchBills();
  }, [user, activeView]);

  const handleDelete = async () => {
    if (!billToDelete) return;
    try {
      // Delete details first
      await supabase.from('split_bill_details').delete().eq('split_bill_id', billToDelete.id);
      
      const { error } = await supabase.from('split_bills').delete().eq('id', billToDelete.id);
      if (error) throw error;
      
      toast.success('Split bill deleted successfully');
      setBillToDelete(null);
      fetchBills();
    } catch (e: any) {
      toast.error('Gagal menghapus: ' + e.message);
    }
  };

  const reloadList = () => {
    setActiveView('list');
    setSelectedBill(null);
  };

  if (activeView === 'add') {
    return <SplitBillAdd onClose={reloadList} />;
  }

  if (activeView === 'edit' && selectedBill) {
    return <SplitBillEdit bill={selectedBill} onClose={reloadList} />;
  }

  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Math.round(num));
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
              <Split className="text-primary" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                Split Bills History
              </h1>
              <p className="text-sm font-bold text-muted-foreground mt-1 tracking-wider uppercase">Your recent split transactions</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setActiveView('add')}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground rounded-xl shadow-lg shadow-primary/20 transition-all font-bold group"
        >
          <Plus size={18} className="group-hover:rotate-90 transition-transform" />
          Create New Bill
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-5 border border-border h-32 animate-pulse" />
          ))
        ) : bills.length === 0 ? (
          <div className="col-span-full py-20 text-center text-muted-foreground font-medium flex flex-col items-center">
            <Receipt size={48} className="mb-4 opacity-20" />
            No split bills found. Create one to get started!
          </div>
        ) : (
          bills.map(bill => (
            <div 
              key={bill.id} 
              onClick={() => { setSelectedBill(bill); setActiveView('edit'); }}
              className="bg-card rounded-2xl p-5 border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{bill.title}</h3>
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-1">
                    <Calendar size={12} /> {new Date(bill.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setBillToDelete(bill); }}
                  className="p-2 text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase font-bold text-muted-foreground block mb-1">Grand Total</span>
                <span className="font-black text-xl text-primary">{formatIDR(bill.grand_total)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmationDialog
        isOpen={!!billToDelete}
        onCancel={() => setBillToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Split Bill"
        message={`Are you sure you want to delete "${billToDelete?.title}"? All detailed items within this bill will also be deleted.`}
      />
    </div>
  );
}
