# MyLui Mobile — Dokumentasi Sistem

> Dokumen ini ditulis agar bisa dibaca manusia maupun AI sebelum melakukan refactor.
> Semua pernyataan diturunkan langsung dari kode. Hal yang **tidak bisa dipastikan dari kode** ditandai **[TIDAK DIKETAHUI]**.
> Referensi lain: [README.md](README.md) (indeks), [BACKEND.md](BACKEND.md) (skema Supabase bersama), [WEB.md](WEB.md) (aplikasi React).

## 1. Ringkasan

| Hal | Nilai |
|---|---|
| Lokasi | `mylui_mobile/` (di dalam repo web) |
| Framework | Flutter (Dart SDK `^3.11.3`), Material 3 |
| Nama package | `mylui_mobile`, versi `1.0.0+1` |
| Nama tampil | "My Lui" (Android label & iOS display name) |
| Application ID | Android `com.example.mylui_mobile`, iOS `com.example.myluiMobile` (masih default template) |
| Backend | Supabase yang **sama** dengan web, diakses langsung via `supabase_flutter` |
| State management | Tidak ada library. `StatefulWidget` + `setState`, satu `ChangeNotifier` global untuk tema |
| Navigasi | `Navigator.push` + `MaterialPageRoute` (imperatif, tanpa named routes / router package) |
| Bahasa UI | Inggris (sebagian kecil teks Indonesia) |
| Font | `GoogleFonts.outfit` dipanggil inline di hampir semua `Text` |
| Platform folder | `android/`, `ios/`, `web/`, `macos/`, `linux/`, `windows/` ada; yang dikonfigurasi khusus hanya Android & iOS |

Aplikasi mobile adalah **port fitur dari web** (banyak komentar "mirrors web"), tetapi cakupannya lebih sempit dan ada beberapa perbedaan perilaku. Lihat §9.

### Status version control (penting)

- Hampir seluruh `mylui_mobile/` **belum di-commit** ke git repo induk. Dari folder `lib/`, hanya `lib/pages/splash_page.dart` yang ter-track (dan sedang termodifikasi). `lib/main.dart`, `lib/core/`, `lib/models/`, `lib/services/`, `lib/widgets/`, sebagian besar `lib/pages/`, serta `pubspec.yaml` berstatus *untracked*.
- Ada folder `mylui_mobile/mylui-mobile-flutter/` yang hanya berisi `.git` kosong (belum ada commit, remote `danielsetiawan/mylui-mobile-flutter`). Bukan bagian aplikasi.
- Artinya **tidak ada riwayat git** untuk kode mobile. Commit dulu sebelum refactor.

## 2. Cara Menjalankan

```bash
cd mylui_mobile
```

```bash
flutter pub get
```

```bash
flutter run
```

Konfigurasi Supabase **di-hardcode** di `lib/core/constants.dart` (`AppConstants.supabaseUrl`, `AppConstants.supabaseAnonKey`). Tidak ada `.env`, flavor, atau `--dart-define`.

Lint: `analysis_options.yaml` memakai `package:flutter_lints/flutter.yaml` tanpa aturan tambahan. Test: `test/widget_test.dart` adalah template bawaan Flutter (menguji `MyApp` + counter yang tidak ada) → **test pasti gagal compile**.

## 3. Dependency (`pubspec.yaml`)

| Package | Dipakai untuk | Status |
|---|---|---|
| `supabase_flutter ^2.8.1` | Auth + database | Dipakai |
| `intl ^0.19.0` | Format mata uang & tanggal (`id_ID`, `en_US`) | Dipakai |
| `google_fonts ^6.2.1` | Font Outfit | Dipakai (14 file) |
| `local_auth ^3.0.1` | Login biometrik | Dipakai (`biometric_service.dart`) |
| `flutter_secure_storage ^10.0.0` | Menyimpan email & password untuk biometrik | Dipakai (`secure_storage_service.dart`) |
| `flutter_linkify ^6.0.0`, `url_launcher ^6.3.0` | Link yang bisa diklik di Notes | Dipakai (`notes_page.dart`) |
| `fl_chart ^0.70.0` | — | **Tidak dipakai** (chart dashboard digambar manual dengan `CustomPainter`) |
| `cupertino_icons ^1.0.8` | — | Tidak dipakai di kode |
| dev: `flutter_launcher_icons`, `flutter_native_splash` | Generate ikon & splash native dari `assets/images/logo.png` | Konfigurasi di `flutter_launcher_icons.yaml`, `flutter_native_splash.yaml` |

