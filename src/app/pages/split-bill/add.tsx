import React from 'react';
import { useNavigate } from 'react-router';
import { SplitBillForm } from './SplitBillForm';

/**
 * Route /split-bill/new — a new split bill.
 * The editor and the calculation live in SplitBillForm.tsx / calculate.ts.
 */
export function SplitBillAdd() {
  const navigate = useNavigate();
  return <SplitBillForm onClose={() => navigate('/split-bill')} />;
}
