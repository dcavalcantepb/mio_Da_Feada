/* Leitura dos Tomos do Storyteller (tomos.html) — a lore de Netéria.

   Rotas por hash:
     (vazio)   a entrada da seção: lista dos tomos de nível mais alto
     #t=<id>   um tomo (nó da árvore)

   O índice (barra lateral) vem de shell.js. Um tomo pode ter texto,
   filhos ou os dois. */

async function reload(){
  try{
    await loadAll();
  }catch(err){
    els.post.innerHTML = `<p class="form-msg">Não consegui carregar os tomos: ${escapeHtml(err.message)}</p>`;
    return;
  }
  route();
}

function route(){
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  if(p.has('t')){
    const t = tomoTree.byId.get(Number(p.get('t')));
    return t ? showTomo(t) : showMissing();
  }
  showIndex();
}

function childList(kids, heading){
  return `<section class="children"><h2>${escapeHtml(heading)}</h2><ul>${
    kids.map(k => `<li><a href="#t=${k.id}">${escapeHtml(k.title)}</a>${badge(k.published)}${k.summary ? `<span class="children__sum">${escapeHtml(k.summary)}</span>` : ''}</li>`).join('')
  }</ul></section>`;
}

function showIndex(){
  const roots = tomoTree.roots;
  paint(
    `<h1 class="post__title">Tomos do Storyteller</h1>
     ${roots.length
       ? childList(roots, 'Tomos')
       : `<p class="muted">Ainda não há nenhum tomo publicado.${loggedIn ? ' Use “Nova entrada” e escolha Lore para escrever o primeiro.' : ''}</p>`}`,
    'Tomos do Storyteller'
  );
  setPager(null, null);
  syncTree('', ['r:tomos']);
}

function showTomo(t){
  const path = tomoTree.pathOf(t.id);
  const crumbs = path.slice(0, -1).map(n => n.title);
  const kids = tomoTree.childrenOf(t.id);
  const empty = kids.length ? '' : '<p class="muted">Em breve.</p>';
  let html = renderPostHtml(t, 'tomo', crumbs, empty);
  if(kids.length) html += childList(kids, 'Neste tomo');
  paint(html + editLink('tomo', t.id), t.title);

  const sibs = tomoTree.childrenOf(t.parent_id ?? null);
  const i = sibs.findIndex(x => x.id === t.id);
  const mk = x => x && { href: `#t=${x.id}`, label: x.title };
  setPager(mk(sibs[i - 1]), mk(sibs[i + 1]));

  syncTree(tomoHref(t.id), ['r:tomos', ...path.slice(0, -1).map(n => `t:${n.id}`)]);
}

function showMissing(){
  paint('<p class="muted">Não encontrei essa página. Ela pode ter sido movida ou ainda ser um rascunho.</p>');
  setPager(null, null);
  syncTree('', ['r:tomos']);
}

startPage({ reload, route });
