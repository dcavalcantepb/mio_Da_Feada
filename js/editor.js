/* ===== Login real via Supabase Auth =====
   Diferente da versão anterior (senha fixa no código), aqui a checagem
   de "quem pode editar" é feita pelo próprio Supabase: o e-mail/senha
   batem com o usuário criado em Authentication > Users, e as RLS
   policies da tabela `entries` só liberam INSERT/UPDATE/DELETE para
   quem estiver autenticado. */

const gateScreen = document.getElementById('gateScreen');
const deskScreen = document.getElementById('deskScreen');
const gateMsg = document.getElementById('gateMsg');

document.getElementById('gateEnter').addEventListener('click', tryLogin);
document.getElementById('gatePassword').addEventListener('keydown', e => {
  if(e.key === 'Enter') tryLogin();
});

async function tryLogin(){
  const email = document.getElementById('gateEmail').value.trim();
  const password = document.getElementById('gatePassword').value;
  gateMsg.textContent = 'Entrando…';
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if(error){
    gateMsg.textContent = 'Não consegui entrar: ' + error.message;
    return;
  }
  showDesk();
}

async function checkExistingSession(){
  const { data } = await supabaseClient.auth.getSession();
  if(data.session) showDesk();
}
checkExistingSession();

function showDesk(){
  gateScreen.hidden = true;
  deskScreen.hidden = false;
  initDesk();
}

document.getElementById('btnLogout')?.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  location.reload();
});

/* ---------- estado em memória (não fica salvo local, vem do banco) ---------- */
let entries = [];
let currentId = null; // id (uuid) da entrada sendo editada, ou null = nova

function slugHint(str){
  return String(str).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'entrada';
}

let deskInitialized = false;
async function initDesk(){
  if(deskInitialized) return;
  deskInitialized = true;

  bindFormEvents();
  clearForm();
  await loadEntries();

  document.getElementById('btnNew').addEventListener('click', () => clearForm());
  document.getElementById('btnSaveEntry').addEventListener('click', saveEntryFromForm);
  document.getElementById('btnDeleteEntry').addEventListener('click', deleteCurrentEntry);
  document.getElementById('btnExport').addEventListener('click', exportBackup);
}

function bindFormEvents(){
  ['fTitle','fType','fDate','fArc','fSession','fTags','fSummary','fContent'].forEach(id => {
    document.getElementById(id).addEventListener('input', updatePreview);
  });
}

function setStatus(msg){
  document.getElementById('statusPill').textContent = msg;
}

/* ---------- ler do banco ---------- */
async function loadEntries(){
  setStatus('carregando…');
  const { data, error } = await supabaseClient
    .from('entries')
    .select('*')
    .order('date', { ascending: true });
  if(error){
    setStatus('erro ao carregar');
    alert('Não consegui carregar as entradas: ' + error.message);
    return;
  }
  entries = data;
  setStatus('conectado ao banco · ' + entries.length + ' entrada(s)');
  renderEntryList();
}

/* ---------- form <-> objeto ---------- */
function formToEntry(){
  const tags = document.getElementById('fTags').value
    .split(',').map(t => t.trim()).filter(Boolean);
  return {
    title: document.getElementById('fTitle').value.trim() || 'Sem título',
    type: document.getElementById('fType').value,
    arc: document.getElementById('fArc').value.trim(),
    session: document.getElementById('fSession').value ? Number(document.getElementById('fSession').value) : null,
    date: document.getElementById('fDate').value || null,
    tags,
    summary: document.getElementById('fSummary').value.trim(),
    content: document.getElementById('fContent').value
  };
}

