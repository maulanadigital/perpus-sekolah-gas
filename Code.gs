/*******************************************************
 * PERPUSTAKAAN DIGITAL - TEMPLATE SEKOLAH
 * Google Apps Script - Code.gs (konfigurasi & dispatcher)
 *
 * Database : Google Sheets
 * Media    : Google Drive
 *
 * Struktur file project:
 *   Code.gs         - konfigurasi, doGet/doPost, dispatcher, kebijakan akses
 *   Setup.gs        - pembuatan sheet + data awal (jalankan testSetup dari editor)
 *   Auth.gs         - login, token sesi (CacheService), hash password SHA-256+salt
 *   Data.gs         - getAll (dashboard, cache 60 detik), buku, anggota, statistik
 *   Catalog.gs      - CRUD buku & anggota, upload cover/aset ke Drive
 *   Transactions.gs - peminjaman, pengembalian, kunjungan (LockService)
 *   Reports.gs      - laporan umum & laporan per-anggota
 *   Settings.gs     - pengaturan perpustakaan
 *   SheetUtils.gs   - helper Spreadsheet/tanggal/log
 *   Tests.gs        - fungsi uji yang dijalankan dari editor Apps Script
 *
 * Keamanan: semua aksi (kecuali ping/login/settings) wajib membawa
 * token sesi yang diterbitkan saat login. Lihat README.md.
 *******************************************************/

function requiredScriptProperty_(name){
  const value=PropertiesService.getScriptProperties().getProperty(name);
  if(!value)throw new Error('Configure '+name+' in Apps Script project properties.');
  return value;
}

const CONFIG = {
  get SPREADSHEET_ID(){return requiredScriptProperty_('SPREADSHEET_ID');},
  get DRIVE_FOLDER_ID(){return requiredScriptProperty_('DRIVE_FOLDER_ID');},
  SCHOOL_NAME: 'SMK Ibu Kartini Semarang'
};

const SHEETS = {
  USERS: 'USERS',
  ANGGOTA: 'ANGGOTA',
  BUKU: 'BUKU',
  KATEGORI: 'KATEGORI',
  PEMINJAMAN: 'PEMINJAMAN',
  PENGEMBALIAN: 'PENGEMBALIAN',
  KUNJUNGAN: 'KUNJUNGAN',
  LAPORAN_ANGGOTA: 'LAPORAN_ANGGOTA',
  PENGATURAN: 'PENGATURAN',
  LOG: 'LOG_AKTIVITAS'
};

const HEADERS = {
  USERS: ['ID User','Username','Password','Nama','Role','ID Anggota','Status'],
  ANGGOTA: ['ID Anggota','NIS/NIP','Nama Anggota','Kelas','Jurusan','Jenis Anggota','Status'],
  BUKU: ['ID Buku','ISBN','Judul','Penulis','Penerbit','Tahun Terbit','Kategori Utama','Subkategori','Rak','Stok','Tersedia','Cover','Sinopsis','Status'],
  KATEGORI: ['ID Kategori','Kategori Utama','Subkategori','Status'],
  PEMINJAMAN: ['ID Peminjaman','ID Anggota','ID Buku','Tanggal Peminjaman','Rencana Pengembalian','Tanggal Pengembalian','Status'],
  PENGEMBALIAN: ['ID Pengembalian','ID Peminjaman','ID Anggota','ID Buku','Tanggal Pengembalian','Status'],
  KUNJUNGAN: ['ID Kunjungan','ID Anggota','Tanggal','Jam Masuk','Jam Keluar','Keperluan'],
  LAPORAN_ANGGOTA: ['ID Laporan','Tahun','ID Anggota','Jumlah Dipinjam','Jumlah Dikembalikan','Masih Dipinjam','Tanggungan','Status'],
  PENGATURAN: ['Parameter','Nilai'],
  LOG: ['ID Log','Tanggal','ID User','Nama User','Aktivitas','Keterangan']
};

function doGet(e) {
  const p = e && e.parameter ? e.parameter : {};
  // Request tanpa parameter "action" -> sajikan halaman aplikasi (web app HTML).
  if (!String(p.action || '').trim()) return serveApp_();
  return output_(handleRequest_(p));
}

function doPost(e) {
  let data = {};
  try { data = JSON.parse(e.postData.contents || '{}'); }
  catch(err) { data = e && e.parameter ? e.parameter : {}; }
  return output_(handleRequest_(data));
}

function serveApp_() {
  try {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle(CONFIG.SCHOOL_NAME + ' - Perpustakaan Digital')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  } catch (err) {
    return output_(fail_('File HTML "index" belum ditambahkan ke project Apps Script.'));
  }
}

