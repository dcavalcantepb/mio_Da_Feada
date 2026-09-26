/* Casca compartilhada das páginas de leitura (index.html e tomos.html):
   barra lateral retrátil, login, árvore do índice, anterior/próximo.
   Cada página traz a sua própria lógica (reader.js = sessões,
   tomos.js = tomos) e chama startPage(recarregar) no fim. */

const els = {
  nav: document.getElementById('nav'),
  navToggle: document.getElementById('navToggle'),
  scrim: document.getElementById('scrim'),
  tree: document.getElementById('tree'),
  post: document.getElementById('post'),
  pager: document.getElementById('pager'),
  btnAuth: document.getElementById('btnAuth'),
  btnNew: document.getElementById('btnNew'),
  dlg: document.getElementById('loginDialog')
};

/* qual seção esta página mostra: campanhas | tomos | personagens */
const SECTION = document.body.dataset.section;

let loggedIn = false;
const openKeys = new Set([`r:${SECTION}`]);

/* o menu é o mesmo em todas as páginas, então os dois conjuntos de dados
   são carregados sempre */
let sessoes = [];
let groups = [];
let tomos = [];
let tomoTree = buildTomoTree([]);
let personagens = [];
let grupos = [];   // personagens agrupados por afiliação

document.getElementById('siteWord').textContent = SITE_INFO.title;
document.getElementById('siteSub').textContent = SITE_INFO.subtitle;

/* ============ barra lateral (retrátil, começa fechada) ============ */
const WIDE = window.matchMedia('(min-width: 900px)');

function setNav(open){
  document.body.classList.toggle('nav-open', open);
  els.nav.inert = !open;
  els.navToggle.setAttribute('aria-expanded', String(open));
  els.navToggle.setAttribute('aria-label', open ? 'Fechar o índice' : 'Abrir o índice');
  els.scrim.hidden = !(open && !WIDE.matches);
}
els.navToggle.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
els.scrim.addEventListener('click', () => setNav(false));
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && document.body.classList.contains('nav-open') && !els.dlg.open){
    setNav(false);
    els.navToggle.focus();
  }
});
WIDE.addEventListener('change', () => setNav(document.body.classList.contains('nav-open')));

/* ============ login ============ */
async function refreshAuth(){
  const { data } = await supabaseClient.auth.getSession();
  const now = !!data.session;
  const changed = now !== loggedIn;
  loggedIn = now;
  els.btnAuth.textContent = loggedIn ? 'Sair' : 'Entrar';
  els.btnNew.hidden = !loggedIn;
  return changed;
}

els.btnAuth.addEventListener('click', async () => {
  if(loggedIn){
    await supabaseClient.auth.signOut();
    return;
  }
  document.getElementById('loginMsg').textContent = '';
  els.dlg.showModal();
  document.getElementById('loginEmail').focus();
});
document.getElementById('loginCancel').addEventListener('click', () => els.dlg.close());
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = document.getElementById('loginMsg');
  const btn = document.getElementById('loginSubmit');
  msg.textContent = '';
  btn.disabled = true;
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: document.getElementById('loginEmail').value.trim(),
    password: document.getElementById('loginPassword').value
  });
  btn.disabled = false;
  if(error){
    msg.textContent = 'Não consegui entrar: ' + error.message;
    return;
  }
  document.getElementById('loginPassword').value = '';
  els.dlg.close();
});

/* ============ árvore do índice ============
   Três categorias na mesma barra lateral: Campanhas (Campanha > Arco >
   Sessões), Tomos do Storyteller (árvore livre) e Personagens. Cada item
   leva à página da sua seção. */
const sessionHref = id => `index.html#s=${id}`;
const tomoHref = id => `tomos.html#t=${id}`;
const personagemHref = id => `personagens.html#p=${id}`;

function badge(published){ return published ? '' : ' <span class="badge">rascunho</span>'; }

function groupNode(key, label, depth, inner, extra = ''){
  const open = openKeys.has(key);
  return `<li class="node${open ? ' open' : ''}" data-key="${escapeHtml(key)}">
    <button class="row row--toggle${extra}" type="button" style="--d:${depth}" aria-expanded="${open}">
      <span class="caret" aria-hidden="true"></span><span class="row__label">${escapeHtml(label)}</span>
    </button>
    <ul>${inner}</ul></li>`;
}

function leafLink(href, label, depth, published, extra = ''){
  return `<li class="node"><a class="row row--leaf${extra}" style="--d:${depth}" href="${href}" data-hash="${href}">
    <span class="row__label">${escapeHtml(label)}${badge(published)}</span></a></li>`;
}

function rootNode(key, label, href, inner){
  const open = openKeys.has(key);
  return `<li class="node${open ? ' open' : ''}" data-key="${key}">
    <div class="row row--split row--root" style="--d:0">
      <button class="caret-btn" type="button" aria-expanded="${open}" aria-label="Expandir ${escapeHtml(label)}"><span class="caret" aria-hidden="true"></span></button>
      <a class="row__label" href="${href}" data-hash="${href}">${escapeHtml(label)}</a>
    </div>
    <ul>${inner}</ul></li>`;
}

