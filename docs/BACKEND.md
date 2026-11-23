# MyLui Backend (Supabase) — Skema & Kontrak Data Bersama

> Web ([WEB.md](WEB.md)) dan mobile ([MOBILE.md](../../mylui-mobile/docs/MOBILE.md)) memakai **satu project Supabase yang sama**. Dokumen ini adalah kontrak data di antara keduanya.
>
> ⚠️ **Sumber kebenaran skema TIDAK ADA di repo.** Tidak ada file SQL, migration, atau definisi RLS. Seluruh isi dokumen ini **direkonstruksi dari query di kode klien** (nama tabel, kolom, relasi yang dipakai). Tipe kolom, default, constraint, index, trigger, dan policy RLS ditandai **[TIDAK DIKETAHUI]** bila tidak bisa disimpulkan.
>
> Sebelum refactor yang menyentuh data, ekspor skema asli dan simpan di repo (lihat §7).

## 1. Gambaran

```
React SPA (web)  ─┐
                  ├─ supabase-js / supabase_flutter ─► Supabase
Flutter (mobile) ─┘                                     ├─ Auth (GoTrue): email+password, Google OAuth
                                                        └─ Postgres via PostgREST (schema public)
```

- Tidak ada backend kustom. Tidak ada RPC (`.rpc()`), Edge Function, Storage, maupun Realtime yang dipanggil klien.
- `supabase/functions/server/` (Hono + tabel `kv_store_c093f2ae`) adalah boilerplate Figma Make dan **tidak dipakai** aplikasi.
- Lokasi kredensial klien: web → `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); mobile → `lib/core/constants.dart` di repo `mylui-mobile` (hardcoded). Juga ada salinan tak terpakai di `utils/supabase/info.tsx`. Semuanya anon key (publik), sehingga **keamanan data sepenuhnya bergantung pada RLS**.

## 2. Diagram Relasi

```
auth.users (Supabase Auth)
   │ 1:1
   ▼
profiles
   │
   │ user_id (semua tabel di bawah dimiliki per-user)
   ├──────────────► wallets ◄───────────── wallet_id / to_wallet_id ──┐
   ├──────────────► transaction_categories ◄──── category_id ─────────┤
   ├──────────────► transactions ──────────────────────────────────────┘
   │                   │  ▲
   │                   │  └── linked_income_id (self-reference: expense → income)
   │                   └──► transaction_details   (transaction_id)
   ├──────────────► budget_plans ──► budget_plan_items   (plan_id)
   ├──────────────► notes
   └──────────────► split_bills ──► split_bill_details   (split_bill_id)
```

Fitur Planning, Notes, dan Split Bill **berdiri sendiri** — tidak ada relasi ke `transactions` atau `wallets`.

## 3. Tabel

Notasi kolom "Sumber": **W** = dipakai web, **M** = dipakai mobile. Tipe adalah dugaan dari pemakaian di kode.

### 3.1 `profiles`

| Kolom | Tipe (dugaan) | Sumber | Keterangan |
|---|---|---|---|
| `id` | uuid, PK = `auth.users.id` | W M | |
| `email` | text, nullable | W M | |
| `full_name` | text, nullable | W M | |
| `role` | text: `'user'` \| `'admin'` | W | Menentukan akses halaman Init Data (web). Tidak ada UI untuk mengubahnya; mobile tidak membacanya |
| `created_at` | timestamptz | W M | |

- **Pembuatan baris**: web tidak pernah INSERT; mobile melakukan `upsert {id, email, full_name}` saat register. Untuk user yang daftar lewat web atau Google, baris kemungkinan dibuat trigger pada `auth.users` **[TIDAK DIKETAHUI]**.
- **Update nama**: web → `UPDATE profiles SET full_name`; mobile → `auth.updateUser(data.full_name)` (metadata Auth, **bukan** tabel ini).
- Web admin membaca **semua** baris (`select id, full_name, email`) di halaman Init → butuh policy RLS khusus admin **[TIDAK DIKETAHUI]**.

### 3.2 `wallets`

| Kolom | Tipe (dugaan) | Sumber | Keterangan |
|---|---|---|---|
| `id` | uuid PK | W M | |
| `user_id` | uuid FK | W M | |
| `name` | text | W M | |
| `icon` | text | W | Selalu `'Wallet'` (tidak ada pemilih ikon) |
| `color` | text hex (`#10b981`) | W M | |
| `balance` | numeric | W M | Lihat catatan di bawah |
| `created_at` | timestamptz | W | Web mengurutkan berdasarkan ini; mobile mengurutkan berdasarkan `name` |

