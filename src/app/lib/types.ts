export type TransactionType = 'income' | 'expense' | 'transfer';

export interface TransactionDetail {
  id: string;
  transaction_id: string;
  name: string;
  amount: number;
  text?: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  balance: number;
  created_at?: string;
}

export interface TransactionCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
  created_at?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category: string;       // legacy field (kept for migration compatibility)
  description: string;
  date: string;
  wallet_id?: string | null;
  to_wallet_id?: string | null;  // only for 'transfer' type
  category_id?: string | null;
  linked_income_id?: string | null;
  budget_plan_id?: string | null;       // Planning realization (see supabase/migrations/20261122_plan_realization.sql)
  budget_plan_item_id?: string | null;
  created_at?: string;
  /** Position inside its day (bigger = higher); changed by dragging in Activity */
  sort_order?: number;
  transaction_details?: TransactionDetail[];
  // Joined data
  wallet?: Wallet;
  to_wallet?: Wallet;
  transaction_category?: TransactionCategory;
  linked_income?: Pick<Transaction, 'id' | 'description' | 'category' | 'amount' | 'date'> | null;
  budget_plan?: { id: string; title: string } | null;
}

export interface BudgetPlanItem {
  id: string;
  plan_id: string;
  name: string;
  estimate: number;
  category_id?: string | null;
}

export interface BudgetPlan {
  id: string;
  user_id: string;
  title: string;
  description: string;
  total_budget: number;
  status: 'planning' | 'active' | 'completed';
  created_at?: string;
  budget_plan_items?: BudgetPlanItem[];
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: 'user' | 'admin';
  created_at?: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
}

