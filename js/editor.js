/* Escritório (editor.html). Escreve em três tabelas do Supabase:
     Campanha   → `sessoes`     (Campanha > Arco > Sessão, com data)
     Lore       → `tomos`       (árvore: cada tomo aponta para o pai)
     Personagem → `personagens` (ficha + foto no Storage, bucket "personagens")
   O login é real (Supabase Auth); quem barra escrita de verdade é a RLS
   do banco. Rascunhos não salvos ficam guardados no navegador. */

const $ = id => document.getElementById(id);
const TABLE = { campanha: 'sessoes', lore: 'tomos', personagem: 'personagens' };
const KIND = { campanha: 'sessao', lore: 'tomo', personagem: 'personagem' };
const BUCKET = 'personagens';

let mode = 'campanha';
let sessoes = [];
let tomos = [];
let personagens = [];
let tomoTree = buildTomoTree([]);
let current = null;   // linha já salva que está sendo editada (null = entrada nova)
let dirty = false;

/* foto do personagem em edição: url = a que já está salva; blob = nova, já reduzida,
   ainda não enviada; removed = o autor pediu para tirar a foto */
let photo = { url: null, blob: null, objectUrl: null, removed: false };

/* ============ login ============ */
$('gateForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('gateMsg').textContent = 'Entrando…';
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: $('gateEmail').value.trim(),
    password: $('gatePassword').value
  });
  if(error){ $('gateMsg').textContent = 'Não consegui entrar: ' + error.message; return; }
  $('gateMsg').textContent = '';
  showDesk();
});

$('btnLogout').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  location.reload();
});

(async function start(){
  const { data } = await supabaseClient.auth.getSession();
  if(data.session) showDesk(); else $('gateScreen').hidden = false;
})();

let deskReady = false;
function showDesk(){
  $('gateScreen').hidden = true;
  $('deskScreen').hidden = false;
  if(deskReady) return;
  deskReady = true;
  initDesk();
}

/* ============ dados ============ */
async function loadData(){
  try{
    [sessoes, tomos, personagens] = await Promise.all([fetchSessoes(), fetchTomos(), fetchPersonagens()]);
  }catch(err){
    setStatus('erro ao carregar');
    alert('Não consegui carregar as entradas: ' + err.message);
    return;
  }
  tomoTree = buildTomoTree(tomos);
  refreshDatalists();
  refreshParentSelect();
  renderExisting();
}

async function initDesk(){
  await loadData();
  bindEvents();

  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  if(p.has('sessao')) openEntry('campanha', p.get('sessao'));
  else if(p.has('tomo')) openEntry('lore', p.get('tomo'));
  else if(p.has('personagem')) openEntry('personagem', p.get('personagem'));
  else newEntry('campanha');
}

/* ============ eventos ============ */
function bindEvents(){
  document.querySelectorAll('input[name="mode"]').forEach(r =>
    r.addEventListener('change', () => { if(r.checked) newModeSwitch(r.value); }));

  ['fTitle','fCampaign','fArc','fSession','fDate','fParent','fPosition','fTags','fSummary','fContent',
   'fBio','fRace','fAge','fBirthplace','fClass','fAffiliation'].forEach(id =>
    $(id).addEventListener('input', onEdit));
  $('fSession').addEventListener('input', () => { delete $('fSession').dataset.auto; });
  ['fCampaign','fArc'].forEach(id => $(id).addEventListener('input', () => { refreshDatalists(); suggestSession(); }));
  $('fParent').addEventListener('change', suggestPosition);
  $('fPhoto').addEventListener('change', onPhotoChosen);
  $('btnPhotoRemove').addEventListener('click', removePhoto);

  $('btnPrimary').addEventListener('click', () => save(true));
  $('btnSecondary').addEventListener('click', () => save(false));
  $('btnNew').addEventListener('click', () => { if(confirmDiscard()) newEntry(mode); });
  $('btnDelete').addEventListener('click', removeCurrent);
  $('btnBackup').addEventListener('click', exportBackup);
  $('draftRestore').addEventListener('click', restoreDraft);
  $('draftDiscard').addEventListener('click', () => { clearDraft(); $('draftBanner').hidden = true; });

  $('existingList').addEventListener('click', e => {
    const b = e.target.closest('[data-id]');
    if(!b || !confirmDiscard()) return;
    $('existing').open = false;
    openEntry(mode, b.dataset.id);
  });

  window.addEventListener('beforeunload', e => { if(dirty){ e.preventDefault(); e.returnValue = ''; } });
}

