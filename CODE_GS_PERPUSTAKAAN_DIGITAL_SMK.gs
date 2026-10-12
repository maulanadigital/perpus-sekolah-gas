/*******************************************************
 * PERPUSTAKAAN DIGITAL - TEMPLATE SEKOLAH
 * Google Apps Script - code.gs
 *
 * Database : Google Sheets / AppSheet source
 * Media    : Google Drive
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
  return output_(handleRequest_(e && e.parameter ? e.parameter : {}));
}

function doPost(e) {
  let data = {};
  try { data = JSON.parse(e.postData.contents || '{}'); }
  catch(err) { data = e && e.parameter ? e.parameter : {}; }
  return output_(handleRequest_(data));
}

function output_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleRequest_(p) {
  try {
    const action = String(p.action || '').trim();
    switch(action) {
      case 'ping': return ok_('Koneksi Apps Script berhasil.', {school:CONFIG.SCHOOL_NAME});
      case 'setup': return setupSheets_();
      case 'login': return login_(p.username,p.password);
      case 'getAll': return getAllData_();
      case 'getBooks': return ok_('Data buku berhasil diambil.', {books:getBooks_()});
      case 'getMembers': return ok_('Data anggota berhasil diambil.', {members:getMembers_()});
      case 'getLoans': return ok_('Data peminjaman berhasil diambil.', {loans:getLoans_()});
      case 'getMyData': return getMyData_(p.idAnggota);
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
      case 'memberReport': return memberReport_(p.idAnggota,p.tahun);
      case 'settings': return getSettings_();
      case 'saveSetting': return saveSetting_(p.parameter,p.nilai);
      default: return fail_('Action tidak dikenali.');
    }
  } catch(err) {
    return fail_(err.message || String(err));
  }
}

/* ===== SETUP ===== */

