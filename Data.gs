/* ===== ONE-CALL DASHBOARD DATA ===== */

const DASHBOARD_CACHE_KEY='DASHBOARD_ALL';
const DASHBOARD_CACHE_TTL_SECONDS=60;

function getAllData_(){
  try{
    const cached=CacheService.getScriptCache().get(DASHBOARD_CACHE_KEY);
    if(cached)return JSON.parse(cached);
  }catch(e){}
  const result=buildAllData_();
  try{
    // Lewati cache bila payload > batas 100KB CacheService.
    CacheService.getScriptCache().put(DASHBOARD_CACHE_KEY,JSON.stringify(result),DASHBOARD_CACHE_TTL_SECONDS);
  }catch(e){}
  return result;
}

function invalidateDashboardCache_(){
  try{CacheService.getScriptCache().remove(DASHBOARD_CACHE_KEY);}catch(e){}
}

function buildAllData_(){
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

function getMyData_(idAnggota,session){
  idAnggota=String(idAnggota||'').trim();
  if(!idAnggota)return fail_('ID Anggota wajib diisi.');
  // Non-admin hanya boleh membaca data anggota sendiri.
  if(!session||(String(session.role||'')!=='Admin'&&String(session.idAnggota||'')!==idAnggota))
    return fail_('Anda hanya dapat melihat data anggota sendiri.','FORBIDDEN');
  const member=getMembers_().find(m=>String(m['ID Anggota'])===idAnggota);
  if(!member)return fail_('Anggota tidak ditemukan.');
  const loans=readObjects_(SHEETS.PEMINJAMAN).filter(r=>String(r['ID Anggota'])===idAnggota);
  const visits=readObjects_(SHEETS.KUNJUNGAN).filter(r=>String(r['ID Anggota'])===idAnggota);
  return ok_('Data anggota berhasil diambil.',{member:member,loans:loans,visits:visits});
}