Asset: hanya `assets/images/logo.png`.

## 4. Struktur Folder

```
mylui_mobile/
├── pubspec.yaml
├── lib/
│   ├── main.dart                     ← entry, ThemeNotifier global, MaterialApp (tema light/dark), AuthGate
│   ├── core/
│   │   ├── constants.dart            ← URL & anon key Supabase (hardcoded)
│   │   ├── colors.dart               ← AppColors (palet + cardShadow)
│   │   └── utils.dart                ← format mata uang/tanggal, friendlyError, showTopAlert
│   ├── models/                       ← class data + fromJson/toJson manual (tanpa codegen)
│   │   ├── transaction_model.dart    ← TransactionModel, TransactionDetail
│   │   ├── wallet_category_model.dart← WalletModel, CategoryModel
│   │   ├── budget_plan_model.dart    ← BudgetPlanModel, BudgetPlanItem
│   │   ├── split_bill_model.dart     ← SplitBillModel, SplitBillDetail
│   │   ├── note_model.dart           ← NoteModel
│   │   └── profile_model.dart        ← ProfileModel (tanpa field role)
│   ├── services/                     ← layer akses data (class biasa, dibuat langsung di tiap State)
│   │   ├── auth_service.dart
│   │   ├── transaction_service.dart
│   │   ├── wallet_category_service.dart
│   │   ├── planning_notes_service.dart   ← berisi DUA class: PlanningService & NotesService
│   │   ├── split_bill_service.dart
│   │   ├── biometric_service.dart
│   │   └── secure_storage_service.dart
│   ├── widgets/
│   │   ├── app_shell.dart            ← shell setelah login: header + IndexedStack 5 tab + floating nav
│   │   └── summary_card.dart         ← kartu ringkasan (dipakai dashboard)
│   └── pages/
│       ├── splash_page.dart
│       ├── login_page.dart           ← login + register dalam satu halaman
│       ├── register_page.dart        ← TIDAK DIPAKAI (tidak di-import di mana pun)
│       ├── dashboard_page.dart
│       ├── transactions_page.dart    ← list + getCategoryIcon()
│       ├── transaction_add_page.dart
│       ├── transaction_edit_page.dart
│       ├── planning_page.dart        ← list + _PlanCard + _PlanEditSheet (create/edit) dalam satu file
│       ├── notes_page.dart           ← list + _NoteCard + _NoteFormSheet dalam satu file
│       ├── split_bill_page.dart
│       └── split_bill_form_page.dart ← create & edit dalam satu form
├── assets/images/logo.png
├── test/widget_test.dart             ← template bawaan, rusak
├── fix_colors.py                     ← script sekali-pakai (regex replace warna), bukan bagian aplikasi
├── android/ ios/ web/ macos/ linux/ windows/
└── mylui-mobile-flutter/             ← hanya .git kosong, abaikan
```

Ukuran file terbesar (baris): `planning_page.dart` 1581, `transactions_page.dart` 1293, `transaction_edit_page.dart` 1138, `notes_page.dart` 960, `dashboard_page.dart` 787, `login_page.dart` 639. Sebagian besar isinya adalah kode styling inline.

## 5. Arsitektur & Alur Aplikasi

```
main()
  ├─ initializeDateFormatting('id_ID')
  ├─ Supabase.initialize(url, anonKey)
  └─ runApp(MyLuiApp)
        └─ MaterialApp(home: SplashPage)
              └─ (delay 800 ms) pushReplacement → AuthGate
                    └─ StreamBuilder(auth.onAuthStateChange)
                          ├─ session != null → AppShell
                          └─ session == null → LoginPage
```

