/* Leitura das Campanhas (index.html) — só sessões; os tomos moram em tomos.html.

   Rotas por hash:
     (vazio)   o último episódio publicado
     #s=<id>   uma sessão

   O índice (barra lateral) vem de shell.js. Visitante vê só o que está
   publicado; logado vê também os rascunhos (quem decide isso é a RLS do
   banco, não este arquivo). */

async function reload(){
  try{
    await loadAll();
  }catch(err){
    els.post.innerHTML = `<p class="form-msg">Não consegui carregar a crônica: ${escapeHtml(err.message)}</p>`;
    return;
  }
  route();
}

function route(){
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  /* links antigos de tomo (index.html#t=…) seguem para a página própria */
  if(p.has('t')) return location.replace('tomos.html' + location.hash);
  if(p.has('s')){
    const s = sessoes.find(x => String(x.id) === p.get('s'));
    return s ? showSessao(s) : showMissing();
  }
  showHome();
}

function showHome(){
  const latest = sessoes.filter(s => s.published).slice(-1)[0];
  if(!latest){
    paint(`<p class="muted">Ainda não há nenhum episódio publicado.${loggedIn ? ' Use “Nova entrada” para escrever o primeiro.' : ''}</p>`);
    setPager(null, null);
    syncTree('', ['r:campanhas']);
    return;
  }
  showSessao(latest, true);
}

function showSessao(s, isHome){
  const c = (s.campaign || '').trim() || NO_CAMPAIGN;
  const a = (s.arc || '').trim() || NO_ARC;
  const crumbs = [c, a, s.session != null ? `Sessão ${s.session}` : ''];
  paint(
    renderPostHtml(s, 'sessao', crumbs, undefined, isHome ? 'Último Episódio - ' : '') + editLink('sessao', s.id),
    s.title
  );

  /* anterior/próximo só dentro da mesma campanha (arcos em ordem cronológica,
     sessões pelo número): a última sessão de uma campanha não tem "Próxima",
     em vez de saltar para outra campanha */
  const group = groups.find(g => g.name === c);
  const flat = group.arcs.flatMap(x => x.items).filter(x => x.published || loggedIn);
  const i = flat.findIndex(x => x.id === s.id);
  const mk = x => x && { href: sessionHref(x.id), label: sessionLabel(x) };
  setPager(mk(flat[i - 1]), mk(flat[i + 1]));

  syncTree(sessionHref(s.id), ['r:campanhas', `c:${c}`, `a:${c}|${a}`]);
}

function showMissing(){
  paint('<p class="muted">Não encontrei essa página. Ela pode ter sido movida ou ainda ser um rascunho.</p>');
  setPager(null, null);
  syncTree('', ['r:campanhas']);
}

startPage({ reload, route });
