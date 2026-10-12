# Perpustakaan Digital — SMK (Google Apps Script)

Aplikasi perpustakaan berbasis **Google Apps Script** web app dengan database
**Google Sheets** dan media **Google Drive**. Frontend SPA HTML dilayani langsung
oleh web app melalui `HtmlService`, dan berkomunikasi dengan backend lewat API JSON
(`doGet`/`doPost`).

## Struktur project

| File | Peran |
|---|---|
| `appsscript.json` | Manifest: V8, zona waktu `Asia/Jakarta`, scope OAuth, setting web app |
| `Code.gs` | Konfigurasi, `doGet`/`doPost`, dispatcher, kebijakan akses API |
| `Setup.gs` | Pembuatan sheet + seed data (kategori, pengaturan, admin) |
| `Auth.gs` | Login, token sesi (CacheService, TTL 6 jam), hash password SHA-256+salt |
| `Data.gs` | `getAll` (dashboard, cache server 60 detik), buku, anggota, statistik |
| `Catalog.gs` | CRUD buku & anggota, upload cover/aset ke Drive |
| `Transactions.gs` | Peminjaman, pengembalian, kunjungan (dilindungi `LockService`) |
| `Reports.gs` | Laporan umum & laporan per-anggota |
| `Settings.gs` | Pengaturan perpustakaan |
| `SheetUtils.gs` | Helper Spreadsheet/tanggal/log |
| `Tests.gs` | Fungsi uji yang dijalankan dari editor Apps Script |
| `index.html` | Frontend SPA |
| `config.js` | **Hanya** untuk hosting frontend terpisah (berisi URL API) — tidak di-commit |
| `config.example.js` | Template `config.js` |
| `.clasp.json`, `.claspignore`, `package.json` | Workflow push/deploy dengan clasp |

## Setup

### 1. Script Properties

Di editor Apps Script: **Project Settings › Script Properties**, tambahkan:

| Property | Keterangan |
|---|---|
| `SPREADSHEET_ID` | ID Google Sheets database perpustakaan |
| `DRIVE_FOLDER_ID` | ID folder Drive untuk cover buku & aset sekolah |
| `ADMIN_USERNAME` | Username admin awal (dipakai saat seeding) |
| `ADMIN_PASSWORD` | Password admin awal (dipakai saat seeding, disimpan ter-hash) |

### 2. Setup database

Jalankan fungsi `testSetup()` dari editor Apps Script. Fungsi ini membuat seluruh
sheet, seed kategori/pengaturan, dan membuat akun admin pertama (password langsung
di-hash SHA-256 + salt).

> Catatan: aksi `setup` tidak lagi tersedia lewat API publik — setup hanya dijalankan
> dari editor demi keamanan.

### 3. Deploy web app

**Deploy › New deployment › Web app**:

- *Execute as*: **Me** (sesuai manifest `webapp.executeAs`)
- *Who has access*: **Anyone** (sesuai manifest `webapp.access`)

Setelah deploy, buka URL `/exec` — halaman aplikasi (login) akan tampil.
Frontend otomatis memakai URL tersebut sebagai endpoint API (tidak perlu `config.js`).

### 4. Workflow clasp (disarankan)

```bash
npm install            # memasang @google/clasp
npx clasp login        # sekali saja
# isi "scriptId" di .clasp.json (bisa dari URL editor: script.google.com/macros/d/<SCRIPT_ID>/edit)
npx clasp push         # upload semua file .gs/.html + manifest
npx clasp deploy       # buat versi deployment baru
```

File yang di-push otomatis difilter oleh `.claspignore` (hanya `*.gs`, `*.html`,
`appsscript.json`).

### 5. Hosting frontend terpisah (opsional)

Frontend tetap bisa dihosting statis (hosting sekolah, GitHub Pages, dsb.):
salin `index.html` dan buat `config.js` dari `config.example.js` lalu isi `apiUrl`
dengan URL web app. Jika `config.js` tidak ada dan halaman dibuka di dalam domain
Apps Script, URL API otomatis dideteksi dari `window.location`.

## Model keamanan

- **Token sesi** — login menerbitkan token UUID yang disimpan di `CacheService`
  (TTL 6 jam). Frontend membawa token di setiap request; aksi selain
  `ping`/`login`/`settings` akan ditolak tanpa token (`code: "AUTH"`).
- **Otorisasi per peran** — aksi tulis/laporan umum hanya `Admin`; peminjaman /
  pengembalian / kunjungan untuk `Admin` & `Pustakawan`; siswa/guru hanya dapat
  membaca data & laporan miliknya sendiri (`getMyData`, `memberReport`).
- **Password** disimpan sebagai `sha256$<salt>$<hash>`. Password lama yang masih
  plaintext otomatis di-hash saat login pertama (migrasi mandiri).
- **Anti race-condition** peminjaman/pengembalian memakai `LockService`.
- File cover/aset dibagikan via link view-only Drive.

## Catatan & keterbatasan

- Akun siswa/guru saat ini dibuat langsung di sheet `USERS` (form "Tambah Anggota"
  hanya membuat baris anggota, belum membuat akun login).
- Password admin mengikuti nilai awal saat seeding; untuk mengganti password,
  ubah hash di sheet `USERS` atau hapus baris admin lalu jalankan ulang seeding
  (atau tambah user baru).
- `getAll` di-cache server 60 detik; setiap aksi tulis membersihkan cache secara
  otomatis, dan tombol **⟳ Sinkron Data** memaksa data terbaru dari klien.
- Tidak ada rate-limiting login; pertimbangkan penambahan jika dipublikasikan
  terbuka.
- Sesi berlaku 6 jam; setelah itu pengguna harus login kembali.

## Menjalankan uji

Dari editor Apps Script jalankan: `testSetup`, `testPing`, `testLoginAdmin`,
`testGeneralStats`, `testGetLoans`, `testDriveFolder`, lalu lihat hasil di
**Executions/Logs**.

