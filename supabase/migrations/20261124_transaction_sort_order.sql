-- MyLui — manual order of transactions inside one day (Activity list drag & drop)
-- Date: 2026-11-24
--
-- How to run: Supabase Dashboard → SQL Editor → paste this file → Run.
-- Run it BEFORE deploying the web / installing the APK that use the column.
-- Safe for existing data: it only ADDS a column and fills it; no row is
-- deleted or changed otherwise. Safe to run more than once.
--
-- sort_order: bigger = higher in its day. The Activity list is ordered by
-- date desc, sort_order desc. Dragging a row writes ONE row (a value between
-- its new neighbours). Only the order inside the same date matters.

alter table public.transactions
  add column if not exists sort_order double precision;

-- Existing rows keep the order they have today (newest created on top)
update public.transactions
set sort_order = extract(epoch from coalesce(created_at, now()))
where sort_order is null;

-- New rows land on top of their day (apps that do not send the column,
-- e.g. an older APK, keep working)
alter table public.transactions
  alter column sort_order set default extract(epoch from now());
alter table public.transactions
  alter column sort_order set not null;

-- No new index: transactions_user_date_idx (user_id, date desc, …) already
-- finds a user's month; ordering the few rows of each day is free.