function confirmDiscard(){
  return !dirty || confirm('Há alterações não salvas nesta entrada (o rascunho local fica guardado). Continuar mesmo assim?');
}

function newModeSwitch(m){
  if(current){ setMode(mode); return; }   // travado: não muda o tipo de entrada salva
  setMode(m);
  checkDraft();
}

/* ============ modo Campanha ⇄ Lore ⇄ Personagem ============ */
function setMode(m){
  mode = m;
  $('modeCampanha').checked = m === 'campanha';
  $('modeLore').checked = m === 'lore';
  $('modePersonagem').checked = m === 'personagem';
  document.querySelectorAll('[data-only], [data-except]').forEach(el => {
    el.hidden = el.dataset.only ? el.dataset.only !== m : el.dataset.except === m;
  });
  $('lblTitle').textContent = m === 'personagem' ? 'Nome' : 'Título';
  $('lblContent').textContent = m === 'personagem' ? 'História' : 'Texto';
  refreshParentSelect();
  renderExisting();
  updateChrome();
  updatePreview();
}

function updateChrome(){
  const locked = !!current;
  $('modeCampanha').disabled = $('modeLore').disabled = $('modePersonagem').disabled = locked;
  $('lockNote').hidden = !locked;
  $('btnDelete').hidden = !locked;
  const pub = !!(current && current.published);
  $('btnPrimary').textContent = pub ? 'Salvar alterações' : 'Publicar';
  $('btnSecondary').textContent = pub ? 'Voltar a rascunho' : 'Salvar rascunho';
  setStatus(!current ? 'entrada nova' : pub ? 'publicada' : 'rascunho salvo');
}

function setStatus(msg){ $('statusPill').textContent = msg; }

/* ============ formulário ============ */
function onEdit(){
  dirty = true;
  updatePreview();
  scheduleStash();
}

function readForm(){
  if(mode === 'personagem'){
    const v = id => $(id).value.trim() || null;
    return {
      name: $('fTitle').value.trim(),
      bio: v('fBio'),
      race: v('fRace'), age: v('fAge'), birthplace: v('fBirthplace'),
      class: v('fClass'), affiliation: v('fAffiliation'),
      story: v('fContent'),
      photo_url: photo.removed ? null : photo.url
    };
  }
  const base = {
    title: $('fTitle').value.trim(),
    tags: parseTags($('fTags').value),
    summary: $('fSummary').value.trim() || null,
    content: $('fContent').value.trim() || null
  };
  if(mode === 'campanha'){
    const s = $('fSession').value;
    return {
      ...base,
      campaign: $('fCampaign').value.trim() || null,
      arc: $('fArc').value.trim() || null,
      session: s === '' ? null : parseInt(s, 10),
      date: $('fDate').value
    };
  }
  return {
    ...base,
    parent_id: $('fParent').value === '' ? null : Number($('fParent').value),
    position: parseInt($('fPosition').value || '0', 10) || 0
  };
}

