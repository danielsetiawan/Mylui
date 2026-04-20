import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Wallet, TransactionCategory } from '../lib/types';
import { useAuth } from './AuthContext';

interface WalletCategoryContextType {
  wallets: Wallet[];
  categories: TransactionCategory[];
  loadingWallets: boolean;
  loadingCategories: boolean;
  refreshWallets: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  addWallet: (data: Omit<Wallet, 'id' | 'user_id' | 'created_at'>) => Promise<Wallet | null>;
  addCategory: (data: Omit<TransactionCategory, 'id' | 'user_id' | 'created_at'>) => Promise<TransactionCategory | null>;
}

const WalletCategoryContext = createContext<WalletCategoryContextType | undefined>(undefined);

export function WalletCategoryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const refreshWallets = useCallback(async () => {
    if (!user) return;
    setLoadingWallets(true);
    const { data } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (data) setWallets(data as Wallet[]);
    setLoadingWallets(false);
  }, [user]);

  const refreshCategories = useCallback(async () => {
    if (!user) return;
    setLoadingCategories(true);
    const { data } = await supabase
      .from('transaction_categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true });
    if (data) setCategories(data as TransactionCategory[]);
    setLoadingCategories(false);
  }, [user]);

  const addWallet = useCallback(async (data: Omit<Wallet, 'id' | 'user_id' | 'created_at'>): Promise<Wallet | null> => {
    if (!user) return null;
    const { data: newWallet, error } = await supabase
      .from('wallets')
      .insert({ ...data, user_id: user.id })
      .select()
      .single();
    if (error) return null;
    const wallet = newWallet as Wallet;
    setWallets(prev => [...prev, wallet]);
    return wallet;
  }, [user]);

  const addCategory = useCallback(async (data: Omit<TransactionCategory, 'id' | 'user_id' | 'created_at'>): Promise<TransactionCategory | null> => {
    if (!user) return null;
    const { data: newCat, error } = await supabase
      .from('transaction_categories')
      .insert({ ...data, user_id: user.id })
      .select()
      .single();
    if (error) return null;
    const cat = newCat as TransactionCategory;
    setCategories(prev => [...prev, cat]);
    return cat;
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshWallets();
      refreshCategories();
    }
  }, [user]);

  return (
    <WalletCategoryContext.Provider value={{
      wallets, categories,
      loadingWallets, loadingCategories,
      refreshWallets, refreshCategories,
      addWallet, addCategory
    }}>
      {children}
    </WalletCategoryContext.Provider>
  );
}

export function useWalletCategory() {
  const ctx = useContext(WalletCategoryContext);
  if (!ctx) throw new Error('useWalletCategory must be used within WalletCategoryProvider');
  return ctx;
}
