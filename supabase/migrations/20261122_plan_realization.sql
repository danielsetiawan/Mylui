-- MyLui — Planning realization (link expenses to budget plans)
-- Date: 2026-11-22
--
-- What this adds (all columns are nullable, nothing existing is changed):
--   transactions.budget_plan_id       → which plan an expense belongs to
--   transactions.budget_plan_item_id  → (optional) which item of that plan
--   budget_plan_items.category_id     → (optional) category of a plan item, for its icon
--                                       and as the default category of linked expenses
--
-- Effect on the apps:
--   * Web: Planning shows Spent / Left per plan and per item; the expense form gets
--     "Plan" and "Plan item" fields.
--   * Mobile (unchanged code) keeps working: it never sends these columns, so new
--     transactions from mobile are simply not linked, and editing a transaction from
--     mobile leaves an existing link untouched. Caveat: editing a PLAN from mobile still
--     deletes and re-inserts all its items, which clears item links (budget_plan_item_id
--     becomes NULL via ON DELETE SET NULL, the plan link stays) and item categories.
--
-- How to run: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- It runs in one transaction: if any statement fails, nothing is applied.
--
-- Before running, check that the id columns are uuid (the FKs below assume uuid):
--   select table_name, data_type from information_schema.columns
--   where table_schema = 'public' and column_name = 'id'
--     and table_name in ('budget_plans', 'budget_plan_items', 'transaction_categories');
-- If any of them is not "uuid", stop and change the column types below to match.

begin;

alter table public.transactions
  add column if not exists budget_plan_id uuid
    references public.budget_plans (id) on delete set null,
  add column if not exists budget_plan_item_id uuid
    references public.budget_plan_items (id) on delete set null;

alter table public.budget_plan_items
  add column if not exists category_id uuid
    references public.transaction_categories (id) on delete set null;

-- Planning sums expenses per plan / item; only linked rows are indexed.
create index if not exists transactions_budget_plan_id_idx
  on public.transactions (budget_plan_id) where budget_plan_id is not null;
create index if not exists transactions_budget_plan_item_id_idx
  on public.transactions (budget_plan_item_id) where budget_plan_item_id is not null;

commit;

-- Row Level Security: no change needed. The new columns live in tables that already
-- have per-user policies; reading a linked plan still goes through budget_plans' RLS.

-- Undo (only if you need to roll back; this deletes the links):
--   begin;
--   drop index if exists public.transactions_budget_plan_item_id_idx;
--   drop index if exists public.transactions_budget_plan_id_idx;
--   alter table public.budget_plan_items drop column if exists category_id;
--   alter table public.transactions drop column if exists budget_plan_item_id;
--   alter table public.transactions drop column if exists budget_plan_id;
--   commit;