- **`balance` tidak dipakai.** Web selalu meng-insert `0` dan tidak menampilkannya; mobile hanya membacanya ke model dan tidak menampilkannya. Tidak ada klien yang menghitung saldo wallet — aplikasi ini mencatat pemasukan/pengeluaran per bulan, bukan saldo rekening. Apakah ada trigger DB yang mengelola kolom ini **[TIDAK DIKETAHUI]**.
- CRUD hanya dari web (halaman Wallets + tambah inline di form transaksi). Mobile read-only.

### 3.3 `transaction_categories`

| Kolom | Tipe (dugaan) | Sumber | Keterangan |
|---|---|---|---|
| `id` | uuid PK | W M | |
| `user_id` | uuid FK | W M | |
| `name` | text | W M | |
| `icon` | text | W M | **Nama komponen lucide-react** (mis. `'Utensils'`, `'Tag'`). Mobile memetakannya ke Material Icons |
| `color` | text hex | W M | |
| `type` | text: `'income'` \| `'expense'` | W M | Tidak bisa diubah setelah dibuat (UI) |
| `created_at` | timestamptz | W | |

- CRUD hanya dari web. Mobile read-only.
- Daftar nama ikon yang valid: `AVAILABLE_ICONS` di `src/app/pages/master-data/CategoriesPage.tsx`. Pemetaan tampilan: `ICON_MAP` (web, 2 tempat) dan `getCategoryIcon` di `lib/pages/transactions_page.dart` (repo `mylui-mobile`). Nama tak dikenal → ikon default.

### 3.4 `transactions`

| Kolom | Tipe (dugaan) | Sumber | Keterangan |
|---|---|---|---|
| `id` | uuid PK | W M | |
| `user_id` | uuid FK | W M | |
| `type` | text: `'income'` \| `'expense'` \| `'transfer'` | W M | |
| `amount` | numeric (selalu positif; arah ditentukan `type`) | W M | Form hanya menerima bilangan bulat |
| `category` | text | W M | **LEGACY** — lihat §4.1 |
| `description` | text | W M | Catatan bebas; dipakai sebagai judul tampilan bila terisi |
| `date` | date / text `yyyy-MM-dd` | W M | Difilter dengan perbandingan string `gte`/`lte` |
| `wallet_id` | uuid FK → `wallets`, nullable | W M | Wajib di form; `null` pada data impor Init. Untuk transfer = wallet asal |
| `to_wallet_id` | uuid FK → `wallets`, nullable | W M | Hanya untuk `type = 'transfer'` |
| `category_id` | uuid FK → `transaction_categories`, nullable | W M | `null` untuk transfer |
| `linked_income_id` | uuid FK → `transactions.id`, nullable | W M | Hanya untuk `type = 'expense'`: menautkan pengeluaran ke sumber pemasukan |
| `budget_plan_id` | uuid FK → `budget_plans.id`, nullable, `ON DELETE SET NULL` | W | **Ditambah 2026-11-22** (`supabase/migrations/20261122_plan_realization.sql`). Hanya untuk expense: pengeluaran ini bagian dari plan mana. Dijumlahkan sebagai "Spent" di Planning |
| `budget_plan_item_id` | uuid FK → `budget_plan_items.id`, nullable, `ON DELETE SET NULL` | W | **Ditambah 2026-11-22**. Opsional, hanya jika `budget_plan_id` terisi: item plan yang dibayar. Mobile tidak mengirim kolom ini sehingga edit dari mobile tidak menghapus tautan |
| `created_at` | timestamptz | W M | Urutan sekunder list |

