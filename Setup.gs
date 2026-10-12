/* ===== SETUP ===== */

function setupSheets_() {
  const ss=getSS_();
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
  sh.appendRow(['ADM001',requiredScriptProperty_('ADMIN_USERNAME'),makePasswordHash_(requiredScriptProperty_('ADMIN_PASSWORD')),'Pustakawan','Admin','','Aktif']);
}

