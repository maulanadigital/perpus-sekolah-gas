/* ===== DATA PINJAMAN & PENGATURAN ===== */

function getLoans_(){
  return readObjects_(SHEETS.PEMINJAMAN);
}

function saveSetting_(parameter,nilai){
  parameter=String(parameter||"").trim();
  nilai=String(nilai||"").trim();
  if(!parameter)return fail_("Nama parameter wajib diisi.");
  if(parameter==='Link Flipbook Perpustakaan')parameter='Link Flipbook';

  const sh=getSS_().getSheetByName(SHEETS.PENGATURAN);
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