Lapisan:

```
Page (StatefulWidget, setState)  →  Service (class, Supabase.instance.client)  →  Supabase
                                      ↑ mengembalikan Model (fromJson)
```

- Berbeda dengan web, mobile **punya layer service**: page tidak menulis query langsung (kecuali `app_shell.dart` yang memanggil `Supabase.instance.client.auth` untuk logout & update nama).
- Service dibuat dengan `final _service = XService();` di setiap State — tidak ada dependency injection maupun singleton.
- Semua service memakai `String get _userId => _client.auth.currentUser!.id` (force-unwrap; melempar jika belum login).
- **Tidak ada cache / state bersama antar halaman.** Setiap page memuat datanya sendiri. Wallet & kategori di-fetch ulang setiap kali form transaksi dibuka. Daftar bulan (`fetchMonthRange`) di-fetch terpisah oleh Transactions, Planning, Notes, dan form Add.
- Refresh antar halaman memakai nilai kembali navigasi: form melakukan `Navigator.pop(context, true)`, pemanggil menjalankan reload jika hasilnya `true`.

### AppShell (`widgets/app_shell.dart`)

- `IndexedStack` berisi 5 halaman tetap (semua dibuat sekaligus dan tetap hidup): `DashboardPage`, `TransactionsPage`, `PlanningPage`, `NotesPage`, `SplitBillPage`.
- Karena `IndexedStack`, berpindah tab **tidak** memuat ulang data. Contoh: menambah transaksi di tab Activity tidak memperbarui Dashboard sampai aplikasi dibuka ulang atau user melakukan refresh di halaman itu.
- Bottom nav melayang (`_FloatingNavBar`): Dashboard, Activity, Planning, Notes, Split Bill.
- Header (`_AppHeader`): logo, "MyLui", tombol Edit Profile, toggle tema, Logout.
- Edit Profile: mengubah `full_name` di **user metadata Auth** (`auth.updateUser(data: {full_name})`), **bukan** tabel `profiles`. Header membaca nama dari `userMetadata`, sedangkan Dashboard membaca dari tabel `profiles` → keduanya bisa berbeda. (Web meng-update tabel `profiles`.)

### Tema

- `ThemeNotifier` (global `themeNotifier` di `main.dart`), default **light**, **tidak dipersistenkan** (reset ke light setiap aplikasi dibuka; tidak mengikuti tema sistem).
- `ThemeData` light & dark didefinisikan di `main.dart`, tetapi hampir semua widget **tidak memakai `Theme.of(context)` untuk warna**. Tiap State mendefinisikan getter sendiri (`isDark`, `bgColor`, `cardColor`, `textColor`, `subColor`, `borderColor`, `fieldBg`) yang memilih nilai dari `AppColors`. Getter ini diduplikasi di hampir setiap page.
- Palet: `core/colors.dart` (`AppColors.primary = #059669`, dark mode bergaya "Telegram Night", sama dengan web).

## 6. Autentikasi

File: `pages/login_page.dart`, `services/auth_service.dart`, `services/biometric_service.dart`, `services/secure_storage_service.dart`.

| Alur | Implementasi |
|---|---|
| Login email/password | `AuthService.signIn` → `auth.signInWithPassword`. Setelah sukses, **email & password plaintext disimpan** ke `flutter_secure_storage` (key `user_email`, `user_password`). |
| Register | `AuthService.signUp` → `auth.signUp(data: {full_name})` lalu **upsert ke tabel `profiles`** `{id, email, full_name}`. Kemudian mode kembali ke login dengan pesan "check your email or login". |
| Google | `auth.signInWithOAuth(OAuthProvider.google, redirectTo: 'io.supabase.flutter://callback')`. Loading dimatikan paksa setelah 2 detik. |
| Biometrik | Tombol muncul jika ada kredensial tersimpan **dan** perangkat mendukung. `local_auth.authenticate` (`biometricOnly: false`, boleh fallback PIN) → isi field dari secure storage → jalankan login password biasa. |
| Logout | `auth.signOut()`. **Kredensial di secure storage tidak dihapus** (`clearCredentials()` ada tapi tidak pernah dipanggil). |
| Sesi | Dikelola `supabase_flutter` (persist otomatis). `AuthGate` bereaksi terhadap `onAuthStateChange`. |

