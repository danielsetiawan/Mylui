/**
 * MonthRangeContext — Global month list helper
 *
 * Fetches the earliest and latest transaction dates from the DB once
 * (when the user is authenticated), generates a full list of month-year
 * options between those two dates, and caches it in React context so
 * every page that needs a month filter (Transactions, Add/Edit form) can
 * consume it without making duplicate DB calls.
 *
 * The list always includes the current month even if there are no
 * transactions yet.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface MonthOption {
  value: string;   // "2025-03"
  label: string;   // "March 2025"
}

interface MonthRangeContextValue {
  monthOptions: MonthOption[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const MonthRangeContext = createContext<MonthRangeContextValue>({
  monthOptions: [],
  isLoading: true,
  refresh: async () => {},
});

export const useMonthRange = () => useContext(MonthRangeContext);

// ── Helper: format "yyyy-MM" → human-readable label (English, like the rest of the UI) ──
function formatMonthLabel(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

// ── Helper: generate all months between two "yyyy-MM" strings ─────────────
function generateMonthRange(from: string, to: string): string[] {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);

  const result: string[] = [];
  let y = ty, m = tm;

  while (y > fy || (y === fy && m >= fm)) {
    result.push(`${y}-${String(m).padStart(2, '0')}`);
    m--;
    if (m === 0) { m = 12; y--; }
  }

  return result; // newest → oldest
}

export function MonthRangeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [monthOptions, setMonthOptions] = useState<MonthOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentMonthStr = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  const load = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Single lightweight query — only fetches the date column, ordered ASC/DESC
      const [minResult, maxResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('date')
          .eq('user_id', user.id)
          .order('date', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('transactions')
          .select('date')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const minDate = minResult.data?.date as string | undefined;
      const maxDate = maxResult.data?.date as string | undefined;

      // Derive earliest month (from oldest tx, or current month if no data)
      const earliest = minDate ? minDate.substring(0, 7) : currentMonthStr;
      // Derive latest month — always at least the current month
      const latest = maxDate
        ? (maxDate.substring(0, 7) > currentMonthStr ? maxDate.substring(0, 7) : currentMonthStr)
        : currentMonthStr;

      const months = generateMonthRange(earliest, latest);
      setMonthOptions(months.map(m => ({ value: m, label: formatMonthLabel(m) })));
    } catch (err) {
      console.error('[MonthRangeContext] Failed to fetch month range:', err);
      // Fallback: only show the current month
      setMonthOptions([{ value: currentMonthStr, label: formatMonthLabel(currentMonthStr) }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  return (
    <MonthRangeContext.Provider value={{ monthOptions, isLoading, refresh: load }}>
      {children}
    </MonthRangeContext.Provider>
  );
}
