/* ===== LAPORAN ===== */

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

function memberReport_(idAnggota,tahun,session){
  // Non-admin hanya boleh membuka laporan miliknya sendiri.
  if(!session||(String(session.role||'')!=='Admin'&&String(session.idAnggota||'')!==String(idAnggota||'')))
    return fail_('Anda hanya dapat melihat laporan anggota sendiri.','FORBIDDEN');
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