Validasi form: email harus mengandung `@`; password minimal **6** karakter (padahal hint mode register bertuliskan "Min. 8 characters"; web mensyaratkan 8).

Konfigurasi native:

- **Android** (`android/app/src/main/AndroidManifest.xml`): permission `INTERNET`, `USE_BIOMETRIC`; intent-filter deep link `io.supabase.flutter://callback` untuk OAuth. `MainActivity` extends `FlutterFragmentActivity` (syarat `local_auth`).
- **iOS** (`ios/Runner/Info.plist`): ada `NSFaceIDUsageDescription`. **Tidak ada `CFBundleURLTypes`** untuk scheme `io.supabase.flutter` → callback Google OAuth kemungkinan tidak kembali ke aplikasi di iOS.

`register_page.dart` adalah halaman registrasi lama yang berdiri sendiri; sudah tidak dipakai (digantikan mode register di `login_page.dart`).

## 7. Halaman & Fitur

### 7.1 Dashboard — `pages/dashboard_page.dart`

4 request paralel saat init:

| Request | Dipakai untuk |
|---|---|
| `TransactionService.fetchProfile()` | Nama sapaan (`profiles.full_name`) |
| `fetchTransactionsFiltered(limit: 10)` | "Recent Activities" (10 transaksi terbaru, semua bulan) |
| `fetchLast7DaysTransactions()` | Chart |
| `fetchStats(filterMonthYear: bulanIni)` | Kartu Total Balance / Income / Expense |

- "Total Balance" = income − expense **bulan berjalan** (sama dengan web; bukan saldo wallet).
- Label tren selalu teks statis "This Month" (tidak ada perbandingan dengan bulan lalu seperti di web).
- Chart "Cash Flow 7 Days": **satu garis net flow** per hari (dalam juta), digambar `_SimpleLineChartPainter`. Web menampilkan dua area (income & expense).
- ⚠️ Perhitungan chart: `value = type == 'income' ? amount : -amount` → transaksi **transfer ikut dihitung sebagai pengeluaran**.
- ⚠️ Judul item "Recent Activities" memakai `tx.category` (kolom teks legacy). Transaksi yang dibuat lewat form baru (web/mobile) mengisi `category = ''` → **judul kosong**. Tidak memakai nama kategori hasil join.
- Tidak ada pratinjau budget plan (web punya).

### 7.2 Activity — `pages/transactions_page.dart`

- State filter: `_filterType` (`all`/`income`/`expense`; chip All / In / Out), `_filterMonthYear` (default bulan berjalan, `''` = All-Time), `_filterIncomeId`, pencarian (debounce via `Timer`).
- Data: `fetchTransactionsFiltered` + `fetchStats` dipanggil paralel pada `_loadData(reset: true)`.
- Pagination: scroll listener (400 px sebelum akhir). Halaman pertama 10 (`_initialLimit`), berikutnya 5 (`_loadMoreLimit`). `hasMore` = jumlah hasil ≥ limit (tanpa `count`).
- Dropdown bulan: dari `fetchMonthRange()`; fallback 12 bulan terakhir jika gagal/kosong.
- Dropdown "All Income": dari `fetchMonthIncomes(monthYear)`; di-reset saat bulan diganti.
- Dikelompokkan per tanggal (header via `formatDateHeader`: `TODAY, …` / `YESTERDAY, …` / nama hari; menampilkan jumlah "N Txn").
- Tap kartu → `TransactionEditPage`; tombol tambah → `TransactionAddPage`. Reload jika hasil `true`.
- Judul kartu: `description` jika ada, selain itu `category` (legacy). Badge kategori: `categoryName` (join) jika ada.
- `getCategoryIcon(String?)` (top-level function di file ini): memetakan nama ikon lucide dari DB → `IconData` Material (56 case; default `Icons.label_rounded`). Harus sinkron dengan `AVAILABLE_ICONS` web.

