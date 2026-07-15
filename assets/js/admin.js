const $=id=>document.getElementById(id);
let rows=[],selectedReg='',session='';
try{session=localStorage.getItem('frpAdminSession')||'';}catch{}

$('loginBtn').onclick=login;
$('adminPassword').onkeydown=e=>{if(e.key==='Enter')login();};
$('refreshBtn').onclick=loadData;
$('searchInput').oninput=render;
$('statusFilter').onchange=render;
$('readFilter').onchange=render;
$('logoutBtn').onclick=()=>logout();
$('closeDialog').onclick=()=>$('detailDialog').close();
$('saveStatusBtn').onclick=saveStatus;
$('exportPdfBtn').onclick=exportPdf;

function apiUrl(){
  const url=window.APP_CONFIG?.API_URL||'';
  if(!url||url.includes('PASTE_'))throw new Error('API_URL belum diisi pada assets/js/config.js.');
  return url;
}
async function call(action,payload={}){
  const response=await fetch(apiUrl(),{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({action,...payload})
  });
  const text=await response.text();
  let data;
  try{data=JSON.parse(text);}catch{throw new Error('Respons backend tidak valid: '+text.slice(0,120));}
  if(!data.success)throw new Error(data.message||'Proses gagal.');
  return data;
}
async function login(){
  const username=$('adminUsername').value.trim(),password=$('adminPassword').value;
  if(!username||!password)return showLoginError('Username dan password wajib diisi.');
  $('loginBtn').disabled=true;$('loginBtn').textContent='Memeriksa...';$('loginError').hidden=true;
  try{
    const data=await call('login',{username,password});
    session=data.session;
    try{localStorage.setItem('frpAdminSession',session);}catch{}
    $('adminPassword').value='';
    await loadData();
  }catch(e){showLoginError(e.message);}
  finally{$('loginBtn').disabled=false;$('loginBtn').textContent='Masuk';}
}
async function loadData(){
  try{
    const data=await call('listData',{session});
    rows=data.rows||[];
    $('loginPanel').hidden=true;$('dashboardPanel').hidden=false;$('dashboardError').hidden=true;
    updateStats();render();
  }catch(e){
    if(/sesi|login|token/i.test(e.message))logout(false);
    else showDashboardError(e.message);
  }
}
function updateStats(){
  const count=s=>rows.filter(r=>(r.Status||'Baru')===s).length;
  $('totalStat').textContent=rows.length;$('newStat').textContent=count('Baru');
  $('checkingStat').textContent=count('Sedang Dicek');$('missingStat').textContent=count('Dokumen Kurang');
  $('completeStat').textContent=count('Sudah Lengkap');$('doneStat').textContent=count('Selesai');
}
function render(){
  const q=$('searchInput').value.toLowerCase(),status=$('statusFilter').value,rf=$('readFilter').value;
  const filtered=rows.filter(row=>{
    const read=String(row['Sudah Dibaca']).toLowerCase()==='ya';
    return (!q||Object.values(row).join(' ').toLowerCase().includes(q))&&
      (!status||(row.Status||'Baru')===status)&&
      (!rf||(rf==='read'?read:!read));
  });
  $('emptyState').hidden=filtered.length>0;
  $('tableBody').innerHTML=filtered.map(row=>{
    const reg=row['Nomor Registrasi']||'',read=String(row['Sudah Dibaca']).toLowerCase()==='ya';
    return `<tr class="${read?'':'unread-row'}">
      <td>${esc(reg)}</td><td>${esc(row.Timestamp||'')}</td>
      <td>${esc(row['Nama Tertanggung']||'')}</td>
      <td>${esc(row['Nomor Handphone Tertanggung']||'')}</td>
      <td><span class="status-pill">${esc(row.Status||'Baru')}</span></td>
      <td>${read?'Sudah dibaca':'<span class="new-badge">Baru</span>'}</td>
      <td><button class="btn secondary small" data-reg="${escAttr(reg)}">Detail</button></td>
    </tr>`;
  }).join('');
  document.querySelectorAll('[data-reg]').forEach(b=>b.onclick=()=>openDetail(b.dataset.reg));
}
async function openDetail(reg){
  try{
    const data=await call('getDetail',{session,registrationNumber:reg});
    const row=data.row;selectedReg=reg;
    $('detailTitle').textContent=`${row['Nama Tertanggung']||'Tertanggung'} — ${reg}`;
    $('detailStatus').value=row.Status||'Baru';
    $('detailContent').innerHTML=Object.entries(row).filter(([,v])=>String(v||'').trim())
      .map(([k,v])=>`<div class="detail-item"><small>${esc(k)}</small><div>${renderValue(v)}</div></div>`).join('');
    $('detailDialog').showModal();
    const local=rows.find(r=>r['Nomor Registrasi']===reg);if(local)local['Sudah Dibaca']='Ya';render();
  }catch(e){alert(e.message);}
}
async function saveStatus(){
  $('saveStatusBtn').disabled=true;
  try{await call('updateStatus',{session,registrationNumber:selectedReg,status:$('detailStatus').value});$('detailDialog').close();await loadData();}
  catch(e){alert(e.message);}finally{$('saveStatusBtn').disabled=false;}
}
async function exportPdf(){
  $('exportPdfBtn').disabled=true;
  try{const data=await call('exportPdf',{session,registrationNumber:selectedReg});window.open(data.url,'_blank','noopener');}
  catch(e){alert(e.message);}finally{$('exportPdfBtn').disabled=false;}
}
function logout(show=true){session='';try{localStorage.removeItem('frpAdminSession');}catch{}rows=[];$('dashboardPanel').hidden=true;$('loginPanel').hidden=false;if(show)showLoginError('Anda sudah keluar.');}
function renderValue(v){const s=String(v);if(s.includes('\n')&&s.split('\n').every(x=>/^https?:\/\//.test(x.trim())))return s.split('\n').map(x=>`<a href="${escAttr(x.trim())}" target="_blank" rel="noopener">Buka dokumen</a>`).join('<br>');return /^https?:\/\//.test(s)?`<a href="${escAttr(s)}" target="_blank" rel="noopener">Buka dokumen</a>`:esc(s);}
function showLoginError(m){$('loginError').textContent=m;$('loginError').hidden=false;}
function showDashboardError(m){$('dashboardError').textContent=m;$('dashboardError').hidden=false;}
function esc(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function escAttr(v){return esc(v);}
if(session)loadData();
setInterval(()=>{if(session)loadData();},30000);