function applyValues(v){
  if(mode === 'personagem'){
    $('fTitle').value = v.name || '';
    $('fContent').value = v.story || '';
    $('fBio').value = v.bio || '';
    $('fRace').value = v.race || '';
    $('fAge').value = v.age || '';
    $('fBirthplace').value = v.birthplace || '';
    $('fClass').value = v.class || '';
    $('fAffiliation').value = v.affiliation || '';
    setPhoto(v.photo_url || null);
    refreshDatalists();
    return;
  }
  $('fTitle').value = v.title || '';
  $('fTags').value = (v.tags || []).join(', ');
  $('fSummary').value = v.summary || '';
  $('fContent').value = v.content || '';
  if(mode === 'campanha'){
    $('fCampaign').value = v.campaign || '';
    $('fArc').value = v.arc || '';
    $('fSession').value = v.session ?? '';
    delete $('fSession').dataset.auto;
    $('fDate').value = v.date || todayISO();
  } else {
    refreshParentSelect();
    $('fParent').value = v.parent_id != null ? String(v.parent_id) : '';
    $('fPosition').value = v.position ?? 0;
  }
  refreshDatalists();
}

function resetFields(){
  applyValues({ title:'', name:'', tags:[], summary:'', content:'', story:'', date: todayISO(), position: 0 });
  if(mode === 'lore') suggestPosition();
}

function newEntry(m){
  clearTimeout(stashTimer);
  current = null;
  mode = m;
  setMode(m);
  resetFields();
  dirty = false;
  history.replaceState(null, '', location.pathname);
  updateChrome();
  updatePreview();
  checkDraft();
}

function openEntry(m, id){
  const rows = m === 'campanha' ? sessoes : m === 'lore' ? tomos : personagens;
  const row = rows.find(r => String(r.id) === String(id));
  if(!row){ alert('Não encontrei essa entrada. Ela pode ter sido excluída.'); newEntry('campanha'); return; }
  clearTimeout(stashTimer);
  current = row;
  mode = m;
  setMode(m);
  applyValues(row);
  dirty = false;
  history.replaceState(null, '', `#${KIND[m]}=${row.id}`);
  updateChrome();
  updatePreview();
  checkDraft();
}

/* ---------- ajudas de preenchimento ---------- */
function refreshDatalists(){
  const camps = [...new Set(sessoes.map(s => (s.campaign || '').trim()).filter(Boolean))];
  $('dlCampaigns').innerHTML = camps.map(c => `<option value="${escapeHtml(c)}">`).join('');
  const typed = $('fCampaign').value.trim();
  const arcs = [...new Set(sessoes
    .filter(s => !typed || (s.campaign || '').trim() === typed)
    .map(s => (s.arc || '').trim()).filter(Boolean))];
  $('dlArcs').innerHTML = arcs.map(a => `<option value="${escapeHtml(a)}">`).join('');
  const affs = [...new Set([
    ...personagens.map(p => (p.affiliation || '').trim()),
    ...camps
  ].filter(Boolean))];
  $('dlAffiliations').innerHTML = affs.map(a => `<option value="${escapeHtml(a)}">`).join('');
}

/* sugere o próximo número de sessão do arco escolhido (só em entrada nova) */
function suggestSession(){
  if(current) return;
  const f = $('fSession');
  if(f.value !== '' && !f.dataset.auto) return;
  const c = $('fCampaign').value.trim(), a = $('fArc').value.trim();
  if(!c || !a){ f.value = ''; delete f.dataset.auto; return; }
  const nums = sessoes
    .filter(s => (s.campaign || '').trim() === c && (s.arc || '').trim() === a)
    .map(s => s.session).filter(n => n != null);
  f.value = (nums.length ? Math.max(...nums) : 0) + 1;
  f.dataset.auto = '1';
}

function refreshParentSelect(){
  const sel = $('fParent');
  const keep = sel.value;
  const excluded = new Set();
  if(current && mode === 'lore'){
    const collect = id => { excluded.add(id); tomoTree.childrenOf(id).forEach(k => collect(k.id)); };
    collect(current.id);   // não dá pra escolher o próprio tomo nem descendente como pai
  }
  let html = '<option value="">— Raiz (nível mais alto) —</option>';
  const walk = (nodes, depth) => nodes.forEach(n => {
    if(excluded.has(n.id)) return;
    html += `<option value="${n.id}">${'   '.repeat(depth)}${depth ? '└ ' : ''}${escapeHtml(n.title)}${n.published ? '' : ' (rascunho)'}</option>`;
    walk(tomoTree.childrenOf(n.id), depth + 1);
  });
  walk(tomoTree.roots, 0);
  sel.innerHTML = html;
  if([...sel.options].some(o => o.value === keep)) sel.value = keep;
}

