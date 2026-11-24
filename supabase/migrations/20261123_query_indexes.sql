-- MyLui — indexes for the columns both apps filter, sort and join on
-- Date: 2026-11-23
--
-- Why: the diagnostic (supabase/diagnostics/2026-11-23_query_performance_check.sql)
-- showed that only split_bill_details.split_bill_id had an index. Every other
-- user_id / foreign-key column was read with a full table scan, e.g.
-- transaction_details: 548,308 sequential scans vs 224 index scans (each
-- Activity page loads the details of its transactions).
-- With today's data (≈2,300 transactions) a full scan is still about a
-- millisecond, so this is mostly for keeping the apps fast as data grows
-- (every month adds rows), and it lets Postgres check RLS on fewer rows.
--
-- What it changes: only adds indexes. No data, column or policy is touched,
-- and neither app needs a code change. Indexes cost a little disk space and a
-- tiny bit of work on every insert/update (negligible at this size).
--
-- How to run: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- It runs in one transaction: if any statement fails, nothing is applied.
-- (CREATE INDEX briefly blocks writes to that table; with tables this small it
-- takes milliseconds.)

begin;

-- Activity list, month filter, month range (oldest / newest), Dashboard range,
-- entry hints: all "where user_id = ? [and date between ...] order by date desc, created_at desc"
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc, created_at desc);

-- "Link to Income" filter (id = X or linked_income_id = X) and the linked_income join
create index if not exists transactions_linked_income_id_idx
  on public.transactions (linked_income_id) where linked_income_id is not null;

-- Joins of the Activity list (wallet / category names) and the checks Postgres
-- runs when a wallet or category is deleted
create index if not exists transactions_wallet_id_idx
  on public.transactions (wallet_id) where wallet_id is not null;
create index if not exists transactions_to_wallet_id_idx
  on public.transactions (to_wallet_id) where to_wallet_id is not null;
create index if not exists transactions_category_id_idx
  on public.transactions (category_id) where category_id is not null;

-- Detail items of a transaction (embedded in every Activity page)
create index if not exists transaction_details_transaction_id_idx
  on public.transaction_details (transaction_id);

-- Master data per user (forms, Dashboard categories)
create index if not exists wallets_user_id_idx
  on public.wallets (user_id);
create index if not exists transaction_categories_user_id_idx
  on public.transaction_categories (user_id);

-- Notes list: "where user_id = ? order by created_at desc"
create index if not exists notes_user_created_idx
  on public.notes (user_id, created_at desc);

-- Planning list and its items
create index if not exists budget_plans_user_created_idx
  on public.budget_plans (user_id, created_at desc);
create index if not exists budget_plan_items_plan_id_idx
  on public.budget_plan_items (plan_id);

-- Split bills list (split_bill_details.split_bill_id already has an index)
create index if not exists split_bills_user_created_idx
  on public.split_bills (user_id, created_at desc);

commit;

-- Refresh the planner statistics so the new indexes are used right away
analyze public.transactions, public.transaction_details, public.wallets,
        public.transaction_categories, public.notes, public.budget_plans,
        public.budget_plan_items, public.split_bills;

-- Check afterwards: run section 2 of the diagnostic again; every row should
-- show an index instead of MISSING.
--
-- Undo (only if needed):
--   drop index if exists public.transactions_user_date_idx, public.transactions_linked_income_id_idx,
--     public.transactions_wallet_id_idx, public.transactions_to_wallet_id_idx,
--     public.transactions_category_id_idx, public.transaction_details_transaction_id_idx,
--     public.wallets_user_id_idx, public.transaction_categories_user_id_idx,
--     public.notes_user_created_idx, public.budget_plans_user_created_idx,
--     public.budget_plan_items_plan_id_idx, public.split_bills_user_created_idx;
