# Dokumentasi MyLui

Titik masuk dokumentasi project. **Baca file ini lebih dulu** (berlaku untuk manusia maupun AI assistant).

## Hal pertama yang harus diketahui

1. **Folder bernama `mylui-laravel`, tetapi project ini BUKAN Laravel.** Tidak ada PHP, Composer, Blade, Eloquent, atau artisan. Nama folder adalah salah penamaan. Jangan mencari atau membuat struktur Laravel.
2. Repo ini berisi **dua aplikasi klien** yang memakai **satu backend Supabase**:

   | Aplikasi | Lokasi | Teknologi | Dokumen |
   |---|---|---|---|
   | Web | root repo (`src/`) | React 18 + Vite + TypeScript + Tailwind v4 | [WEB.md](WEB.md) |
   | Mobile | `mylui_mobile/` | Flutter (Dart) | [MOBILE.md](MOBILE.md) |
   | Backend | Supabase (di luar repo) | Postgres + Auth, tanpa server kustom | [BACKEND.md](BACKEND.md) |

3. **Tidak ada backend kustom.** Kedua klien memanggil Supabase langsung. Skema database **tidak tersimpan di repo**; [BACKEND.md](BACKEND.md) adalah rekonstruksi dari kode klien.
4. Web berasal dari generator **Figma Make** dan masih menyimpan banyak sisa (folder `components/ui`, `supabase/functions`, dependency tak terpakai). Lihat daftar kode mati di [WEB.md §11](WEB.md).
5. Kode mobile **sebagian besar belum di-commit ke git** (lihat [MOBILE.md §1](MOBILE.md)).

## Apa itu MyLui

Aplikasi pencatatan & perencanaan keuangan pribadi (single-user per akun, mata uang IDR).

| Fitur | Isi | Tabel utama |
|---|---|---|
| Dashboard | Ringkasan pemasukan/pengeluaran bulan berjalan, pengeluaran per kategori, grafik 7 hari, aktivitas terbaru | `transactions` |
| Activity (Transactions) | Catat income / expense / transfer antar wallet, rincian item, tautkan expense ke sumber income | `transactions`, `transaction_details` |
| Master Data | Wallet (sumber dana) dan kategori transaksi | `wallets`, `transaction_categories` |
| Planning | Rencana anggaran berisi item estimasi (tidak terhubung ke transaksi nyata) | `budget_plans`, `budget_plan_items` |
| Notes | Catatan bebas | `notes` |
| Split Bill | Kalkulator patungan (pajak, service, diskon, ongkir, admin) | `split_bills`, `split_bill_details` |
| Init Data (admin, web) | Impor massal pengeluaran dari teks singkat | `transactions`, `transaction_details` |

## Glosarium

| Istilah | Arti |
|---|---|
| Activity | Nama UI untuk entitas `transactions`. "Activity" dan "Transaction" sama |
| Wallet | Sumber/tempat uang (rekening, e-wallet, tunai) |
| Transfer | Transaksi perpindahan antar wallet; tidak dihitung sebagai income/expense |
| Linked Income | Relasi expense → income (`linked_income_id`): "pengeluaran ini dibayar dari pemasukan itu" |
| Detail Items | Rincian di dalam satu transaksi (`transaction_details`) |
| Balance (di UI) | Income − expense pada periode terpilih. **Bukan** saldo wallet; aplikasi ini tidak melacak saldo rekening |
| Legacy category | Kolom teks `transactions.category`, pendahulu `category_id` |
| Modifier (split bill) | Tax / Service / Discount, masing-masing persen atau nominal |
| Init | Halaman admin untuk impor massal |

## Urutan baca yang disarankan

| Tujuan | Baca |
|---|---|
| Refactor web | README ini → [WEB.md](WEB.md) → [BACKEND.md](BACKEND.md) |
| Refactor mobile | README ini → [MOBILE.md](MOBILE.md) → [BACKEND.md](BACKEND.md) |
| Mengubah struktur data | [BACKEND.md](BACKEND.md) dulu, lalu bagian terkait di WEB dan MOBILE |
| Menyamakan perilaku web & mobile | [MOBILE.md §9](MOBILE.md) (tabel perbandingan) |

## Aturan untuk AI assistant yang mengerjakan refactor

1. **Jangan menebak skema.** Jika informasi ditandai **[TIDAK DIKETAHUI]** di dokumen, minta pemilik project memverifikasi di Supabase atau baca kode yang dirujuk — jangan mengarang kolom, constraint, atau policy.
2. **Bedakan "perilaku saat ini" dari "perilaku yang benar".** Bagian "Masalah yang Sudah Diketahui" di tiap dokumen mencatat bug yang ada. Refactor murni harus mempertahankan perilaku; perbaikan bug harus disetujui dan disebut eksplisit.
3. **Perubahan data berdampak ke dua klien.** Periksa pemakaian tabel/kolom di web **dan** mobile sebelum mengubahnya ([BACKEND.md §6](BACKEND.md)).
4. **Rumus Split Bill adalah kontrak** — ada di tiga tempat (`src/app/pages/split-bill/add.tsx`, `edit.tsx`, `mylui_mobile/lib/pages/split_bill_form_page.dart`) dan hasilnya harus identik.
5. **Nama ikon kategori adalah kontrak** antara DB, web (`AVAILABLE_ICONS`, `ICON_MAP`), dan mobile (`getCategoryIcon`).
6. **Banyak kode diduplikasi** (form add/edit, formatter, pemetaan ikon). Saat mengubah satu, cari kembarannya — daftar ada di [WEB.md §8](WEB.md) dan [MOBILE.md §10](MOBILE.md).
7. **Web tidak punya type-check, lint, atau test; test mobile rusak.** Verifikasi perubahan dengan `npm run build` (web) dan `flutter analyze` (mobile), lalu uji manual.
8. **Jangan menyalin kredensial** (URL/anon key Supabase) ke dokumen, log, atau layanan luar.
9. Path di dokumen relatif terhadap root repo kecuali disebut lain. Di [MOBILE.md](MOBILE.md), path `lib/...` relatif terhadap `mylui_mobile/`.

## Tentang dokumentasi ini

- Disusun dari pembacaan kode pada 2026-11-21 (commit web terakhir: `b202541`; kode mobile sebagian besar belum ter-commit).
- Dokumen mendeskripsikan kondisi **aktual**, termasuk bug dan kode mati, bukan kondisi ideal.
- Jika kode berubah, perbarui dokumen terkait. Jika skema Supabase diekspor ke repo, perbarui [BACKEND.md](BACKEND.md).