Relasi yang dipakai di embed PostgREST (nama FK harus tetap bisa di-resolve):

```
wallet:wallets!wallet_id(...)
to_wallet:wallets!to_wallet_id(...)
transaction_category:transaction_categories!category_id(...)
linked_income:linked_income_id(id,description,category)      ← hanya mobile
transaction_details(*)
```

`test_supabase_fk.js` mencoba nama constraint `transactions_linked_income_id_fkey`; nama constraint sebenarnya **[TIDAK DIKETAHUI]**.

Aturan bisnis (ditegakkan **hanya di klien**, constraint DB **[TIDAK DIKETAHUI]**):

- Transfer: `wallet_id` dan `to_wallet_id` wajib dan harus berbeda; `category_id` & `linked_income_id` = null.
- Income/Expense: `wallet_id` wajib (di form); `to_wallet_id` = null.
- `linked_income_id` hanya diisi untuk expense. Tidak ada validasi bahwa targetnya bertipe income atau bahwa total expense tertaut ≤ nominal income.
- Statistik Income/Expense/Balance **mengabaikan transfer**.
- "Balance" di Activity (web & mobile), kartu "Balance" di dashboard web, dan "Total Balance" di dashboard mobile = Σ income − Σ expense pada periode terpilih (bukan saldo wallet).

Penghapusan: klien hanya `DELETE FROM transactions WHERE id`. Nasib `transaction_details` dan expense yang menaut ke income yang dihapus bergantung pada aturan FK **[TIDAK DIKETAHUI]**.

### 3.5 `transaction_details`

Rincian item di dalam satu transaksi (mis. isi struk).

| Kolom | Tipe (dugaan) | Sumber | Keterangan |
|---|---|---|---|
| `id` | uuid PK | W M | |
| `transaction_id` | uuid FK → `transactions` | W M | |
| `name` | text | W M | |
| `amount` | numeric | W M | Bisa **negatif** (dari impor Init) |
| `text` | text | W M (baca saja) | **LEGACY** — fallback nama jika `name` kosong. Tidak ada kode yang menulisnya |

- Σ `amount` detail **tidak** divalidasi terhadap `transactions.amount`.
- Hanya untuk income/expense (UI menyembunyikannya untuk transfer).

### 3.6 `budget_plans` & `budget_plan_items`

`budget_plans`

| Kolom | Tipe (dugaan) | Keterangan |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `title` | text | Wajib |
| `description` | text | |
| `total_budget` | numeric | Web: boleh otomatis = Σ estimate item. Mobile: wajib diisi manual |
| `status` | text: `'planning'` \| `'active'` \| `'completed'` | |
| `created_at` | timestamptz | Dipakai untuk filter bulan & urutan |

`budget_plan_items`

| Kolom | Tipe (dugaan) | Keterangan |
|---|---|---|
| `id` | uuid PK | Web dan mobile (keduanya sejak 2026-11-22) mempertahankan id item saat edit (update → insert → delete hanya yang berubah) |
| `plan_id` | uuid FK → `budget_plans` | |
| `name` | text | |
| `estimate` | numeric | |
| `category_id` | uuid FK → `transaction_categories.id`, nullable, `ON DELETE SET NULL` | **Ditambah 2026-11-22**. Ikon item di Planning, dan kategori default saat expense ditautkan ke item ini. Diisi oleh web dan mobile (form plan) |

