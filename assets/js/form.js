const form = document.getElementById('healthForm');
const steps = [...document.querySelectorAll('.step')];

const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const submitBtn = document.getElementById('submitBtn');
const errorBox = document.getElementById('errorBox');
const stepLabel = document.getElementById('stepLabel');
const progressPercent = document.getElementById('progressPercent');
const progressBar = document.getElementById('progressBar');

let current = 0;
const FILE_LIMIT = 2 * 1024 * 1024;

if (!form || !steps.length || !prevBtn || !nextBtn || !submitBtn) {
  throw new Error('Komponen navigasi form tidak lengkap.');
}

function syncConditionalDetail(name){
  const selected=form.querySelector(`input[name="${name}"]:checked`);
  const wrap=form.querySelector(`[data-detail-for="${name}"]`);
  if(!wrap)return;

  if(name==='q44'){
    const selectedValue=selected?.value||'';
    wrap.hidden=!selectedValue;

    wrap.querySelectorAll('[data-show-when]').forEach(branch=>{
      const shouldShow=branch.dataset.showWhen===selectedValue;
      branch.hidden=!shouldShow;

      branch.querySelectorAll('textarea,input,select').forEach(field=>{
        field.disabled=!shouldShow;
        field.required=shouldShow;

        if(!shouldShow){
          if(field.type==='file'){
            field.value='';
          }else{
            field.value='';
          }
        }
      });
    });

    const status=form.querySelector('[data-file-status="q44_file"]');
    if(selectedValue!=='YA' && status){
      status.textContent='Belum ada file dipilih';
    }
    return;
  }

  const show=selected?.value==='YA';
  wrap.hidden=!show;

  const fields=[...wrap.querySelectorAll('textarea,input,select')];
  fields.forEach(field=>{
    field.disabled=!show;
    field.required=show;
    if(!show){
      if(field.type==='file')field.value='';
      else field.value='';
    }
  });
}
function initConditionalQuestions(){
  form.querySelectorAll('[data-detail-for]').forEach(wrap=>{
    const name=wrap.dataset.detailFor;
    form.querySelectorAll(`input[name="${name}"]`).forEach(radio=>radio.addEventListener('change',()=>syncConditionalDetail(name)));
    syncConditionalDetail(name);
  });
}

function getGender(){return form.querySelector('[name="jenis_kelamin"]')?.value||'';}
function getBirthDate(){return form.querySelector('[name="tanggal_lahir"]')?.value||'';}
function ageInYears(dateValue){
  if(!dateValue)return null;
  const dob=new Date(`${dateValue}T00:00:00`);
  if(Number.isNaN(dob.getTime()))return null;
  const now=new Date();let age=now.getFullYear()-dob.getFullYear();
  const beforeBirthday=now.getMonth()<dob.getMonth()||(now.getMonth()===dob.getMonth()&&now.getDate()<dob.getDate());
  if(beforeBirthday)age--;return age;
}
function setQuestionApplicability(question,enabled){
  // Bagian tetap terlihat, tetapi input dinonaktifkan bila tidak berlaku.
  question.hidden=false;
  question.classList.toggle('question-disabled',!enabled);
  question.querySelectorAll('input,select,textarea').forEach(field=>{
    if(field.name?.endsWith('_detail')){
      field.disabled=!enabled;
      if(!enabled){field.required=false;field.value='';}
      return;
    }
    field.disabled=!enabled;
    field.required=enabled;
    if(!enabled){
      if(field.type==='radio'||field.type==='checkbox')field.checked=false;
      else if(field.type!=='file')field.value='';
    }
  });
}
function syncApplicability(){
  const female=getGender()==='PEREMPUAN';
  document.querySelectorAll('[data-female-only="true"]').forEach(q=>setQuestionApplicability(q,female));
  const femaleNote=document.getElementById('femaleApplicabilityNote');
  if(femaleNote){
    femaleNote.classList.toggle('not-applicable',!female);
    femaleNote.textContent=female
      ? 'Bagian ini berlaku dan wajib diisi karena Calon Tertanggung adalah perempuan.'
      : 'Tidak berlaku: bagian khusus wanita tidak dapat diisi untuk Calon Tertanggung laki-laki.';
  }

  const age=ageInYears(getBirthDate());
  const childApplicable=age!==null&&age<6;
  const childStep=document.querySelector('.step[data-step="6"]');
  if(childStep){
    childStep.dataset.applicable='true';
    childStep.querySelectorAll('.question').forEach(q=>setQuestionApplicability(q,childApplicable));
  }
  const childNote=document.getElementById('childApplicabilityNote');
  if(childNote){
    childNote.classList.toggle('not-applicable',!childApplicable);
    childNote.textContent=childApplicable
      ? `Bagian ini berlaku dan wajib diisi karena usia Calon Tertanggung ${age} tahun.`
      : age===null
        ? 'Isi tanggal lahir terlebih dahulu untuk menentukan apakah bagian ini berlaku.'
        : `Tidak berlaku: usia Calon Tertanggung ${age} tahun (sudah 6 tahun atau lebih).`;
  }
  document.querySelectorAll('[data-detail-for]').forEach(w=>syncConditionalDetail(w.dataset.detailFor));
}
function visibleStepIndexes(){return steps.map((_,i)=>i);}
function moveStep(direction){
  const visible=visibleStepIndexes();const pos=visible.indexOf(current);const nextPos=pos+direction;
  if(nextPos>=0&&nextPos<visible.length){current=visible[nextPos];update();}
}
function update(){
  syncApplicability();

  const visible = visibleStepIndexes();

  if (!visible.includes(current)) {
    current = visible.find(index => index > current) ?? visible[visible.length - 1];
  }

  steps.forEach((step, index) => {
    step.classList.toggle('active', index === current);
  });

  const position = visible.indexOf(current) + 1;
  const percent = Math.round((position / visible.length) * 100);

  if (stepLabel) {
    stepLabel.textContent = `Langkah ${position} dari ${visible.length}`;
  }

  if (progressPercent) {
    progressPercent.textContent = `${percent}%`;
  }

  if (progressBar) {
    progressBar.style.width = `${percent}%`;
  }

  prevBtn.hidden = position === 1;
  nextBtn.hidden = position === visible.length;
  submitBtn.hidden = position !== visible.length;

  if (errorBox) {
    errorBox.hidden = true;
  }

  if (position === visible.length) {
    buildReview();
  }

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}
function validateStep(){const step=steps[current];for(const group of step.querySelectorAll('[data-required-group]')){if(!group.querySelector('input:checked')){showError('Pilih minimal satu jawaban pada Sumber Penghasilan.');group.scrollIntoView({behavior:'smooth',block:'center'});return false;}}for(const field of step.querySelectorAll('input,select,textarea')){if(!field.checkValidity()){field.reportValidity();return false;}if(field.type==='file'&&field.files[0]&&field.files[0].size>FILE_LIMIT){showError(`File ${field.files[0].name} melebihi batas ukuran.`);return false;}}return true;}
nextBtn.addEventListener('click', event => {
  event.preventDefault();

  if (validateStep()) {
    moveStep(1);
  }
});