function updatePreview(){
  const entry = formToEntry();
  const el = document.getElementById('previewPage');
  el.innerHTML = `
    <p class="page__eyebrow">
      <span>${TYPE_LABELS[entry.type] || entry.type}</span>
      <span class="dot">·</span>
      <span>${formatDate(entry.date) || '—'}</span>
      ${entry.session ? `<span class="dot">·</span><span>Sessão ${entry.session}</span>` : ''}
    </p>
    <h1>${escapeHtml(entry.title)}</h1>
    ${entry.summary ? `<p class="page__summary">${escapeHtml(entry.summary)}</p>` : ''}
    ${entry.tags.length ? `<div class="page__tags">${entry.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    <div class="page__body">${renderMarkdownLite(entry.content) || '<p style="opacity:.5">O conteúdo aparece aqui conforme você escreve…</p>'}</div>
  `;
}

function clearForm(){
  currentId = null;
  document.getElementById('fTitle').value = '';
  document.getElementById('fType').value = 'campanha';
  document.getElementById('fDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('fArc').value = '';
  document.getElementById('fSession').value = '';
  document.getElementById('fTags').value = '';
  document.getElementById('fSummary').value = '';
  document.getElementById('fContent').value = '';
  document.getElementById('btnDeleteEntry').hidden = true;
  updatePreview();
}

function loadEntryIntoForm(id){
  const entry = entries.find(e => e.id === id);
  if(!entry) return;
  currentId = entry.id;
  document.getElementById('fTitle').value = entry.title || '';
  document.getElementById('fType').value = entry.type || 'campanha';
  document.getElementById('fDate').value = entry.date || '';
  document.getElementById('fArc').value = entry.arc || '';
  document.getElementById('fSession').value = entry.session ?? '';
  document.getElementById('fTags').value = (entry.tags || []).join(', ');
  document.getElementById('fSummary').value = entry.summary || '';
  document.getElementById('fContent').value = entry.content || '';
  document.getElementById('btnDeleteEntry').hidden = false;
  updatePreview();
}

/* ---------- escrever no banco ----------
   currentId vazio = INSERT (linha nova, o banco gera o id sozinho)
   currentId preenchido = UPDATE (mexe só na linha daquele id) */
async function saveEntryFromForm(){
  const payload = formToEntry();
  setStatus('salvando…');

  if(currentId){
    const { error } = await supabaseClient.from('entries').update(payload).eq('id', currentId);
    if(error){ setStatus('erro ao salvar'); alert('Não consegui salvar: ' + error.message); return; }
  } else {
    const { data, error } = await supabaseClient.from('entries').insert(payload).select().single();
    if(error){ setStatus('erro ao salvar'); alert('Não consegui salvar: ' + error.message); return; }
    currentId = data.id;
  }

  await loadEntries();
  document.getElementById('btnDeleteEntry').hidden = false;
  setStatus('salvo no banco · ' + new Date().toLocaleTimeString('pt-BR'));
}

async function deleteCurrentEntry(){
  if(!currentId) return;
  if(!confirm('Excluir esta entrada do banco? Isso não pode ser desfeito.')) return;
  const { error } = await supabaseClient.from('entries').delete().eq('id', currentId);
  if(error){ alert('Não consegui excluir: ' + error.message); return; }
  await loadEntries();
  clearForm();
}

function renderEntryList(){
  const list = document.getElementById('entryList');
  if(!entries.length){
    list.innerHTML = '<li style="opacity:.6">Nenhuma entrada ainda.</li>';
    return;
  }
  list.innerHTML = entries.map(e => `
    <li>
      <button class="link" data-id="${e.id}">${escapeHtml(e.title)} <span style="opacity:.5">— ${TYPE_LABELS[e.type] || e.type}</span></button>
      <button class="del" data-id="${e.id}" title="Excluir" aria-label="Excluir ${escapeHtml(e.title)}">✕</button>
    </li>
  `).join('');
  list.querySelectorAll('.link').forEach(btn => btn.addEventListener('click', () => loadEntryIntoForm(btn.dataset.id)));
  list.querySelectorAll('.del').forEach(btn => btn.addEventListener('click', async () => {
    if(!confirm('Excluir esta entrada do banco? Isso não pode ser desfeito.')) return;
    const { error } = await supabaseClient.from('entries').delete().eq('id', btn.dataset.id);
    if(error){ alert('Não consegui excluir: ' + error.message); return; }
    await loadEntries();
    if(currentId === btn.dataset.id) clearForm();
  }));
}

/* Cópia de segurança opcional — não é mais necessária para publicar
   (isso já acontece na hora, ao salvar), só útil caso você queira
   guardar um arquivo local com tudo que está no banco hoje. */
function exportBackup(){
  const blob = new Blob([JSON.stringify({ site: SITE_INFO, entries }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'stories-backup.json';
  a.click();
  URL.revokeObjectURL(url);
}