function output_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ===== KEBIJAKAN AKSES API ===== */
// Aksi publik (tidak memerlukan token).
const PUBLIC_ACTIONS = ['ping', 'login', 'settings'];
// Aksi khusus Admin.
const ADMIN_ACTIONS = ['getMembers', 'getLoans', 'saveBook', 'deleteBook', 'uploadBookCover',
  'uploadSchoolAsset', 'saveMember', 'setMemberStatus', 'deleteMember', 'saveSetting', 'generalReport'];
// Aksi khusus petugas perpustakaan (Admin atau Pustakawan).
const STAFF_ACTIONS = ['borrow', 'return', 'visit'];
const STAFF_ROLES = ['Admin', 'Pustakawan'];
// Aksi yang mengubah data -> cache dashboard dibersihkan.
const MUTATING_ACTIONS = ['saveBook', 'deleteBook', 'uploadBookCover', 'uploadSchoolAsset',
  'saveMember', 'setMemberStatus', 'deleteMember', 'borrow', 'return', 'visit', 'saveSetting'];
// Seluruh aksi yang dikenali dispatcher.
const KNOWN_ACTIONS = PUBLIC_ACTIONS.concat(ADMIN_ACTIONS, STAFF_ACTIONS,
  ['getAll', 'getBooks', 'getMyData', 'memberReport']);

function handleRequest_(p) {
  try {
    const action = String(p.action || '').trim();
    if (KNOWN_ACTIONS.indexOf(action) < 0) return fail_('Action tidak dikenali.');

    let session = null;
    if (PUBLIC_ACTIONS.indexOf(action) < 0) {
      session = getSession_(p.token);
      if (!session) return fail_('Sesi berakhir atau belum login. Silakan login kembali.', 'AUTH');
      const role = String(session.role || '');
      if (ADMIN_ACTIONS.indexOf(action) >= 0 && role !== 'Admin') {
        return fail_('Anda tidak memiliki akses untuk menjalankan aksi ini.', 'FORBIDDEN');
      }
      if (STAFF_ACTIONS.indexOf(action) >= 0 && STAFF_ROLES.indexOf(role) < 0) {
        return fail_('Aksi ini hanya untuk petugas perpustakaan.', 'FORBIDDEN');
      }
    }

    const result = routeAction_(action, p, session);
    if (result && result.success && MUTATING_ACTIONS.indexOf(action) >= 0) invalidateDashboardCache_();
    return result;
  } catch(err) {
    return fail_(err.message || String(err));
  }
}

/* ===== JEMBATAN FRONTEND (google.script.run) ===== */
// Dipanggil oleh index.html saat aplikasi di-host langsung oleh Apps Script
// (HtmlService). google.script.run hanya bisa memanggil fungsi global dengan
// parameter/return data JSON biasa, jadi seluruh request dibungkus menjadi
// satu payload — sama persis seperti doGet/doPost.
function apiServerCall(payload){
  return handleRequest_(payload || {});
}

function routeAction_(action, p, session) {
  switch(action) {
    case 'ping': return ok_('Koneksi Apps Script berhasil.', {school:CONFIG.SCHOOL_NAME});
    case 'login': return login_(p.username,p.password);
    case 'getAll': return getAllData_();
    case 'getBooks': return ok_('Data buku berhasil diambil.', {books:getBooks_()});
    case 'getMembers': return ok_('Data anggota berhasil diambil.', {members:getMembers_()});
    case 'getLoans': return ok_('Data peminjaman berhasil diambil.', {loans:getLoans_()});
    case 'getMyData': return getMyData_(p.idAnggota, session);
    case 'saveBook': return saveBook_(p);
    case 'uploadBookCover': return uploadBookCover_(p);
    case 'uploadSchoolAsset': return uploadSchoolAsset_(p);
    case 'deleteBook': return deleteBook_(p.idBuku);
    case 'saveMember': return saveMember_(p);
    case 'setMemberStatus': return setMemberStatus_(p.idAnggota,p.status);
    case 'deleteMember': return setMemberStatus_(p.idAnggota,'Lulus');
    case 'borrow': return borrowBook_(p);
    case 'return': return returnBook_(p);
    case 'visit': return saveVisit_(p);
    case 'generalReport': return generalReport_();
    case 'memberReport': return memberReport_(p.idAnggota, p.tahun, session);
    case 'settings': return getSettings_();
    case 'saveSetting': return saveSetting_(p.parameter,p.nilai);
    default: return fail_('Action tidak dikenali.');
  }
}

