/* ===== LOGIN, SESI, DAN PASSWORD ===== */

const SESSION_TTL_SECONDS = 21600; // 6 jam

function login_(username,password){
  username=String(username||'').trim().toLowerCase();
  password=String(password||'');
  if(!username||!password)return fail_('Username/NIS dan password wajib diisi.');
  const rows=readObjects_(SHEETS.USERS);
  const user=rows.find(r=>
    String(r.Username||'').trim().toLowerCase()===username &&
    String(r.Status||'').trim().toLowerCase()==='aktif'
  );
  if(!user||!verifyPassword_(user.Password,password))return fail_('Username/NIS atau password salah.');
  upgradeLegacyPassword_(user,password);
  const safeUser={
    idUser:user['ID User'],username:user.Username,name:user.Nama,
    role:user.Role,idAnggota:user['ID Anggota']||'',status:user.Status
  };
  const token=createSession_(safeUser);
  logActivity_(safeUser.idUser,safeUser.name,'Login','Berhasil');
  return ok_('Login berhasil.',{user:safeUser,token:token});
}

// Token sesi disimpan di CacheService (TTL 6 jam) dan dibawa frontend di setiap request.
function createSession_(user){
  const token=Utilities.getUuid();
  CacheService.getScriptCache().put('SESSION_'+token,JSON.stringify(user),SESSION_TTL_SECONDS);
  return token;
}

function getSession_(token){
  token=String(token||'').trim();
  if(!token)return null;
  try{
    const raw=CacheService.getScriptCache().get('SESSION_'+token);
    return raw?JSON.parse(raw):null;
  }catch(e){return null;}
}

// Hash SHA-256 dengan salt acak per user, format: sha256$<salt>$<hex>.
function makePasswordHash_(password){
  const salt=Utilities.getUuid().replace(/-/g,'').slice(0,16);
  return hashPassword_(password,salt);
}

function hashPassword_(password,salt){
  const bytes=Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt+':'+String(password),
    Utilities.Charset.UTF_8
  );
  const hex=bytes.map(b=>((b+256)%256).toString(16).padStart(2,'0')).join('');
  return 'sha256$'+salt+'$'+hex;
}

function verifyPassword_(stored,input){
  stored=String(stored||'');
  const m=stored.match(/^sha256\$([^$]+)\$(.+)$/);
  if(m)return constantTimeEquals_(hashPassword_(input,m[1]),stored);
  // Data lama masih plaintext: cocokkan dulu, lalu di-hash otomatis oleh upgradeLegacyPassword_.
  return stored!==''&&constantTimeEquals_(stored,String(input||''));
}

function constantTimeEquals_(a,b){
  a=String(a||'');b=String(b||'');
  if(a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}

function upgradeLegacyPassword_(user,plainPassword){
  try{
    if(/^sha256\$/.test(String(user.Password||'')))return;
    const sh=getSS_().getSheetByName(SHEETS.USERS);
    const row=findRowByColumnValue_(sh,1,user['ID User']);
    if(row)sh.getRange(row,3).setValue(makePasswordHash_(plainPassword));
  }catch(e){
    // Kegagalan upgrade tidak boleh menggagalkan login.
  }
}