prevBtn.addEventListener('click', event => {
  event.preventDefault();
  moveStep(-1);
});
form.querySelectorAll('input[type=file]').forEach(input=>input.addEventListener('change',()=>{const status=form.querySelector(`[data-file-status="${input.name}"]`);if(status) status.textContent=input.files[0]?`${input.files[0].name} (${formatBytes(input.files[0].size)})`:'Belum ada file dipilih';}));
function getFieldLabel(field){
  const baseLabel=(field.dataset.label||'').trim();
  if(!baseLabel)return '';

  const question=field.closest('.question');
  const number=(question?.querySelector('.question-number')?.textContent||'').trim();

  if(!number || field.closest('.identity-question'))return baseLabel;
  if(baseLabel.indexOf(number)===0)return baseLabel;

  return `${number} ${baseLabel}`;
}
function collectTextData(){
  const data={};

  for(const el of form.querySelectorAll('input:not([type=file]),select,textarea')){
    const label=getFieldLabel(el);
    if(!label)continue;
    if((el.type==='checkbox'||el.type==='radio')&&!el.checked)continue;

    const value=(el.value||'').trim();
    if(!value)continue;

    if(data[label])data[label]+=', '+value;
    else data[label]=value;
  }

  return data;
}
function buildReview(){const box=document.getElementById('reviewContent');const data=collectTextData();const files=[...form.querySelectorAll('input[type=file]')].map(i=>({label:getFieldLabel(i),value:i.files[0]?.name||'Tidak diunggah'}));box.innerHTML=[...Object.entries(data).map(([k,v])=>reviewItem(k,v)),...files.map(x=>reviewItem(x.label,x.value))].join('');}
function reviewItem(k,v){return `<div class="review-item"><small>${escapeHtml(k)}</small><strong>${escapeHtml(v)}</strong></div>`;}
form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!validateStep())return;
  const url=getApiUrl();
  if(!url)return;

  submitBtn.disabled=true;
  submitBtn.textContent='Menyiapkan data...';
  errorBox.hidden=true;

  try{
    const data=collectTextData();
    const files=[];
    const fileInputs=[...form.querySelectorAll('input[type=file]')].filter(input=>input.files[0]);

    for(let i=0;i<fileInputs.length;i++){
      const input=fileInputs[i];
      submitBtn.textContent=`Memproses foto ${i+1} dari ${fileInputs.length}...`;
      const compressed=await compressImage(input.files[0]);
      files.push({
        fieldLabel:getFieldLabel(input),
        fileName:compressed.name,
        mimeType:compressed.type,
        base64:compressed.base64
      });
    }

    submitBtn.textContent='Mengirim data...';
    const result=await apiPost({action:'submitAll',data,files},300000);
    if(!result.success)throw new Error(result.message||'Gagal menyimpan data.');

    localStorage.removeItem('healthFormDraft');
    location.href=`success.html?reg=${encodeURIComponent(result.registrationNumber)}`;
  }catch(error){
    showError(error.message||'Terjadi kesalahan saat mengirim data.');
    submitBtn.disabled=false;
    submitBtn.textContent='Kirim Data';
  }
});