function tomoNode(t, depth){
  const kids = tomoTree.childrenOf(t.id);
  const href = tomoHref(t.id);
  if(!kids.length) return leafLink(href, t.title, depth, t.published);
  const key = `t:${t.id}`;
  const open = openKeys.has(key);
  return `<li class="node${open ? ' open' : ''}" data-key="${key}">
    <div class="row row--split" style="--d:${depth}">
      <button class="caret-btn" type="button" aria-expanded="${open}" aria-label="Expandir ${escapeHtml(t.title)}"><span class="caret" aria-hidden="true"></span></button>
      <a class="row__label" href="${href}" data-hash="${href}">${escapeHtml(t.title)}${badge(t.published)}</a>
    </div>
    <ul>${kids.map(k => tomoNode(k, depth + 1)).join('')}</ul></li>`;
}

function renderTree(){
  const campanhas = groups.length
    ? groups.map(c => groupNode(`c:${c.name}`, c.name, 1,
        c.arcs.map(a => groupNode(`a:${c.name}|${a.name}`, a.name, 2,
          a.items.map(s => leafLink(sessionHref(s.id), sessionLabel(s), 3, s.published)).join(''))).join(''))).join('')
    : '<li class="tree__empty">Nenhuma sessão ainda.</li>';
  const lore = tomoTree.roots.length
    ? tomoTree.roots.map(t => tomoNode(t, 1)).join('')
    : '<li class="tree__empty">Nenhum tomo ainda.</li>';

  const pessoas = grupos.length
    ? grupos.map(g => groupNode(`f:${g.name}`, g.name, 1,
        g.items.map(p => leafLink(personagemHref(p.id), p.name, 2, p.published)).join(''))).join('')
    : '<li class="tree__empty">Nenhum personagem ainda.</li>';

  els.tree.innerHTML = `<ul class="tree__root">
    ${rootNode('r:campanhas', 'Campanhas', 'index.html', campanhas)}
    ${rootNode('r:tomos', 'Tomos do Storyteller', 'tomos.html', lore)}
    ${rootNode('r:personagens', 'Personagens', 'personagens.html', pessoas)}
  </ul>`;
}

async function loadAll(){
  [sessoes, tomos, personagens] = await Promise.all([fetchSessoes(), fetchTomos(), fetchPersonagens()]);
  grupos = groupPersonagens(personagens);
  setMentionIndex({ sessoes, tomos, personagens });
  groups = groupSessoes(sessoes);
  tomoTree = buildTomoTree(tomos);
  renderTree();
}

/* ao trocar de página com o menu aberto (tela larga), ele continua aberto na próxima */
const NAV_KEEP = 'mio:navKeep';
try{
  if(sessionStorage.getItem(NAV_KEEP)){
    sessionStorage.removeItem(NAV_KEEP);
    if(WIDE.matches) setNav(true);
  }
}catch(_){}

const samePage = href => {
  const norm = p => p.replace(/index\.html$/, '');
  return norm(new URL(href, location.href).pathname) === norm(location.pathname);
};

els.tree.addEventListener('click', e => {
  const btn = e.target.closest('.row--toggle, .caret-btn');
  if(btn){
    const node = btn.closest('.node');
    const open = !node.classList.contains('open');
    node.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    open ? openKeys.add(node.dataset.key) : openKeys.delete(node.dataset.key);
    return;
  }
  const link = e.target.closest('a[data-hash]');
  if(!link) return;
  if(!WIDE.matches) setNav(false);
  else if(!samePage(link.href)){
    try{ sessionStorage.setItem(NAV_KEEP, '1'); }catch(_){}
  }
});

/* marca o item atual e abre o caminho até ele, sem reconstruir a árvore
   (assim o foco do teclado não se perde). currentHref: o data-hash do item. */
function syncTree(currentHref, ancestors){
  ancestors.forEach(k => openKeys.add(k));
  els.tree.querySelectorAll('.node[data-key]').forEach(node => {
    const open = openKeys.has(node.dataset.key);
    node.classList.toggle('open', open);
    node.querySelector(':scope > .row--toggle, :scope > .row--split .caret-btn')
      ?.setAttribute('aria-expanded', String(open));
  });
  els.tree.querySelectorAll('a[data-hash]').forEach(a => {
    const on = a.dataset.hash === currentHref;
    a.classList.toggle('is-current', on);
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
}

/* ============ conteúdo ============ */
function setPager(prev, next){
  const link = (item, dir) => item
    ? `<a class="pager__${dir}" href="${item.href}"><span class="pager__dir">${dir === 'prev' ? '← Anterior' : 'Próxima →'}</span><span>${escapeHtml(item.label)}</span></a>`
    : '<span></span>';
  els.pager.hidden = !prev && !next;
  els.pager.innerHTML = link(prev, 'prev') + link(next, 'next');
}

function paint(html, title){
  els.post.innerHTML = html;
  document.title = title ? `${title} — ${SITE_INFO.title}` : SITE_INFO.title;
}

function editLink(kind, id){
  return loggedIn
    ? `<p class="post__edit"><a href="editor.html#${kind}=${id}" target="_blank" rel="noopener">Editar esta entrada</a></p>`
    : '';
}

/* ============ início da página ============
   reload(): busca os dados, monta a árvore e mostra a rota atual.
   route():  mostra a rota atual (troca de hash, sem ir ao banco). */
async function startPage({ reload, route }){
  window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
  /* logou/deslogou (aqui ou em outra aba): recarrega, porque rascunhos entram ou saem */
  supabaseClient.auth.onAuthStateChange(async () => {
    if(await refreshAuth()) await reload();
  });
  await refreshAuth();
  await reload();
}