Perbedaan query dibanding web (lihat `services/transaction_service.dart`):

- `linked_income` **di-join dari DB** (`linked_income:linked_income_id(id,description,category)`) — web me-resolve di klien.
- Jika `filterIncomeId` aktif, filter `type` **diabaikan**.
- `fetchStats` satu query (`select type, amount`, `.neq('type','transfer')`), tidak dipengaruhi `filterType` maupun pencarian.

### 7.3 Tambah Transaksi — `pages/transaction_add_page.dart`

- Halaman penuh (push). Tipe: Expense / Income / Transfer. Mengganti tipe me-reset wallet, tujuan, kategori, linked income.
- Memuat wallet + kategori (`WalletCategoryService`) dan sumber income bulan terpilih.
- Field & aturan sama dengan web (lihat tabel di [WEB.md §7.3](WEB.md)), dengan perbedaan:
  - **Tidak ada "tambah wallet/kategori inline".** Mobile hanya bisa memilih master data yang sudah ada.
  - Detail item hanya disimpan jika nama terisi **dan** amount > 0.
  - Tanggal default `DateTime.now().toIso8601String().split('T')[0]` → tanggal **lokal** (web memakai UTC).
  - Input amount diformat dengan pemisah ribuan titik; di-parse dengan menghapus `.` dan `,`.
- Simpan: `addTransaction` (header, `category` legacy = `''`) lalu loop `addTransactionDetail` satu per satu.

### 7.4 Edit Transaksi — `pages/transaction_edit_page.dart`

- Menerima `TransactionModel` lewat constructor (tidak fetch ulang).
- Simpan: `updateTransaction` lalu per detail `updateTransactionDetail` / `addTransactionDetail`. Ada tombol simpan detail saja, dan "Save All Changes".
- Hapus detail: langsung DELETE ke DB saat ditekan. Hapus transaksi: dialog konfirmasi → `deleteTransaction`.
- ⚠️ `updateTransaction` **selalu mengirim `category: ''`** (parameter default; page tidak mengisinya) → mengedit transaksi lama di mobile **menghapus isi kolom legacy `category`** (mis. data hasil impor Init di web).
- ⚠️ Bulan pemilih "Linked Income" diinisialisasi dari bulan **transaksi itu sendiri**, bukan bulan income yang ditautkan (bug yang sudah diperbaiki di web). Jika income ada di bulan lain, dropdown menampilkan "Loading / Old Data...".
- Opsi bulan di sini = 12 bulan terakhir yang dibangkitkan lokal (bukan dari `fetchMonthRange`).

### 7.5 Planning — `pages/planning_page.dart`

- List + pencarian (debounce) + filter bulan (`created_at`) + infinite scroll (300 px, 10 per halaman).
- Create & edit memakai bottom sheet yang sama: `_PlanEditSheet` (`plan == null` → create).
- Perbedaan dari web:
  - **Total Budget wajib diisi** (validator "Budget wajib diisi"). Web: opsional, otomatis dari jumlah item.
  - Status bisa dipilih langsung di form (create maupun edit). Web: plan baru selalu `planning`, status diubah di modal detail.
  - Tidak ada modal detail terpisah; tap kartu langsung membuka sheet edit (hapus ada di dalam sheet).
  - Edit: `updatePlan` → `deleteItem` satu per satu untuk semua item lama → `addItem` satu per satu (N request, tidak atomik).
  - Item dengan nama kosong dilewati; estimate kosong → 0.

### 7.6 Notes — `pages/notes_page.dart`

- List + pencarian + filter bulan + infinite scroll (200 px, 10 per halaman).
- Create/edit lewat bottom sheet `_NoteFormSheet`. Hapus dengan dialog konfirmasi.
- Fitur khusus mobile: URL di isi catatan dideteksi (`flutter_linkify`) dan bisa dibuka (`url_launcher`, external app).
- Kartu menampilkan waktu `d MMM yyyy · HH:mm`.