async function compressImage(file){
  if(file.size>FILE_LIMIT){
    // File besar tetap boleh diproses karena akan dikompres, tetapi dibatasi agar browser tidak kehabisan memori.
    if(file.size>12*1024*1024)throw new Error(`File ${file.name} terlalu besar. Maksimal foto asli 12 MB.`);
  }
  const dataUrl=await readAsDataUrl(file);
  const image=await loadImage(dataUrl);
  const maxSide=1600;
  let width=image.naturalWidth||image.width;
  let height=image.naturalHeight||image.height;
  const ratio=Math.min(1,maxSide/Math.max(width,height));
  width=Math.max(1,Math.round(width*ratio));
  height=Math.max(1,Math.round(height*ratio));

  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;
  const context=canvas.getContext('2d');
  context.drawImage(image,0,0,width,height);
  const output=canvas.toDataURL('image/jpeg',0.82);
  return {
    name:file.name.replace(/\.[^.]+$/,'')+'.jpg',
    type:'image/jpeg',
    base64:output.split(',')[1]
  };
}

function readAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result));
    reader.onerror=()=>reject(new Error(`Gagal membaca ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function loadImage(src){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error('Foto tidak dapat diproses.'));
    image.src=src;
  });
}

async function apiPost(payload, timeoutMs = 240000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(getApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        'Respons server tidak valid: ' + text.slice(0, 160)
      );
    }

    if (!response.ok) {
      throw new Error(
        data.message || 'Server mengembalikan error.'
      );
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Proses terlalu lama dan dihentikan.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function showError(msg){errorBox.textContent=msg;errorBox.hidden=false;errorBox.scrollIntoView({behavior:'smooth',block:'center'});}function getApiUrl(){const u=window.APP_CONFIG?.API_URL;if(!u||u.includes('PASTE_URL')){showError('API belum dikonfigurasi pada assets/config.js.');return '';}return u;}
function formatBytes(n){return n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;}
function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
form.addEventListener('input',()=>{const obj={};for(const el of form.querySelectorAll('input:not([type=file]),select,textarea')){if(!el.name)continue;if((el.type==='checkbox'||el.type==='radio')&&!el.checked)continue;if(obj[el.name])obj[el.name]+='|||'+el.value;else obj[el.name]=el.value;}localStorage.setItem('healthFormDraft',JSON.stringify(obj));});
(function restore(){try{const saved=JSON.parse(localStorage.getItem('healthFormDraft'));if(!saved)return;Object.entries(saved).forEach(([k,v])=>{const els=form.querySelectorAll(`[name="${CSS.escape(k)}"]`),vals=String(v).split('|||');els.forEach(el=>{if(el.type==='checkbox'||el.type==='radio')el.checked=vals.includes(el.value);else if(el.type!=='file')el.value=v;});});}catch{}})();
const genderField=form.querySelector('[name="jenis_kelamin"]');
const dobField=form.querySelector('[name="tanggal_lahir"]');
genderField?.addEventListener('change',()=>{syncApplicability();update();});
dobField?.addEventListener('change',()=>{syncApplicability();update();});
const incomeSourceField=form.querySelector('[name="q48"]');
const otherIncomeWrap=document.getElementById('q48OtherWrap');
const otherIncomeText=form.querySelector('[name="q48_other"]');

function syncOtherIncome(){
  if(!incomeSourceField||!otherIncomeWrap||!otherIncomeText)return;

  const show=incomeSourceField.value==='Lainnya';
  otherIncomeWrap.hidden=!show;
  otherIncomeText.required=show;
  otherIncomeText.disabled=!show;

  if(!show)otherIncomeText.value='';
}

incomeSourceField?.addEventListener('change', syncOtherIncome);
const relationshipField=form.querySelector('[name="q46"]');
const relationshipOtherWrap=document.getElementById('q46OtherWrap');
const relationshipOther=form.querySelector('[name="q46_other"]');
function syncRelationshipOther(){
  if(!relationshipOtherWrap||!relationshipOther)return;
  const show=relationshipField?.value==='Lainnya';
  relationshipOtherWrap.hidden=!show;
  relationshipOther.required=show;
  relationshipOther.disabled=!show;
  if(!show)relationshipOther.value='';
}
relationshipField?.addEventListener('change',syncRelationshipOther);
initConditionalQuestions();syncOtherIncome();syncRelationshipOther();syncApplicability();update();
