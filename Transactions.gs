/* ===== TRANSAKSI: PINJAM, KEMBALI, KUNJUNGAN ===== */

function borrowBook_(p){
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try{
    const ss=getSS_();
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
    const ss=getSS_();
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
  const sh=getSS_().getSheetByName(SHEETS.KUNJUNGAN),now=new Date(),id=nextId_('KJG',sh,1);
  sh.appendRow([id,p.idAnggota||'',p.tanggal||formatDate_(now),p.jamMasuk||formatTime_(now),p.jamKeluar||'',p.keperluan||'']);
  return ok_('Kunjungan berhasil dicatat.',{idKunjungan:id});
}