Nilai turunan (dihitung di klien, tidak disimpan): `planned = Σ estimate`, `unallocated = total_budget − planned`; sejak 2026-11-22 juga **realisasi**: `spent = Σ amount transaksi expense dengan budget_plan_id = plan.id`, per item `Σ … budget_plan_item_id = item.id`, `left = total_budget − spent` (web: `src/app/lib/planSpending.ts`). Mobile (sejak revamp 2026-11-22) **menampilkan** realisasi yang sama (`PlanningService.fetchPlanSpending`), tetapi form transaksi mobile **belum mengisi** `budget_plan_id` / `budget_plan_item_id`.

**Migrasi**: kolom tautan dibuat oleh `supabase/migrations/20261122_plan_realization.sql` (dijalankan manual di SQL Editor Supabase; file berisi juga perintah undo). Kode web **membutuhkan** kolom ini: tanpa migrasi, daftar Activity dan form expense akan error.
Hapus plan: klien hanya menghapus header; item diasumsikan cascade **[TIDAK DIKETAHUI]**.

### 3.7 `notes`

| Kolom | Tipe (dugaan) | Keterangan |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `title` | text | Wajib (klien) |
| `content` | text | |
| `created_at` | timestamptz | Filter bulan & urutan. Tidak ada `updated_at` |

### 3.8 `split_bills` & `split_bill_details`

`split_bills`

| Kolom | Tipe (dugaan) | Keterangan |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `title` | text | |
| `total_subtotal` | numeric | Σ (harga × qty) |
| `tax_type`, `service_type`, `discount_type` | text: `'percentage'` \| `'nominal'` | |
| `tax_value`, `service_value`, `discount_value` | numeric | Persen atau rupiah sesuai `*_type` |
| `delivery_fee`, `admin_fee` | numeric | Rupiah |
| `grand_total` | numeric | Sudah dibulatkan |
| `created_at` | timestamptz | |

`split_bill_details` — sejak revamp mobile (2026-11-22) **web dan mobile menulis format yang sama**: satu baris per (orang, bagian item).

| Kolom | Isi |
|---|---|
| `id`, `split_bill_id` | |
| `person_name` | nama orang; kosong → `'Unknown'` |
| `item_name` | nama item; kosong → `'Item'` |
| `original_price` | **bagian orang itu dari total item** (harga × qty, dibagi rata jika item dipakai bersama; rupiah bulat) |
| `qty` | tidak dikirim lagi (baris lama dari mobile versi sebelum revamp masih punya `qty`) |
| `weight_percentage` | `ratio × 100` |
| `tax_amount`, `service_amount`, `discount_amount`, `delivery_amount`, `admin_amount` | alokasi per baris (pecahan) |
| `final_price` | dibulatkan |

Implementasi: web `src/app/pages/split-bill/calculate.ts` (`expandItems`, `groupRows`, `calculateSplit`), mobile `lib/core/split_calc.dart` (port 1:1, diuji dengan `test/split_calc_test.dart` dan perbandingan 2000 kasus acak terhadap versi TS). Kedua fungsi `calculateSplit` adalah **kontrak**: hasilnya harus identik.

Saat membuka bill untuk diedit, kedua klien memakai `groupRows`: baris dengan nama item sama dan harga hampir sama (selisih ≤ 1 rupiah) untuk orang berbeda digabung kembali jadi satu item bersama. Data lama:

- Baris mobile lama (`original_price` = harga satuan, `qty` > 1): mobile baru membacanya sebagai `original_price × qty`; **web masih membaca qty = 1**, jadi bill lama dari mobile dengan qty > 1 tampil lebih kecil di web sampai bill itu disimpan ulang dari mobile.
- `person_name` `'Unassigned'` (mobile lama) atau `'Unknown'` dianggap tidak ada orangnya.

Kolom alokasi (`tax_amount`, dst.) tidak pernah dibaca oleh klien mana pun (selalu dihitung ulang). Keberadaan & default kolom `qty` di DB **[TIDAK DIKETAHUI]**.