function suggestPosition(){
  const parent = $('fParent').value === '' ? null : Number($('fParent').value);
  const sibs = tomoTree.childrenOf(parent).filter(t => !current || t.id !== current.id);
  $('fPosition').value = sibs.length ? Math.max(...sibs.map(t => t.position)) + 1 : 0;
  onEdit();
}

/* ============ prévia ============ */
function updatePreview(){
  const f = readForm();
  if(mode === 'personagem'){
    $('preview').innerHTML = renderPerfilHtml(f, photoSrc());
    return;
  }
  let crumbs;
  if(mode === 'campanha'){
    crumbs = [f.campaign || NO_CAMPAIGN, f.arc || NO_ARC, f.session != null && !Number.isNaN(f.session) ? `Sessão ${f.session}` : ''];
  } else {
    crumbs = f.parent_id ? tomoTree.pathOf(f.parent_id).map(n => n.title) : [];
  }
  $('preview').innerHTML = renderPostHtml(f, KIND[mode], crumbs,
    '<p class="muted">O texto aparece aqui enquanto você escreve.</p>');
}

/* ============ rascunho local (rede de segurança) ============ */
const draftKey = () => `mio:rascunho:${mode}:${current ? current.id : 'novo'}`;
let stashTimer = null;

function scheduleStash(){
  clearTimeout(stashTimer);
  stashTimer = setTimeout(() => {
    try{ localStorage.setItem(draftKey(), JSON.stringify(readForm())); }catch(_){}
  }, 500);
}
function clearDraft(){
  clearTimeout(stashTimer);
  try{ localStorage.removeItem(draftKey()); }catch(_){}
}
function checkDraft(){
  let raw = null;
  try{ raw = localStorage.getItem(draftKey()); }catch(_){}
  $('draftBanner').hidden = !raw;
}
function restoreDraft(){
  try{
    const v = JSON.parse(localStorage.getItem(draftKey()));
    if(v){ applyValues(v); dirty = true; updatePreview(); }
  }catch(_){}
  $('draftBanner').hidden = true;
}

