export type TransactionType = 'income' | 'expense';

export interface TransactionDetail {
  id: string;
  transaction_id: string;
  name: string;
  amount: number;
  text?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
  linked_income_id?: string | null;
  created_at?: string;
  transaction_details?: TransactionDetail[];
}

export interface BudgetPlanItem {
  id: string;
  plan_id: string;
  name: string;
  estimate: number;
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