Rumus perhitungan: lihat [WEB.md §7.6](WEB.md).

### 3.9 `kv_store_c093f2ae`

`key text PK, value jsonb`. Tabel bawaan Figma Make untuk Edge Function yang tidak dipakai. Keberadaannya di DB **[TIDAK DIKETAHUI]**.

## 4. Data Legacy & Sejarah Skema

### 4.1 `transactions.category` (teks) vs `category_id`

Awalnya kategori disimpan sebagai teks bebas di `transactions.category`. Pada commit "refactor become wallets transaction" (2026-04-20) diperkenalkan tabel `wallets` dan `transaction_categories` beserta kolom `wallet_id`, `to_wallet_id`, `category_id`. Kolom lama dipertahankan.

Keadaan sekarang:

| Penulis | Nilai `category` yang ditulis |
|---|---|
| Web — form tambah transaksi | `''` |
| Web — form edit transaksi | tidak disentuh |
| Web — Init Data (admin) | teks kategori hasil parse (mis. `"spotinet"`) |
| Mobile — tambah | `''` |
| Mobile — edit | `''` (**menimpa** nilai lama) |

Pembaca:

- Web: judul = `description || transaction_category.name || category || '—'`; pencarian mencakup `description` dan `category`.
- Mobile: judul list = `description || category`; judul dashboard = `category` saja; pencarian sama dengan web.

Jadi ada dua generasi data: (a) lama/impor — `category` terisi, `category_id` & `wallet_id` null; (b) baru — `category = ''`, `category_id` terisi. Kode harus menangani keduanya. Kolom tampaknya NOT NULL (mobile melakukan cast non-null; semua penulis mengirim string) **[TIDAK DIKETAHUI]**.

### 4.2 `transaction_details.text`

Nama kolom lama untuk `name`. Hanya dibaca sebagai fallback.

## 5. Autentikasi

| Hal | Web | Mobile |
|---|---|---|
| Email + password | ✓ | ✓ |
| Google OAuth | `redirectTo: window.location.origin` | `redirectTo: io.supabase.flutter://callback` |
| Metadata saat signup | `data.full_name` | `data.full_name` + upsert `profiles` |
| Konfirmasi email | Pesan UI menyiratkan aktif; pengaturan sebenarnya di dashboard Supabase **[TIDAK DIKETAHUI]** |
| Durasi sesi | UI menyebut "14 hari"; diatur di dashboard Supabase **[TIDAK DIKETAHUI]** |

Redirect URL kedua klien harus terdaftar di Supabase Auth → URL Configuration.

## 6. Matriks Akses Tabel

S = select, I = insert, U = update, D = delete.

| Tabel | Web | Mobile |
|---|---|---|
| `profiles` | S (sendiri), S semua (admin), U `full_name` | S (sendiri), upsert saat register |
| `wallets` | S I U D | S |
| `transaction_categories` | S I U D | S |
| `transactions` | S I U D; I untuk **user lain** (admin, Init) | S I U D |
| `transaction_details` | S I U D | S I U D |
| `budget_plans` | S I U D | S I U D |
| `budget_plan_items` | S I D | S I D |
| `notes` | S I U D | S I U D |
| `split_bills` | S I U D | S I U D |
| `split_bill_details` | S I D | S I D |

Pola filter: SELECT selalu menyertakan `user_id = <uid>` dari klien; UPDATE/DELETE hanya `id = ?` (atau FK induk). Isolasi antar user untuk tulis bergantung pada RLS **[TIDAK DIKETAHUI]**.

Hal yang butuh policy khusus agar fitur web berjalan: admin membaca semua `profiles`, admin meng-insert `transactions` + `transaction_details` atas nama user lain.

## 7. Yang Harus Diverifikasi Langsung di Supabase

Daftar ini tidak bisa dijawab dari kode. Jawab dulu sebelum refactor data:

