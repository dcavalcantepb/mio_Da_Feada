/* Escritório (editor.html). Escreve em duas tabelas do Supabase:
     Campanha → `sessoes`  (Campanha > Arco > Sessão, com data)
     Lore     → `tomos`    (árvore: cada tomo aponta para o pai)
   O login é real (Supabase Auth); quem barra escrita de verdade é a RLS
   do banco. Rascunhos não salvos ficam guardados no navegador. */

const $ = id => document.getElementById(id);
const TABLE = { campanha: 'sessoes', lore: 'tomos' };
const KIND = { campanha: 'sessao', lore: 'tomo' };

let mode = 'campanha';
let sessoes = [];
let tomos = [];
let tomoTree = buildTomoTree([]);
let current = null;   // linha já salva que está sendo editada (null = entrada nova)
let dirty = false;

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
    [sessoes, tomos] = await Promise.all([fetchSessoes(), fetchTomos()]);
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
  else newEntry('campanha');
}

/* ============ eventos ============ */
function bindEvents(){
  document.querySelectorAll('input[name="mode"]').forEach(r =>
    r.addEventListener('change', () => { if(r.checked) newModeSwitch(r.value); }));

  ['fTitle','fCampaign','fArc','fSession','fDate','fParent','fPosition','fTags','fSummary','fContent'].forEach(id =>
    $(id).addEventListener('input', onEdit));
  $('fSession').addEventListener('input', () => { delete $('fSession').dataset.auto; });
  ['fCampaign','fArc'].forEach(id => $(id).addEventListener('input', () => { refreshDatalists(); suggestSession(); }));
  $('fParent').addEventListener('change', suggestPosition);

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

/* ============ modo Campanha ⇄ Lore ============ */
function setMode(m){
  mode = m;
  $('modeCampanha').checked = m === 'campanha';
  $('modeLore').checked = m === 'lore';
  document.querySelectorAll('[data-only]').forEach(el => { el.hidden = el.dataset.only !== m; });
  refreshParentSelect();
  renderExisting();
  updateChrome();
  updatePreview();
}

function updateChrome(){
  const locked = !!current;
  $('modeCampanha').disabled = $('modeLore').disabled = locked;
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
  applyValues({ title:'', tags:[], summary:'', content:'', date: todayISO(), position: 0 });
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
  const rows = m === 'campanha' ? sessoes : tomos;
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

function setBusy(busy){ ['btnPrimary','btnSecondary','btnDelete'].forEach(id => { $(id).disabled = busy; }); }

async function save(publish){
  const f = readForm();
  if(!f.title){ showToast('Dê um título à entrada.'); $('fTitle').focus(); return; }
  if(mode === 'campanha' && !f.date){ showToast('Informe a data da sessão.'); $('fDate').focus(); return; }
  if(current && mode === 'lore' && f.parent_id === current.id){ showToast('Um tomo não pode pertencer a si mesmo.'); return; }

  const payload = { ...f, published: publish };
  const table = TABLE[mode];
  const oldKey = draftKey();
  setBusy(true);
  const q = current
    ? supabaseClient.from(table).update(payload).eq('id', current.id)
    : supabaseClient.from(table).insert(payload);
  const { data, error } = await q.select().single();
  setBusy(false);
  if(error){
    alert('Não consegui salvar: ' + error.message + '\n\nO seu texto continua no formulário e no rascunho local.');
    return;
  }

  try{ localStorage.removeItem(oldKey); }catch(_){}
  clearTimeout(stashTimer);
  await loadData();
  current = (mode === 'campanha' ? sessoes : tomos).find(r => r.id === data.id) || data;
  dirty = false;
  history.replaceState(null, '', `#${KIND[mode]}=${current.id}`);
  refreshParentSelect();
  if(mode === 'lore') $('fParent').value = current.parent_id != null ? String(current.parent_id) : '';
  updateChrome();
  updatePreview();
  $('draftBanner').hidden = true;

  showToast(publish ? 'Publicado.' : 'Rascunho salvo.',
    publish ? { href: `index.html#${mode === 'campanha' ? 's' : 't'}=${current.id}`, label: 'Ver no site' } : null);
}

async function removeCurrent(){
  if(!current) return;
  if(mode === 'lore' && tomoTree.childrenOf(current.id).length){
    alert('Este tomo tem subtomos. Mova ou exclua os subtomos antes de excluí-lo.');
    return;
  }
  if(!confirm(`Excluir "${current.title}" de vez? Isso não pode ser desfeito.`)) return;
  setBusy(true);
  const { error } = await supabaseClient.from(TABLE[mode]).delete().eq('id', current.id);
  setBusy(false);
  if(error){ alert('Não consegui excluir: ' + error.message); return; }
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
  } else {
    if(!tomos.length){ list.innerHTML = '<p class="existing__empty">Nenhum tomo ainda.</p>'; return; }
    const walk = (nodes, d) => nodes.map(n => item(n, n.title, d) + walk(tomoTree.childrenOf(n.id), d + 1)).join('');
    list.innerHTML = walk(tomoTree.roots, 0);
  }
}

/* ============ backup ============ */
function exportBackup(){
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), sessoes, tomos }, null, 2)],
    { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mio-da-feada-backup-${todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