### 7.7 Split Bill — `pages/split_bill_page.dart`, `pages/split_bill_form_page.dart`

- List (`fetchBills`, sudah termasuk `split_bill_details`), kartu menampilkan judul, tanggal, jumlah orang, grand total.
- `SplitBillFormPage(bill)`: satu form untuk create & edit (`bill == null` → create).
- Rumus (`_calc`) identik dengan web — lihat [WEB.md §7.6](WEB.md). Komentar kode: "mirrors web logic exactly".
- ⚠️ **Format penyimpanan detail BERBEDA dari web** (inkompatibel):

  | Kolom `split_bill_details` | Ditulis Web | Ditulis Mobile |
  |---|---|---|
  | `original_price` | harga × qty (total baris) | **harga satuan** |
  | `qty` | tidak ditulis | ditulis |
  | `final_price` | ✓ | ✓ |
  | `weight_percentage`, `tax_amount`, `service_amount`, `discount_amount`, `delivery_amount`, `admin_amount` | ✓ | **tidak ditulis** |
  | `person_name` kosong | `'Unknown'` | `'Unassigned'` |
  | Item harga 0 | dibuang | ikut disimpan (asal ada ≥1 item valid) |

  Akibat: bill dengan qty > 1 yang dibuat di mobile akan terhitung salah saat dibuka/di-edit di web (web menganggap qty = 1 dan `original_price` = total). Detail lengkap di [BACKEND.md](BACKEND.md).
- Edit: update header → delete semua detail → insert ulang. Hapus: delete detail lalu header.

## 8. Referensi Service

### `TransactionService` (`services/transaction_service.dart`)

| Method | Keterangan |
|---|---|
| `fetchProfile()` | Baris `profiles` user (`maybeSingle`) |
| `fetchTransactionsFiltered({filterType, filterMonthYear, searchTerm, filterIncomeId, start, limit})` | List + join detail, wallet, to_wallet, kategori, linked_income. Urut `date DESC, created_at DESC` |
| `fetchStats({filterMonthYear, filterIncomeId})` | `{income, expense, balance}`; transfer dikecualikan; dijumlah di klien |
| `fetchIncomeSources({monthYear})` / `fetchMonthIncomes` | Income pada satu bulan (`fetchMonthIncomes` hanya alias) |
| `addTransaction(...)` | Insert header; return model |
| `updateTransaction(...)` | Update header (selalu menimpa `category`) |
| `deleteTransaction(id)` | |
| `addTransactionDetail` / `updateTransactionDetail` / `deleteTransactionDetail` | CRUD `transaction_details` |
| `fetchLast7DaysTransactions()` | `date >= hari ini − 7` (jadi 8 hari kalender), urut naik |
| `fetchMonthRange()` | Daftar `yyyy-MM` terbaru → terlama (logika sama dengan `MonthRangeContext` web) |
| `static calcSummary(list)` | Hitung ringkasan dari list (tidak dipakai jalur utama) |

### Service lain

| Class | File | Method |
|---|---|---|
| `AuthService` | `auth_service.dart` | `currentUser`, `authStateChanges`, `signIn`, `signInWithGoogle`, `signUp`, `signOut` |
| `WalletCategoryService` | `wallet_category_service.dart` | `fetchWallets()` (urut nama), `fetchCategories({type})` — **hanya baca** |
| `PlanningService` | `planning_notes_service.dart` | `fetchPlans`, `createPlan`, `updatePlan`, `updatePlanStatus`, `deletePlan`, `addItem`, `updateItem`, `deleteItem` |
| `NotesService` | `planning_notes_service.dart` | `fetchNotes`, `createNote`, `updateNote`, `deleteNote` |
| `SplitBillService` | `split_bill_service.dart` | `fetchBills`, `createBill`, `updateBill`, `deleteBill` |
| `BiometricService` | `biometric_service.dart` | `isBiometricAvailable`, `getAvailableBiometrics`, `authenticate` |
| `SecureStorageService` | `secure_storage_service.dart` | `saveCredentials`, `getCredentials`, `clearCredentials` |