function setupSheets_() {
  const ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  Object.keys(SHEETS).forEach(key=>{
    const name=SHEETS[key];
    let sh=ss.getSheetByName(name);
    if(!sh) sh=ss.insertSheet(name);
    const headers=HEADERS[key];
    if(sh.getLastRow()===0){
      sh.getRange(1,1,1,headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    }
  });
  seedCategories_(ss); seedSettings_(ss); seedAdmin_(ss);
  return ok_('Setup database selesai.',{sheets:Object.values(SHEETS)});
}

function seedCategories_(ss){
  const sh=ss.getSheetByName(SHEETS.KATEGORI);
  if(sh.getLastRow()>1)return;
  sh.getRange(2,1,6,4).setValues([
    ['KT001','Buku Non Teks','-','Aktif'],
    ['KT002','Buku Teks','Mapel Umum','Aktif'],
    ['KT003','Buku Teks','Mapel Produktif RPL','Aktif'],
    ['KT004','Buku Teks','Mapel Produktif Kuliner','Aktif'],
    ['KT005','Buku Teks','Mapel Produktif DKV','Aktif'],
    ['KT006','Buku Teks','Mapel Produktif Busana','Aktif']
  ]);
}

function seedSettings_(ss){
  const sh=ss.getSheetByName(SHEETS.PENGATURAN);
  if(sh.getLastRow()>1)return;
  const rows=[
    ['Nama Sekolah',CONFIG.SCHOOL_NAME],
    ['Lama Peminjaman','7'],
    ['Maksimal Buku Siswa','2'],
    ['Maksimal Buku Guru','5'],
    ['Denda Keterlambatan','0'],
    ['Tahun Pelajaran','2026/2027'],
    ['Nama Kepala Sekolah',''],
    ['NIP Kepala Sekolah',''],
    ['Nama Pustakawan',''],
    ['NIP Pustakawan',''],
    ['Link Flipbook',''],
    ['Link Flipbook Perpustakaan',''],
    ['Logo Sekolah',''],
    ['Foto Background','']
  ];
  sh.getRange(2,1,rows.length,2).setValues(rows);
}

function seedAdmin_(ss){
  const sh=ss.getSheetByName(SHEETS.USERS);
  if(sh.getLastRow()>1)return;
  sh.appendRow(['ADM001',requiredScriptProperty_('ADMIN_USERNAME'),requiredScriptProperty_('ADMIN_PASSWORD'),'Pustakawan','Admin','','Aktif']);
}

/* ===== LOGIN ===== */

function login_(username,password){
  username=String(username||'').trim().toLowerCase();
  password=String(password||'');
  if(!username||!password)return fail_('Username/NIS dan password wajib diisi.');
  const rows=readObjects_(SHEETS.USERS);
  const user=rows.find(r=>
    String(r.Username||'').trim().toLowerCase()===username &&
    String(r.Password||'')===password &&
    String(r.Status||'').trim().toLowerCase()==='aktif'
  );
  if(!user)return fail_('Username/NIS atau password salah.');
  const safeUser={
    idUser:user['ID User'],username:user.Username,name:user.Nama,
    role:user.Role,idAnggota:user['ID Anggota']||'',status:user.Status
  };
  logActivity_(safeUser.idUser,safeUser.name,'Login','Berhasil');
  return ok_('Login berhasil.',{user:safeUser});
}

/* ===== ONE-CALL DASHBOARD DATA ===== */

function getAllData_(){
  const books=getBooks_();
  const members=getMembers_();
  return ok_('Data berhasil diambil.',{
    books:books,
    members:members,
    loans:getLoans_(),
    categories:readObjects_(SHEETS.KATEGORI),
    settings:getSettingsObject_(),
    stats:generalStats_(books,members)
  });
}

function getBooks_(){ return readObjects_(SHEETS.BUKU); }
function getMembers_(){ return readObjects_(SHEETS.ANGGOTA); }

function generalStats_(books,members){
  books=books || getBooks_();
  members=members || getMembers_();

  const loans=readObjects_(SHEETS.PEMINJAMAN);
  const returns=readObjects_(SHEETS.PENGEMBALIAN);

  const totalBuku=books.reduce((sum,b)=>sum+Number(b.Stok||0),0);
  const judulBuku=books.filter(b=>String(b.Status||'Aktif').toLowerCase()!=='tidak aktif').length;
  const bukuTersedia=books.reduce((sum,b)=>sum+Number(b.Tersedia||0),0);
  const totalAnggota=members.length;
  const anggotaAktif=members.filter(m=>String(m.Status||'').toLowerCase()==='aktif').length;

  const activeLoans=loans.filter(r=>
    String(r['Tanggal Pengembalian']||'').trim()==='' &&
    String(r.Status||'').toLowerCase()!=='dikembalikan'
  );

  const now=new Date();
  const month=now.getMonth(), year=now.getFullYear();

  const inThisMonth=r=>{
    const d=parseDate_(r['Tanggal Peminjaman']||r['Tanggal Pengembalian']);
    return d && d.getMonth()===month && d.getFullYear()===year;
  };

  const overdue=activeLoans.filter(r=>{
    const due=parseDate_(r['Rencana Pengembalian']);
    return due && due < new Date(now.getFullYear(),now.getMonth(),now.getDate());
  }).length;

  return {
    totalBuku:totalBuku,
    judulBuku:judulBuku,
    bukuTersedia:bukuTersedia,
    totalAnggota:totalAnggota,
    penggunaTerdaftar:totalAnggota,
    anggotaAktif:anggotaAktif,
    sedangDipinjam:activeLoans.length,
    terlambat:overdue,
    peminjamanBulanIni:loans.filter(r=>inThisMonth(r)).length,
    pengembalianBulanIni:returns.filter(r=>inThisMonth(r)).length
  };
}

/* ===== MEMBER PERSONAL DATA ===== */

function getMyData_(idAnggota){
  idAnggota=String(idAnggota||'').trim();
  if(!idAnggota)return fail_('ID Anggota wajib diisi.');
  const member=getMembers_().find(m=>String(m['ID Anggota'])===idAnggota);
  if(!member)return fail_('Anggota tidak ditemukan.');
  const loans=readObjects_(SHEETS.PEMINJAMAN).filter(r=>String(r['ID Anggota'])===idAnggota);
  const visits=readObjects_(SHEETS.KUNJUNGAN).filter(r=>String(r['ID Anggota'])===idAnggota);
  return ok_('Data anggota berhasil diambil.',{member:member,loans:loans,visits:visits});
}

/* ===== THE REMAINING CRUD / TRANSACTIONS ===== */

function saveBook_(p){
  const ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh=ss.getSheetByName(SHEETS.BUKU);
  if(!sh)return fail_('Sheet BUKU belum tersedia.');
  const id=String(p.idBuku||'').trim()||nextId_('BK',sh,1);
  const stock=Math.max(0,Number(p.stok||0));
  const available=p.tersedia===''||p.tersedia==null?stock:Math.max(0,Math.min(stock,Number(p.tersedia)));
  const coverUrl=String(p.cover||'').trim();

  upsertById_(sh,1,id,[
    id,p.isbn||'',p.judul||'',p.penulis||'',p.penerbit||'',
    p.tahunTerbit||'',p.kategoriUtama||'',p.subkategori||'',
    p.rak||'',stock,available,coverUrl,p.sinopsis||'',p.status||'Aktif'
  ]);
  return ok_('Data buku berhasil disimpan.',{idBuku:id,cover:coverUrl});
}

function uploadBookCover_(p){
  const id=String(p.idBuku||'').trim();
  const base64=String(p.coverBase64||'').trim();
  if(!id)return fail_('ID Buku wajib diisi sebelum mengunggah cover.');
  if(!base64)return fail_('File cover belum diterima server.');

  const folder=DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const mime=['image/jpeg','image/png','image/webp'].includes(String(p.coverMime||''))?String(p.coverMime):'image/jpeg';
  const safeName=String(p.coverName||('Cover_'+id+'.jpg')).replace(/[\\/:*?"<>|#%{}~&]/g,'_');
  const bytes=Utilities.base64Decode(base64);
  const file=folder.createFile(Utilities.newBlob(bytes,mime,safeName));

  // Public link is attempted so the HTML can display the cover.
  try{file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);}catch(e){}

  const coverUrl='https://drive.google.com/uc?export=view&id='+file.getId();

  // Remove previous cover only after the new file has been created successfully.
  const oldId=extractDriveFileId_(String(p.oldCover||''));
  if(oldId && oldId!==file.getId()){
    try{DriveApp.getFileById(oldId).setTrashed(true);}catch(e){}
  }

  return ok_('Cover buku berhasil diunggah ke Google Drive.',{
    idBuku:id,
    cover:coverUrl,
    fileId:file.getId(),
    fileName:file.getName()
  });
}

function uploadSchoolAsset_(p){
  const type=String(p.assetType||'').trim();
  const base64=String(p.base64||'').trim();
  if(!['Logo Sekolah','Foto Background'].includes(type))return fail_('Jenis file sekolah tidak dikenali.');
  if(!base64)return fail_('File belum diterima server.');

  const folder=DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const allowed=['image/jpeg','image/png','image/webp'];
  const mime=allowed.includes(String(p.mime||''))?String(p.mime):'image/jpeg';
  const safeName=String(p.name||type.replace(/\s+/g,'_')+'.jpg').replace(/[\\/:*?"<>|#%{}~&]/g,'_');
  const bytes=Utilities.base64Decode(base64);
  const file=folder.createFile(Utilities.newBlob(bytes,mime,safeName));

  try{file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);}catch(e){}

  const fileId=file.getId();
  const url='https://drive.google.com/uc?export=view&id='+fileId;

  const oldUrl=getSettingsObject_()[type]||'';
  saveSetting_(type,url);

  const oldId=extractDriveFileId_(oldUrl);
  if(oldId && oldId!==fileId){
    try{DriveApp.getFileById(oldId).setTrashed(true);}catch(e){}
  }

  return ok_('File '+type+' berhasil disimpan ke Google Drive.',{
    assetType:type,url:url,fileId:fileId,fileName:file.getName()
  });
}

function extractDriveFileId_(url){
  const s=String(url||'');
  let m=s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if(m)return m[1];
  m=s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m?m[1]:'';
}

function deleteBook_(idBuku){
  const sh=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(SHEETS.BUKU);
  const row=findRowByColumnValue_(sh,1,idBuku);
  if(!row)return fail_('Buku tidak ditemukan.');
  sh.getRange(row,14).setValue('Tidak Aktif');
  return ok_('Buku berhasil dinonaktifkan.');
}

function saveMember_(p){
  const ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh=ss.getSheetByName(SHEETS.ANGGOTA),users=ss.getSheetByName(SHEETS.USERS);
  const id=String(p.idAnggota||'').trim()||nextId_('AG',sh,1);
  upsertById_(sh,1,id,[id,p.nisNip||'',p.nama||'',p.kelas||'',p.jurusan||'',p.jenisAnggota||'Siswa',p.status||'Aktif']);
  const username=String(p.username||p.nisNip||'').trim(),password=String(p.password||'').trim();
  if(username&&password){
    const role=String(p.role||((p.jenisAnggota||'').toLowerCase()==='guru'?'Guru':'Siswa'));
    const row=findRowByColumnValue_(users,2,username);
    if(row) users.getRange(row,1,1,7).setValues([[users.getRange(row,1).getValue(),username,password,p.nama||'',role,id,p.status||'Aktif']]);
    else users.appendRow([nextId_('USR',users,1),username,password,p.nama||'',role,id,p.status||'Aktif']);
  }
  return ok_('Data anggota berhasil disimpan.',{idAnggota:id});
}

function setMemberStatus_(idAnggota,status){
  const ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh=ss.getSheetByName(SHEETS.ANGGOTA);
  const row=findRowByColumnValue_(sh,1,idAnggota);
  if(!row)return fail_('Anggota tidak ditemukan.');
  sh.getRange(row,7).setValue(status);
  const users=ss.getSheetByName(SHEETS.USERS);
  const ur=findRowByColumnValue_(users,6,idAnggota);
  if(ur)users.getRange(ur,7).setValue(status);
  return ok_('Status anggota berhasil diperbarui.');
}

function borrowBook_(p){
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try{
    const ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const booksSh=ss.getSheetByName(SHEETS.BUKU),loanSh=ss.getSheetByName(SHEETS.PEMINJAMAN);
    const idAnggota=String(p.idAnggota||'').trim(),idBuku=String(p.idBuku||'').trim();
    if(!idAnggota||!idBuku)return fail_('ID Anggota dan ID Buku wajib diisi.');
    const member=getMembers_().find(m=>String(m['ID Anggota'])===idAnggota);
    if(!member||String(member.Status).toLowerCase()!=='aktif')return fail_('Anggota tidak aktif atau tidak ditemukan.');
    const book=getBooks_().find(b=>String(b['ID Buku'])===idBuku);
    if(!book)return fail_('Buku tidak ditemukan.');
    const available=Number(book.Tersedia||0); if(available<=0)return fail_('Buku sedang tidak tersedia.');
    const active=readObjects_(SHEETS.PEMINJAMAN).filter(r=>String(r['ID Anggota'])===idAnggota && !String(r['Tanggal Pengembalian']||'').trim() && String(r.Status||'').toLowerCase()!=='dikembalikan');
    const settings=getSettingsObject_();
    const maxBooks=String(member['Jenis Anggota']).toLowerCase()==='guru'?Number(settings['Maksimal Buku Guru']||5):Number(settings['Maksimal Buku Siswa']||2);
    if(active.length>=maxBooks)return fail_('Batas maksimal peminjaman anggota sudah tercapai.');
    const loanId=nextId_('PJM',loanSh,1);
    const borrowDate=p.tanggalPeminjaman||formatDate_(new Date());
    const dueDate=p.rencanaPengembalian||addDays_(borrowDate,Number(settings['Lama Peminjaman']||7));
    loanSh.appendRow([loanId,idAnggota,idBuku,borrowDate,dueDate,'','Dipinjam']);
    const br=findRowByColumnValue_(booksSh,1,idBuku);
    booksSh.getRange(br,11).setValue(available-1);
    return ok_('Peminjaman berhasil dicatat.',{idPeminjaman:loanId});
  }finally{lock.releaseLock();}
}

function returnBook_(p){
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try{
    const ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const loanSh=ss.getSheetByName(SHEETS.PEMINJAMAN),returnSh=ss.getSheetByName(SHEETS.PENGEMBALIAN),booksSh=ss.getSheetByName(SHEETS.BUKU);
    const loans=readObjects_(SHEETS.PEMINJAMAN);
    const idPeminjaman=String(p.idPeminjaman||'').trim(),idAnggota=String(p.idAnggota||'').trim(),idBuku=String(p.idBuku||'').trim();
    let loan=idPeminjaman?loans.find(r=>String(r['ID Peminjaman'])===idPeminjaman):loans.find(r=>String(r['ID Anggota'])===idAnggota&&String(r['ID Buku'])===idBuku&&!String(r['Tanggal Pengembalian']||'').trim());
    if(!loan)return fail_('Transaksi peminjaman aktif tidak ditemukan.');
    const returnDate=p.tanggalPengembalian||formatDate_(new Date());
    const due=parseDate_(loan['Rencana Pengembalian']),actual=parseDate_(returnDate);
    const late=due&&actual&&actual>due,status=late?'Terlambat':'Dikembalikan';
    const lr=findRowByColumnValue_(loanSh,1,loan['ID Peminjaman']);
    loanSh.getRange(lr,6).setValue(returnDate); loanSh.getRange(lr,7).setValue(status);
    const rid=nextId_('KBL',returnSh,1);
    returnSh.appendRow([rid,loan['ID Peminjaman'],loan['ID Anggota'],loan['ID Buku'],returnDate,status]);
    const br=findRowByColumnValue_(booksSh,1,loan['ID Buku']);
    const avail=Number(booksSh.getRange(br,11).getValue()||0),stock=Number(booksSh.getRange(br,10).getValue()||0);
    booksSh.getRange(br,11).setValue(Math.min(stock,avail+1));
    return ok_('Pengembalian berhasil dicatat.',{idPengembalian:rid,status:status});
  }finally{lock.releaseLock();}
}

function saveVisit_(p){
  const sh=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(SHEETS.KUNJUNGAN),now=new Date(),id=nextId_('KJG',sh,1);
  sh.appendRow([id,p.idAnggota||'',p.tanggal||formatDate_(now),p.jamMasuk||formatTime_(now),p.jamKeluar||'',p.keperluan||'']);
  return ok_('Kunjungan berhasil dicatat.',{idKunjungan:id});
}


function generalReport_(){
  const members=getMembers_();
  const loans=readObjects_(SHEETS.PEMINJAMAN);
  const visits=readObjects_(SHEETS.KUNJUNGAN);
  const stats=generalStats_(getBooks_(),members);
  const activeMembers=members.filter(m=>String(m.Status||'').toLowerCase()==='aktif').length;
  const uniqueVisitors=[...new Set(visits.map(v=>String(v['ID Anggota']||'').trim()).filter(Boolean))].length;
  const borrowers=[...new Set(loans.map(v=>String(v['ID Anggota']||'').trim()).filter(Boolean))].length;
  const returned=readObjects_(SHEETS.PENGEMBALIAN);
  const returnedOnTime=returned.filter(r=>String(r.Status||'').toLowerCase()==='dikembalikan').length;
  return ok_('Laporan umum berhasil dibuat.',{
    stats:stats,
    settings:getSettingsObject_(),
    metrics:{
      totalKunjungan:visits.length,
      penggunaBerkunjung:uniqueVisitors,
      penggunaMeminjam:borrowers,
      prosentaseKunjungan:activeMembers?Math.round(uniqueVisitors/activeMembers*10000)/100:0,
      prosentasePeminjam:activeMembers?Math.round(borrowers/activeMembers*10000)/100:0,
      prosentasePengembalianTepatWaktu:returned.length?Math.round(returnedOnTime/returned.length*10000)/100:0
    }
  });
}

function memberReport_(idAnggota,tahun){
  const member=getMembers_().find(m=>String(m['ID Anggota'])===String(idAnggota||''));
  if(!member)return fail_('Anggota tidak ditemukan.');

  const books=getBooks_();
  const bookMap={};
  books.forEach(b=>bookMap[String(b['ID Buku'])]=b['Judul']||b['ID Buku']);

  const loans=readObjects_(SHEETS.PEMINJAMAN)
    .filter(r=>String(r['ID Anggota'])===String(idAnggota))
    .map(r=>Object.assign({},r,{
      judulBuku:bookMap[String(r['ID Buku'])]||r['ID Buku'],
      idBuku:r['ID Buku'],
      tanggalPeminjaman:r['Tanggal Peminjaman'],
      rencanaPengembalian:r['Rencana Pengembalian'],
      tanggalPengembalian:r['Tanggal Pengembalian'],
      status:r['Status']
    }));

  const returned=loans.filter(r=>String(r['Tanggal Pengembalian']||'').trim());
  const outstanding=loans.filter(r=>!String(r['Tanggal Pengembalian']||'').trim());

  return ok_('Laporan anggota berhasil dibuat.',{
    tahun:String(tahun||new Date().getFullYear()),
    member:member,
    settings:getSettingsObject_(),
    jumlahDipinjam:loans.length,
    jumlahDikembalikan:returned.length,
    masihDipinjam:outstanding.length,
    tanggungan:outstanding.length?(outstanding.length+' buku'):'Tidak ada',
    status:outstanding.length?'Belum Bebas Tanggungan':'Bebas Tanggungan',
    loans:loans,
    returned:returned,
    outstanding:outstanding
  });
}


function getLoans_(){
  return readObjects_(SHEETS.PEMINJAMAN);
}

function saveSetting_(parameter,nilai){
  parameter=String(parameter||"").trim();
  nilai=String(nilai||"").trim();
  if(!parameter)return fail_("Nama parameter wajib diisi.");
  if(parameter==='Link Flipbook Perpustakaan')parameter='Link Flipbook';

  const sh=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(SHEETS.PENGATURAN);
  if(!sh)return fail_("Sheet PENGATURAN tidak ditemukan. Jalankan setup terlebih dahulu.");

  // Perbaikan: bila pernah ada parameter ganda, semua baris yang cocok diperbarui.
  // Ini mencegah data lama pada baris duplikat menimpa nilai terbaru saat dibaca.
  const last=sh.getLastRow();
  let matches=[];
  if(last>=2){
    const vals=sh.getRange(2,1,last-1,1).getValues();
    const target=parameter.toLowerCase();
    vals.forEach((r,i)=>{if(String(r[0]).trim().toLowerCase()===target)matches.push(i+2);});
  }
  if(matches.length){
    matches.forEach(row=>sh.getRange(row,2).setValue(nilai));
  }else{
    sh.appendRow([parameter,nilai]);
  }

  // Sinkronkan alias Flipbook lama bila ada.
  if(parameter==='Link Flipbook'){
    const last2=sh.getLastRow();
    if(last2>=2){
      const vals2=sh.getRange(2,1,last2-1,1).getValues();
      vals2.forEach((r,i)=>{
        if(String(r[0]).trim().toLowerCase()==='link flipbook perpustakaan')sh.getRange(i+2,2).setValue(nilai);
      });
    }
  }
  SpreadsheetApp.flush();
  return ok_("Pengaturan berhasil disimpan.",{parameter:parameter,nilai:nilai});
}

function getSettings_(){return ok_('Pengaturan berhasil diambil.',{settings:getSettingsObject_()});}
function getSettingsObject_(){
  const rows=readObjects_(SHEETS.PENGATURAN),o={};
  // Jika ada duplikat parameter, baris terakhir dianggap sebagai nilai yang berlaku.
  rows.forEach(r=>{const k=String(r.Parameter||'').trim();if(k)o[k]=r.Nilai;});
  return o;
}

function readObjects_(sheetName){
  const sh=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(sheetName);
  if(!sh||sh.getLastRow()<2)return [];
  const v=sh.getDataRange().getValues(),h=v[0].map(String);
  return v.slice(1).filter(r=>r.some(x=>String(x).trim()!=='')).map(r=>{const o={};h.forEach((x,i)=>o[x]=r[i]);return o;});
}
function findRowByColumnValue_(sh,col,value){
  if(!sh||sh.getLastRow()<2)return 0;
  const v=sh.getRange(2,col,sh.getLastRow()-1,1).getValues(),t=String(value).trim().toLowerCase();
  for(let i=0;i<v.length;i++)if(String(v[i][0]).trim().toLowerCase()===t)return i+2;
  return 0;
}
function upsertById_(sh,col,id,row){const r=findRowByColumnValue_(sh,col,id);if(r)sh.getRange(r,1,1,row.length).setValues([row]);else sh.appendRow(row);}
function nextId_(prefix,sh,col){const last=sh.getLastRow();if(last<2)return prefix+'001';const v=sh.getRange(2,col,last-1,1).getValues().flat();let max=0;v.forEach(x=>{const m=String(x).match(new RegExp('^'+prefix+'(\\d+)$','i'));if(m)max=Math.max(max,Number(m[1]));});return prefix+String(max+1).padStart(3,'0');}
function addDays_(v,n){const d=parseDate_(v)||new Date();d.setDate(d.getDate()+Number(n||0));return formatDate_(d);}
function parseDate_(v){
  if(!v)return null;
  if(Object.prototype.toString.call(v)==='[object Date]'&&!isNaN(v))return v;
  const s=String(v).trim(); let d;
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))d=new Date(s+'T00:00:00');
  else if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)){const a=s.split('/').map(Number);d=new Date(a[2],a[1]-1,a[0]);}
  else d=new Date(s);
  return isNaN(d)?null:d;
}
function formatDate_(d){return Utilities.formatDate(new Date(d),Session.getScriptTimeZone()||'Asia/Jakarta','yyyy-MM-dd');}
function formatTime_(d){return Utilities.formatDate(new Date(d),Session.getScriptTimeZone()||'Asia/Jakarta','HH:mm:ss');}
function logActivity_(id,name,activity,note){try{SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(SHEETS.LOG).appendRow(['LOG'+Date.now(),new Date(),id||'',name||'',activity||'',note||'']);}catch(e){}}
function ok_(message,data){return Object.assign({success:true,message:message||'OK'},data||{});}
function fail_(message){return {success:false,message:message||'Terjadi kesalahan.'};}

function testSetup(){Logger.log(setupSheets_());}
function testPing(){Logger.log(handleRequest_({action:'ping'}));}
function testLoginAdmin(){Logger.log(handleRequest_({action:'login',username:requiredScriptProperty_('ADMIN_USERNAME'),password:requiredScriptProperty_('ADMIN_PASSWORD')}));}
function testGeneralStats(){Logger.log(handleRequest_({action:'generalReport'}));}

function testGetLoans(){Logger.log(handleRequest_({action:"getLoans"}));}

function testDriveFolder() {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);

  const file = folder.createFile(
    'TEST_PERPUSTAKAAN_DRIVE.txt',
    'Tes penyimpanan file dari Apps Script berhasil.',
    MimeType.PLAIN_TEXT
  );

  Logger.log('BERHASIL');
  Logger.log('Nama File: ' + file.getName());
  Logger.log('File ID: ' + file.getId());
  Logger.log('Folder ID: ' + folder.getId());
}