1. Tipe, nullability, default, dan constraint tiap kolom (terutama `transactions.category`, `transactions.date`, `split_bill_details.qty`).
2. Aturan `ON DELETE` setiap FK (detail transaksi, item plan, detail split bill, `wallet_id`, `category_id`, `linked_income_id`).
3. Policy RLS tiap tabel, termasuk pengecualian untuk admin.
4. Trigger/function: pembuatan `profiles` saat signup; ada/tidaknya pengelolaan `wallets.balance`.
5. ~~Index~~ — **sudah diperiksa 2026-11-23** (lihat §7.1). Yang tersisa: index untuk kolom pencarian (`ilike '%…%'` butuh `pg_trgm`, belum perlu di ukuran data sekarang).
6. Apakah Edge Function `server` dan tabel `kv_store_c093f2ae` benar-benar ter-deploy.
7. Pengaturan Auth: konfirmasi email, JWT/refresh expiry, daftar redirect URL, provider Google.

Cara mengabadikan skema ke repo (butuh Supabase CLI dan akses project):

```bash
supabase db dump --schema public -f supabase/schema.sql
```

Setelah file itu ada, perbarui dokumen ini dan hapus label [TIDAK DIKETAHUI] yang sudah terjawab.

### 7.1 Hasil diagnosis 2026-11-23 (`supabase/diagnostics/2026-11-23_query_performance_check.sql`)

- **Ukuran data**: `transactions` ±2.300 baris (736 kB), `transaction_details` ±850, tabel lain < 100 baris. Database bukan penyebab lambat untuk ukuran ini: query Notes tercatat 0,03 ms di server.
- **RLS aktif di semua tabel** (termasuk `kv_store_c093f2ae`); akses dengan anon key tanpa login mengembalikan 0 baris di setiap tabel. Isi policy (`pg_policies`) **belum diperiksa**: perlu dilihat apakah memakai `auth.uid()` langsung (dihitung per baris) atau `(select auth.uid())`, dan apakah policy tabel anak (`transaction_details`, `budget_plan_items`, `split_bill_details`) melakukan subquery ke tabel induk.
- **Index**: sebelum migrasi `20261123_query_indexes.sql` hanya `split_bill_details(split_bill_id)` dan index partial `budget_plan_id` / `budget_plan_item_id` (migrasi 2026-11-22) yang ada; semua kolom `user_id` dan FK lain tanpa index. `transaction_details` tercatat 548.308 seq scan vs 224 index scan (embed detail di list Activity). Migrasi tersebut menambah index untuk `transactions (user_id, date desc, created_at desc)`, FK `linked_income_id`/`wallet_id`/`to_wallet_id`/`category_id`, `transaction_details(transaction_id)`, `user_id` di master data, dan `(user_id, created_at desc)` untuk notes, budget_plans, split_bills, plus `budget_plan_items(plan_id)`. Status dijalankan: lihat riwayat SQL Editor.

## 8. Aturan Saat Mengubah Skema

- Dua klien memakai DB yang sama dan dirilis terpisah. **Setiap perubahan kolom/tabel harus diterapkan di web dan mobile**, atau dibuat backward-compatible.
- Jangan mengganti nama FK/kolom yang dipakai di embed PostgREST (§3.4) tanpa memperbarui string `select(...)` di kedua klien.
- Nilai enum disimpan sebagai string dan di-hardcode di kedua klien: `type` transaksi, `type` kategori, `status` plan, `*_type` split bill, `role` profil.
- Nama ikon kategori adalah kontrak tiga pihak (DB ↔ web ↔ mobile).
- Sebelum menghapus kolom legacy (`transactions.category`, `transaction_details.text`), migrasikan data generasi lama dan ubah logika judul/pencarian di kedua klien.
- Jika `split_bill_details` diseragamkan, tentukan satu arti untuk `original_price` (disarankan harga satuan + `qty`) dan migrasikan baris lama buatan web.
