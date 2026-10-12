# Perpustakaan Digital

## Konfigurasi

Sebelum menjalankan aplikasi, siapkan konfigurasi yang tidak disimpan di Git:

- Di Google Apps Script, tambahkan Script Properties `SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, `ADMIN_USERNAME`, dan `ADMIN_PASSWORD`.
- Buat `config.js` berdasarkan `config.example.js`, lalu isi `apiUrl` dengan URL deployment web app.
- Jalankan `testSetup()` setelah Script Properties terpasang.

`ADMIN.txt`, `config.js`, dan file database lokal dikecualikan dari Git karena dapat berisi kredensial atau data perpustakaan.
