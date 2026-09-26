/* Página de leitura (index.html) — uma página só, estilo blog.

   Rotas por hash:
     (vazio)   o último episódio publicado da seção Campanhas
     #s=<id>   uma sessão de campanha
     #t=<id>   um tomo (nó da árvore de lore)

   O índice fica numa barra lateral retrátil, com duas árvores separadas:
     Campanhas > Campanha > Arco > Sessões        (tabela `sessoes`)
     Tomos do Storyteller > Tomo > Subtomo > ...  (tabela `tomos`)
   Visitante vê só o que está publicado; logado vê também os rascunhos
   (quem decide isso é a RLS do banco, não este arquivo). */

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

let sessoes = [];
let tomos = [];
let groups = [];
let tomoTree = buildTomoTree([]);
let loggedIn = false;
const openKeys = new Set(['r:campanhas', 'r:tomos']);

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

/* logou/deslogou (aqui ou em outra aba): recarrega, porque rascunhos entram ou saem */
supabaseClient.auth.onAuthStateChange(async () => {
  if(await refreshAuth()) await loadAndRender();
});

/* ============ dados ============ */
async function loadAndRender(){
  try{
    [sessoes, tomos] = await Promise.all([fetchSessoes(), fetchTomos()]);
  }catch(err){
    els.post.innerHTML = `<p class="form-msg">Não consegui carregar a crônica: ${escapeHtml(err.message)}</p>`;
    return;
  }
  groups = groupSessoes(sessoes);
  tomoTree = buildTomoTree(tomos);
  renderTree();
  route();
}

/* ============ árvore do índice ============ */
function badge(published){ return published ? '' : ' <span class="badge">rascunho</span>'; }

function groupNode(key, label, depth, inner, extra = ''){
  const open = openKeys.has(key);
  return `<li class="node${open ? ' open' : ''}" data-key="${escapeHtml(key)}">
    <button class="row row--toggle${extra}" type="button" style="--d:${depth}" aria-expanded="${open}">
      <span class="caret" aria-hidden="true"></span><span class="row__label">${escapeHtml(label)}</span>
    </button>
    <ul>${inner}</ul></li>`;
}

function leafLink(hash, label, depth, published){
  return `<li class="node"><a class="row row--leaf" style="--d:${depth}" href="${hash}" data-hash="${hash}">
    <span class="row__label">${escapeHtml(label)}${badge(published)}</span></a></li>`;
}

function tomoNode(t, depth){
  const kids = tomoTree.childrenOf(t.id);
  const hash = `#t=${t.id}`;
  if(!kids.length) return leafLink(hash, t.title, depth, t.published);
  const key = `t:${t.id}`;
  const open = openKeys.has(key);
  return `<li class="node${open ? ' open' : ''}" data-key="${key}">
    <div class="row row--split" style="--d:${depth}">
      <button class="caret-btn" type="button" aria-expanded="${open}" aria-label="Expandir ${escapeHtml(t.title)}"><span class="caret" aria-hidden="true"></span></button>
      <a class="row__label" href="${hash}" data-hash="${hash}">${escapeHtml(t.title)}${badge(t.published)}</a>
    </div>
    <ul>${kids.map(k => tomoNode(k, depth + 1)).join('')}</ul></li>`;
}

function renderTree(){
  const campanhas = groups.length
    ? groups.map(c => groupNode(`c:${c.name}`, c.name, 1,
        c.arcs.map(a => groupNode(`a:${c.name}|${a.name}`, a.name, 2,
          a.items.map(s => leafLink(`#s=${s.id}`, sessionLabel(s), 3, s.published)).join(''))).join(''))).join('')
    : '<li class="tree__empty">Nenhuma sessão ainda.</li>';
  const lore = tomoTree.roots.length
    ? tomoTree.roots.map(t => tomoNode(t, 1)).join('')
    : '<li class="tree__empty">Nenhum tomo ainda.</li>';

  els.tree.innerHTML = `<ul class="tree__root">
    ${groupNode('r:campanhas', 'Campanhas', 0, campanhas, ' row--root')}
    ${groupNode('r:tomos', 'Tomos do Storyteller', 0, lore, ' row--root')}
  </ul>`;
}

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
  if(e.target.closest('a[data-hash]') && !WIDE.matches) setNav(false);
});

