export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  description: string;
  linkedIncomeId?: string; // For linking expenses to specific income
}

export interface BudgetPlanItem {
  id: string;
  name: string;
  estimate: number;
}

export interface BudgetPlan {
  id: string;
  title: string;
  description: string;
  items: BudgetPlanItem[];
  totalBudget: number;
  status: 'planning' | 'active' | 'completed';
}
