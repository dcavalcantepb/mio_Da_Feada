/* Leitura dos Personagens (personagens.html).

   Rotas por hash:
     (vazio)   galeria: cartões agrupados por Afiliação
     #p=<id>   a ficha de um personagem (foto + características + história)

   No menu lateral: Personagens > Afiliação > personagem (shell.js). */

async function reload(){
  try{
    await loadAll();
  }catch(err){
    els.post.innerHTML = `<p class="form-msg">Não consegui carregar os personagens: ${escapeHtml(err.message)}</p>`;
    return;
  }
  route();
}

function route(){
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  if(p.has('p')){
    const pers = personagens.find(x => String(x.id) === p.get('p'));
    return pers ? showPersonagem(pers) : showMissing();
  }
  showGaleria();
}

function cartao(p){
  const sub = [p.race, p.class].map(x => (x || '').trim()).filter(Boolean).join(' · ');
  return `<li><a class="cartao" href="#p=${p.id}">
    <span class="cartao__foto">${perfilFotoHtml(p)}</span>
    <span class="cartao__nome">${escapeHtml(p.name)}${badge(p.published)}</span>
    ${sub ? `<span class="cartao__sub">${escapeHtml(sub)}</span>` : ''}
  </a></li>`;
}

function showGaleria(){
  paint(
    `<h1 class="post__title">Personagens</h1>
     ${grupos.length
       ? grupos.map(g => `<section class="galeria"><h2>${escapeHtml(g.name)}</h2><ul class="galeria__grade">${g.items.map(cartao).join('')}</ul></section>`).join('')
       : `<p class="muted">Ainda não há nenhum personagem publicado.${loggedIn ? ' Use “Nova entrada” e escolha Personagem para cadastrar o primeiro.' : ''}</p>`}`,
    'Personagens'
  );
  setPager(null, null);
  syncTree('', ['r:personagens']);
}

function showPersonagem(p){
  paint(renderPerfilHtml(p) + editLink('personagem', p.id), p.name);

  /* anterior/próximo dentro da mesma afiliação */
  const aff = (p.affiliation || '').trim() || NO_AFFILIATION;
  const g = grupos.find(x => x.name === aff);
  const i = g.items.findIndex(x => x.id === p.id);
  const mk = x => x && { href: personagemHref(x.id), label: x.name };
  setPager(mk(g.items[i - 1]), mk(g.items[i + 1]));

  syncTree(personagemHref(p.id), ['r:personagens', `f:${aff}`]);
}

function showMissing(){
  paint('<p class="muted">Não encontrei essa página. Ela pode ter sido movida ou ainda ser um rascunho.</p>');
  setPager(null, null);
  syncTree('', ['r:personagens']);
}

startPage({ reload, route });
