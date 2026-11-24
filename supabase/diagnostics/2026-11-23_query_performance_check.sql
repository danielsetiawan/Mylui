-- MyLui — query performance check (READ-ONLY: changes nothing)
-- Date: 2026-11-23
--
-- How to run: Supabase Dashboard → SQL Editor → paste this file → Run.
-- The editor shows only the LAST result, so run the sections one by one
-- (select a section, then "Run selected"), or copy each result.
--
-- What it answers:
--   1. How big each table is (rows, size)
--   2. Which indexes exist on the columns the apps filter / join on
--   3. How the RLS policies are written (auth.uid() vs (select auth.uid()))
--   4. Real timing of the heaviest app queries for ONE user (EXPLAIN ANALYZE)


-- ── 1. Table sizes ──────────────────────────────────────────────────────────
select relname as table_name,
       n_live_tup as approx_rows,
       pg_size_pretty(pg_total_relation_size(relid)) as total_size,
       seq_scan, idx_scan
from pg_stat_user_tables
where schemaname = 'public'
order by n_live_tup desc;


-- ── 2. Indexes on the public tables ─────────────────────────────────────────
-- Expected (what the app queries need), "MISSING" = no index starts with that column:
with wanted(table_name, first_column) as (values
  ('transactions', 'user_id'),
  ('transactions', 'linked_income_id'),
  ('transaction_details', 'transaction_id'),
  ('wallets', 'user_id'),
  ('transaction_categories', 'user_id'),
  ('notes', 'user_id'),
  ('budget_plans', 'user_id'),
  ('budget_plan_items', 'plan_id'),
  ('split_bills', 'user_id'),
  ('split_bill_details', 'split_bill_id')
),
idx as (
  select t.relname as table_name,
         i.relname as index_name,
         a.attname as first_column,
         pg_get_indexdef(i.oid) as definition
  from pg_index x
  join pg_class i on i.oid = x.indexrelid
  join pg_class t on t.oid = x.indrelid
  join pg_namespace n on n.oid = t.relnamespace
  join pg_attribute a on a.attrelid = t.oid and a.attnum = x.indkey[0]
  where n.nspname = 'public'
)
select w.table_name, w.first_column,
       coalesce(string_agg(idx.definition, E'\n'), 'MISSING') as existing_index
from wanted w
left join idx on idx.table_name = w.table_name and idx.first_column = w.first_column
group by w.table_name, w.first_column
order by w.table_name;


-- ── 3. RLS policies ─────────────────────────────────────────────────────────
-- Look at the "qual" column: `auth.uid() = user_id` is evaluated for EVERY row;
-- `(select auth.uid()) = user_id` is evaluated once per query (Supabase advice).
-- Policies that join other tables (e.g. details → parent) are the slow ones.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd;

select relname as table_name, relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by relname;


-- ── 4. Real timing of the app queries ───────────────────────────────────────
-- Replace the user id below with yours (Dashboard → Authentication → Users).
-- These run as the table owner, so RLS cost is NOT included here; section 3
-- shows whether the policies add work on top.

-- 4a. Dashboard rows (last month + this month)
explain (analyze, buffers)
select type, amount, date, category_id, category
from public.transactions
where user_id = '00000000-0000-0000-0000-000000000000'
  and type in ('income', 'expense')
  and date >= date_trunc('month', now()) - interval '1 month'
  and date <  date_trunc('month', now()) + interval '1 month'
order by date, id;

-- 4b. Activity list, first page, with its joins (details + category)
explain (analyze, buffers)
select t.*,
       (select json_agg(d) from public.transaction_details d where d.transaction_id = t.id) as details,
       (select row_to_json(c) from public.transaction_categories c where c.id = t.category_id) as category
from public.transactions t
where t.user_id = '00000000-0000-0000-0000-000000000000'
  and t.date >= date_trunc('month', now())
  and t.date <  date_trunc('month', now()) + interval '1 month'
order by t.date desc, t.created_at desc
limit 10;

-- 4c. Month range (oldest transaction)
explain (analyze, buffers)
select date from public.transactions
where user_id = '00000000-0000-0000-0000-000000000000'
order by date asc
limit 1;

-- 4d. Notes, first page
explain (analyze, buffers)
select * from public.notes
where user_id = '00000000-0000-0000-0000-000000000000'
order by created_at desc
limit 10;

-- Reading the result: "Seq Scan on transactions" with many rows removed by
-- filter = an index is missing; "Index Scan" / "Index Only Scan" = fine.
-- "Execution Time" above ~50 ms for these small queries is worth fixing.


-- ── 5. Where do the seconds go? (added 2026-11-23, after the 3.86 s report) ──
-- The browser showed "Waiting 3.86 s" for the first Dashboard requests and
-- 0.3–0.4 s after a refresh. This shows how long POSTGRES itself took for the
-- app queries since the statistics were last reset:
--   max_ms close to 3800  → the query itself was slow (RLS policy / cold cache)
--   max_ms only a few ms  → Postgres was fast; the time went before it
--                           (connection pool / API waking up after idle)
select calls,
       round(mean_exec_time::numeric, 1) as mean_ms,
       round(max_exec_time::numeric, 1)  as max_ms,
       left(regexp_replace(query, '\s+', ' ', 'g'), 140) as query
from extensions.pg_stat_statements
where query ilike '%"public"."transactions"%'
   or query ilike '%"public"."budget_plans"%'
   or query ilike '%"public"."profiles"%'
order by max_exec_time desc
limit 15;