/* ============ salvar / excluir ============ */
let toastTimer = null;
function showToast(msg, link){
  const el = $('toast');
  el.textContent = msg;
  if(link){
    const a = document.createElement('a');
    a.href = link.href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = link.label;
    el.appendChild(a);
  }
  el.classList.add('toast--show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('toast--show'), link ? 7000 : 2600);
}

function siteHref(id){
  return mode === 'campanha' ? `index.html#s=${id}`
       : mode === 'lore' ? `tomos.html#t=${id}`
       : `personagens.html#p=${id}`;
}

function setBusy(busy){ ['btnPrimary','btnSecondary','btnDelete'].forEach(id => { $(id).disabled = busy; }); }

async function save(publish){
  const f = readForm();
  if(mode === 'personagem' ? !f.name : !f.title){
    showToast(mode === 'personagem' ? 'Dê um nome ao personagem.' : 'Dê um título à entrada.');
    $('fTitle').focus();
    return;
  }
  if(mode === 'campanha' && !f.date){ showToast('Informe a data da sessão.'); $('fDate').focus(); return; }
  if(current && mode === 'lore' && f.parent_id === current.id){ showToast('Um tomo não pode pertencer a si mesmo.'); return; }

  const payload = { ...f, published: publish };
  const table = TABLE[mode];
  const oldKey = draftKey();
  setBusy(true);

  /* personagem: a foto nova sobe para o Storage antes de gravar a linha */
  let uploadedPath = null;
  if(mode === 'personagem' && photo.blob){
    try{
      const up = await uploadPhoto(photo.blob);
      uploadedPath = up.path;
      payload.photo_url = up.url;
    }catch(err){
      setBusy(false);
      alert('Não consegui enviar a foto: ' + err.message + '\n\nO seu texto continua no formulário.');
      return;
    }
  }

  const q = current
    ? supabaseClient.from(table).update(payload).eq('id', current.id)
    : supabaseClient.from(table).insert(payload);
  const { data, error } = await q.select().single();
  setBusy(false);
  if(error){
    if(uploadedPath) removePhotoFile(uploadedPath);   // não deixa foto órfã no Storage
    alert('Não consegui salvar: ' + error.message + '\n\nO seu texto continua no formulário e no rascunho local.');
    return;
  }
  /* trocou ou removeu a foto: apaga o arquivo antigo, que ninguém mais usa */
  if(mode === 'personagem' && (photo.blob || photo.removed) && photo.url) removePhotoFile(photoPath(photo.url));

  try{ localStorage.removeItem(oldKey); }catch(_){}
  clearTimeout(stashTimer);
  await loadData();
  current = (mode === 'campanha' ? sessoes : mode === 'lore' ? tomos : personagens).find(r => r.id === data.id) || data;
  if(mode === 'personagem') setPhoto(current.photo_url || null);
  dirty = false;
  history.replaceState(null, '', `#${KIND[mode]}=${current.id}`);
  refreshParentSelect();
  if(mode === 'lore') $('fParent').value = current.parent_id != null ? String(current.parent_id) : '';
  updateChrome();
  updatePreview();
  $('draftBanner').hidden = true;

  showToast(publish ? 'Publicado.' : 'Rascunho salvo.',
    publish ? { href: siteHref(current.id), label: 'Ver no site' } : null);
}

async function removeCurrent(){
  if(!current) return;
  if(mode === 'lore' && tomoTree.childrenOf(current.id).length){
    alert('Este tomo tem subtomos. Mova ou exclua os subtomos antes de excluí-lo.');
    return;
  }
  if(!confirm(`Excluir "${current.title || current.name}" de vez? Isso não pode ser desfeito.`)) return;
  setBusy(true);
  const { error } = await supabaseClient.from(TABLE[mode]).delete().eq('id', current.id);
  setBusy(false);
  if(error){ alert('Não consegui excluir: ' + error.message); return; }
  if(mode === 'personagem' && current.photo_url) removePhotoFile(photoPath(current.photo_url));
  clearDraft();
  await loadData();
  showToast('Entrada excluída.');
  newEntry(mode);
}

/* ============ lista de entradas existentes ============ */
function renderExisting(){
  const list = $('existingList');
  const item = (row, label, depth) =>
    `<button type="button" class="existing__item${current && current.id === row.id ? ' is-current' : ''}" data-id="${row.id}" style="--d:${depth}">${escapeHtml(label)}${row.published ? '' : ' <span class="badge">rascunho</span>'}</button>`;

  if(mode === 'campanha'){
    if(!sessoes.length){ list.innerHTML = '<p class="existing__empty">Nenhuma sessão ainda.</p>'; return; }
    list.innerHTML = groupSessoes(sessoes).map(c => c.arcs.map(a =>
      `<div class="existing__group">${escapeHtml(c.name)} › ${escapeHtml(a.name)}</div>` +
      a.items.map(s => item(s, sessionLabel(s), 0)).join('')).join('')).join('');
  } else if(mode === 'personagem'){
    if(!personagens.length){ list.innerHTML = '<p class="existing__empty">Nenhum personagem ainda.</p>'; return; }
    list.innerHTML = groupPersonagens(personagens).map(g =>
      `<div class="existing__group">${escapeHtml(g.name)}</div>` + g.items.map(p => item(p, p.name, 0)).join('')).join('');
  } else {
    if(!tomos.length){ list.innerHTML = '<p class="existing__empty">Nenhum tomo ainda.</p>'; return; }
    const walk = (nodes, d) => nodes.map(n => item(n, n.title, d) + walk(tomoTree.childrenOf(n.id), d + 1)).join('');
    list.innerHTML = walk(tomoTree.roots, 0);
  }
}

/* ============ backup ============ */
function exportBackup(){
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), sessoes, tomos, personagens }, null, 2)],
    { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mio-da-feada-backup-${todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ============ foto do personagem ============ */
const photoSrc = () => photo.objectUrl || (photo.removed ? null : photo.url);

function setPhoto(url){
  if(photo.objectUrl) URL.revokeObjectURL(photo.objectUrl);
  photo = { url, blob: null, objectUrl: null, removed: false };
  $('fPhoto').value = '';
  renderPhotoBox();
}

function renderPhotoBox(){
  const src = photoSrc();
  const img = $('photoPreview');
  if(src) img.src = src; else img.removeAttribute('src');
  img.hidden = !src;
  $('photoEmpty').hidden = !!src;
  $('btnPhotoRemove').hidden = !src;
  $('btnPhoto').textContent = src ? 'Trocar foto' : 'Escolher foto';
}

async function onPhotoChosen(){
  const file = $('fPhoto').files[0];
  if(!file) return;
  try{
    const blob = await shrinkImage(file);
    if(photo.objectUrl) URL.revokeObjectURL(photo.objectUrl);
    photo.blob = blob;
    photo.objectUrl = URL.createObjectURL(blob);
    photo.removed = false;
    renderPhotoBox();
    onEdit();
  }catch(err){
    showToast(err.message);
  }
  $('fPhoto').value = '';
}

function removePhoto(){
  if(photo.objectUrl) URL.revokeObjectURL(photo.objectUrl);
  photo.blob = null;
  photo.objectUrl = null;
  photo.removed = true;
  renderPhotoBox();
  onEdit();
}

/* Reduz a imagem para no máximo 1000 px no maior lado e comprime (WebP se o
   navegador permitir; senão JPEG). Fica bem abaixo do limite de 2 MB do bucket. */
async function shrinkImage(file){
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Use uma imagem JPG, PNG ou WebP.');
  let bmp;
  try{ bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch(_){ throw new Error('Não consegui abrir essa imagem. Tente outro arquivo.'); }
  const scale = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  let blob = await new Promise(res => canvas.toBlob(res, 'image/webp', 0.86));
  if(!blob || blob.type !== 'image/webp'){
    /* JPEG não tem transparência: assenta a imagem sobre um fundo escuro neutro */
    const flat = document.createElement('canvas');
    flat.width = canvas.width; flat.height = canvas.height;
    const fctx = flat.getContext('2d');
    fctx.fillStyle = '#1B0F3B'; fctx.fillRect(0, 0, flat.width, flat.height);
    fctx.drawImage(canvas, 0, 0);
    blob = await new Promise(res => flat.toBlob(res, 'image/jpeg', 0.86));
  }
  if(!blob) throw new Error('Não consegui preparar a imagem.');
  return blob;
}

async function uploadPhoto(blob){
  const path = `${crypto.randomUUID()}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`;
  const { error } = await supabaseClient.storage.from(BUCKET)
    .upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
  if(error) throw new Error(error.message);
  return { path, url: supabaseClient.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

/* caminho do arquivo dentro do bucket, a partir da URL pública */
function photoPath(url){
  const parts = String(url || '').split(`/${BUCKET}/`);
  return parts.length > 1 ? decodeURIComponent(parts[parts.length - 1].split('?')[0]) : null;
}

async function removePhotoFile(path){
  if(!path) return;
  try{ await supabaseClient.storage.from(BUCKET).remove([path]); }catch(_){ /* arquivo sobrando não quebra nada */ }
}