/* marca o item atual e abre o caminho até ele, sem reconstruir a árvore
   (assim o foco do teclado não se perde) */
function syncTree(currentHash, ancestors){
  ancestors.forEach(k => openKeys.add(k));
  els.tree.querySelectorAll('.node[data-key]').forEach(node => {
    const open = openKeys.has(node.dataset.key);
    node.classList.toggle('open', open);
    node.querySelector(':scope > .row--toggle, :scope > .row--split .caret-btn')
      ?.setAttribute('aria-expanded', String(open));
  });
  els.tree.querySelectorAll('a[data-hash]').forEach(a => {
    const on = a.dataset.hash === currentHash;
    a.classList.toggle('is-current', on);
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
}

/* ============ rotas ============ */
window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });

function route(){
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  if(p.has('s')){
    const s = sessoes.find(x => String(x.id) === p.get('s'));
    if(s) return showSessao(s);
  } else if(p.has('t')){
    const t = tomoTree.byId.get(Number(p.get('t')));
    if(t) return showTomo(t);
  } else {
    return showHome();
  }
  showMissing();
}

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

function showHome(){
  const latest = sessoes.filter(s => s.published).slice(-1)[0];
  if(!latest){
    paint(`<p class="muted">Ainda não há nenhum episódio publicado.${loggedIn ? ' Use “Nova entrada” para escrever o primeiro.' : ''}</p>`);
    setPager(null, null);
    syncTree('', []);
    return;
  }
  showSessao(latest, true);
}

function showSessao(s, isHome){
  const c = (s.campaign || '').trim() || NO_CAMPAIGN;
  const a = (s.arc || '').trim() || NO_ARC;
  const crumbs = [c, a, s.session != null ? `Sessão ${s.session}` : ''];
  paint(
    `${isHome ? '<p class="post__kicker">Último episódio</p>' : ''}${renderPostHtml(s, 'sessao', crumbs)}${editLink('sessao', s.id)}`,
    s.title
  );

  const flat = groups.flatMap(g => g.arcs.flatMap(x => x.items)).filter(x => x.published || loggedIn);
  const i = flat.findIndex(x => x.id === s.id);
  const mk = x => x && { href: `#s=${x.id}`, label: sessionLabel(x) };
  setPager(mk(flat[i - 1]), mk(flat[i + 1]));

  syncTree(`#s=${s.id}`, ['r:campanhas', `c:${c}`, `a:${c}|${a}`]);
}

function showTomo(t){
  const path = tomoTree.pathOf(t.id);
  const crumbs = path.slice(0, -1).map(n => n.title);
  const kids = tomoTree.childrenOf(t.id);
  const empty = kids.length ? '' : '<p class="muted">Em breve.</p>';
  let html = renderPostHtml(t, 'tomo', crumbs, empty);
  if(kids.length){
    html += `<section class="children"><h2>Neste tomo</h2><ul>${
      kids.map(k => `<li><a href="#t=${k.id}">${escapeHtml(k.title)}</a>${badge(k.published)}${k.summary ? `<span class="children__sum">${escapeHtml(k.summary)}</span>` : ''}</li>`).join('')
    }</ul></section>`;
  }
  paint(html + editLink('tomo', t.id), t.title);

  const sibs = tomoTree.childrenOf(t.parent_id ?? null);
  const i = sibs.findIndex(x => x.id === t.id);
  const mk = x => x && { href: `#t=${x.id}`, label: x.title };
  setPager(mk(sibs[i - 1]), mk(sibs[i + 1]));

  syncTree(`#t=${t.id}`, ['r:tomos', ...path.slice(0, -1).map(n => `t:${n.id}`)]);
}

function showMissing(){
  paint('<p class="muted">Não encontrei essa página. Ela pode ter sido movida ou ainda ser um rascunho.</p>');
  setPager(null, null);
  syncTree('', []);
}

/* ============ início ============ */
(async function boot(){
  await refreshAuth();
  await loadAndRender();
})();