### Utility (`core/utils.dart`)

`formatCurrency(double)` → `Rp 8.500.000`; `formatCompactCurrency` → `Rp 8.500K` (≥ 1000); `formatMonthYear('yyyy-MM-..')` → "Maret 2026"; `formatDate` → "26 Mar 2026"; `reverseDateFormat` → `26/03/2026`; `formatDateHeader`; `defaultMonthYear()`; `friendlyError(e)` (menyamarkan error teknis menjadi pesan umum berbahasa Inggris); `showTopAlert(context, message, {backgroundColor})` (notifikasi overlay di atas layar, auto-dismiss 3 detik — pengganti SnackBar di seluruh aplikasi).

## 9. Perbandingan Fitur Web vs Mobile

| Fitur | Web | Mobile |
|---|---|---|
| Dashboard | ✓ (tren vs bulan lalu, chart 2 seri, preview plan) | ✓ (lebih sederhana, chart net flow) |
| Transaksi CRUD + detail + link income | ✓ | ✓ |
| Tambah wallet/kategori inline dari form | ✓ | ✗ |
| Master Data Wallets / Categories (CRUD) | ✓ | ✗ (hanya baca) |
| Planning | ✓ | ✓ (aturan budget & status berbeda) |
| Notes | ✓ | ✓ (+ link bisa diklik) |
| Split Bill | ✓ | ✓ (format simpan berbeda) |
| Init Data (admin) | ✓ | ✗ (model profil bahkan tidak punya `role`) |
| Sembunyikan nominal | ✓ | ✗ |
| Tema gelap | ✓ (tersimpan di localStorage) | ✓ (tidak tersimpan) |
| Login biometrik | ✗ | ✓ |
| Edit nama profil | update tabel `profiles` | update Auth user metadata |
| Insert `profiles` saat register | ✗ | ✓ (upsert) |
| Password minimal | 8 | 6 |

## 10. Masalah yang Sudah Diketahui (wajib dibaca sebelum refactor)

### Bug / perilaku berisiko

1. **Edit transaksi menimpa kolom legacy `category` dengan string kosong** (§7.4).
2. **Format `split_bill_details` tidak kompatibel dengan web** (§7.7).
3. **Chart dashboard menghitung transfer sebagai pengeluaran** (§7.1).
4. **Judul "Recent Activities" kosong** untuk transaksi tanpa `category` legacy (§7.1); judul kartu Activity juga kosong jika `description` dan `category` sama-sama kosong (tidak fallback ke nama kategori).
5. **Password plaintext disimpan di secure storage** dan tidak dihapus saat logout; setelah logout tombol biometrik tetap bisa login ke akun yang sama.
6. **Bulan "Linked Income" di form edit** salah inisialisasi (§7.4).
7. **Nama profil tidak sinkron**: edit nama menulis ke Auth metadata, dashboard membaca tabel `profiles`.
8. **`TransactionModel.fromJson` melakukan cast non-null** pada `category` (`as String`) dan `user_id` → crash jika DB mengembalikan `null` untuk `category`.
9. **Data antar tab tidak ter-refresh** (IndexedStack, §5).
10. **Operasi tidak atomik & N+1 request**: transaksi+detail, plan+item (delete/insert satu per satu), split bill.
11. **Error ditelan** di banyak tempat (`catch (_) {}`), mis. gagal memuat wallet/kategori → dropdown kosong tanpa pesan.
12. **Pencarian tidak di-escape** saat disisipkan ke filter PostgREST `.or(...)` (koma/kurung merusak query) — sama dengan web.
13. **Google OAuth di iOS** kemungkinan tidak berfungsi (tidak ada URL scheme).
14. Validasi password 6 karakter vs hint "Min. 8 characters".
15. `fetchLast7DaysTransactions` mengambil 8 hari; chart hanya memakai 7.
16. `main.dart`: `themeNotifier.removeListener(() => setState(() {}))` melepas closure baru (listener asli tidak pernah terlepas). Tidak berdampak karena widget root hidup selamanya.
17. `splash_page.dart` dan `login_page.dart` masih memakai `withOpacity` (deprecated) sementara file lain memakai `withValues`.

