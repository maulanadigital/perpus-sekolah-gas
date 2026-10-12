// Buka Spreadsheet sekali per eksekusi (hemat kuota & waktu eksekusi Apps Script).
let _spreadsheetRef=null;
function getSS_(){
  if(!_spreadsheetRef)_spreadsheetRef=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return _spreadsheetRef;
}

function readObjects_(sheetName){
  const sh=getSS_().getSheetByName(sheetName);
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
function logActivity_(id,name,activity,note){try{getSS_().getSheetByName(SHEETS.LOG).appendRow(['LOG'+Date.now(),new Date(),id||'',name||'',activity||'',note||'']);}catch(e){}}
function ok_(message,data){return Object.assign({success:true,message:message||'OK'},data||{});}
function fail_(message,code){const o={success:false,message:message||'Terjadi kesalahan.'};if(code)o.code=code;return o;}
