/* ===== CRUD BUKU & ANGGOTA ===== */

function saveBook_(p){
  const ss=getSS_();
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
  const sh=getSS_().getSheetByName(SHEETS.BUKU);
  const row=findRowByColumnValue_(sh,1,idBuku);
  if(!row)return fail_('Buku tidak ditemukan.');
  sh.getRange(row,14).setValue('Tidak Aktif');
  return ok_('Buku berhasil dinonaktifkan.');
}

function saveMember_(p){
  const ss=getSS_();
  const sh=ss.getSheetByName(SHEETS.ANGGOTA),users=ss.getSheetByName(SHEETS.USERS);
  const id=String(p.idAnggota||'').trim()||nextId_('AG',sh,1);
  upsertById_(sh,1,id,[id,p.nisNip||'',p.nama||'',p.kelas||'',p.jurusan||'',p.jenisAnggota||'Siswa',p.status||'Aktif']);
  const username=String(p.username||p.nisNip||'').trim(),password=String(p.password||'').trim();
  if(username&&password){
    const role=String(p.role||((p.jenisAnggota||'').toLowerCase()==='guru'?'Guru':'Siswa'));
    const hashedPassword=makePasswordHash_(password);
    const row=findRowByColumnValue_(users,2,username);
    if(row) users.getRange(row,1,1,7).setValues([[users.getRange(row,1).getValue(),username,hashedPassword,p.nama||'',role,id,p.status||'Aktif']]);
    else users.appendRow([nextId_('USR',users,1),username,hashedPassword,p.nama||'',role,id,p.status||'Aktif']);
  }
  return ok_('Data anggota berhasil disimpan.',{idAnggota:id});
}

function setMemberStatus_(idAnggota,status){
  const ss=getSS_();
  const sh=ss.getSheetByName(SHEETS.ANGGOTA);
  const row=findRowByColumnValue_(sh,1,idAnggota);
  if(!row)return fail_('Anggota tidak ditemukan.');
  sh.getRange(row,7).setValue(status);
  const users=ss.getSheetByName(SHEETS.USERS);
  const ur=findRowByColumnValue_(users,6,idAnggota);
  if(ur)users.getRange(ur,7).setValue(status);
  return ok_('Status anggota berhasil diperbarui.');
}