### Kode mati / sisa template

- `lib/pages/register_page.dart` — tidak dipakai.
- `test/widget_test.dart` — template rusak.
- `fix_colors.py`, `README.md` (template "A new Flutter project"), `mylui-mobile-flutter/`.
- Dependency `fl_chart`, `cupertino_icons`.
- `TransactionService.calcSummary`, `PlanningService.updatePlanStatus` / `updateItem`, `SecureStorageService.clearCredentials`, `BiometricService.getAvailableBiometrics`, `AuthService.authStateChanges` — didefinisikan tapi tidak dipakai jalur utama (verifikasi dengan `flutter analyze` sebelum menghapus).
- Folder platform `web/`, `macos/`, `linux/`, `windows/` — hasil `flutter create`, tidak dikonfigurasi.

### Utang teknis struktural

- File page sangat besar; UI, state, dan logika bercampur. Banyak widget privat (`_PlanEditSheet`, `_NoteFormSheet`, `_TransactionCard`) di dalam file page.
- Styling inline berulang (`GoogleFonts.outfit(...)`, getter warna per-State) — `ThemeData` di `main.dart` praktis tidak dimanfaatkan.
- Helper diduplikasi antar page: formatter ribuan (regex `(\d{1,3})(?=(\d{3})+(?!\d))`), `_buildLabel`/`_label`, `_generateMonthOptions`, pola debounce + infinite scroll, class `_DetailItem` (ada di add & edit), `_ItemRow` (planning & split bill, isi berbeda).
- `TransactionAddPage` dan `TransactionEditPage` hampir duplikat.
- Tidak ada state management / cache; tidak ada DI; tidak ada test.
- Kredensial Supabase hardcoded; application id masih `com.example.*`.
- Penamaan tidak konsisten: `TransactionDetail.transaction_id` (snake_case di Dart), `toWalletIdRaw`, dua service dalam satu file `planning_notes_service.dart`.

## 11. Peta Cepat: "Kalau mau mengubah X, buka file mana?"

| Ingin mengubah | File |
|---|---|
| URL / key Supabase | `lib/core/constants.dart` |
| Tema, warna | `lib/main.dart` (ThemeData), `lib/core/colors.dart`, getter warna di tiap page |
| Tab / navigasi bawah / header | `lib/widgets/app_shell.dart` |
| Alur start & auth gate | `lib/pages/splash_page.dart`, `lib/main.dart` (`AuthGate`) |
| Login / register / biometrik | `lib/pages/login_page.dart`, `lib/services/{auth,biometric,secure_storage}_service.dart` |
| Query transaksi | `lib/services/transaction_service.dart` |
| List transaksi & ikon kategori | `lib/pages/transactions_page.dart` (`getCategoryIcon`) |
| Form transaksi | `lib/pages/transaction_add_page.dart` **dan** `transaction_edit_page.dart` |
| Dashboard | `lib/pages/dashboard_page.dart`, `lib/widgets/summary_card.dart` |
| Planning | `lib/pages/planning_page.dart`, `lib/services/planning_notes_service.dart` (`PlanningService`) |
| Notes | `lib/pages/notes_page.dart`, `lib/services/planning_notes_service.dart` (`NotesService`) |
| Split bill (rumus) | `lib/pages/split_bill_form_page.dart` (`_calc`) — jaga tetap sama dengan web |
| Split bill (simpan) | `lib/services/split_bill_service.dart` |
| Bentuk data | `lib/models/*.dart` |
| Format angka/tanggal, alert | `lib/core/utils.dart` |
| Deep link OAuth, permission | `android/app/src/main/AndroidManifest.xml`, `ios/Runner/Info.plist` |
| Ikon & splash native | `flutter_launcher_icons.yaml`, `flutter_native_splash.yaml`, `assets/images/logo.png` |
