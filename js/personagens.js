/* Personagens (personagens.html) — seção reservada; ainda sem conteúdo.
   Quando ganhar dados, segue o mesmo desenho de reader.js / tomos.js. */

async function reload(){
  try{
    await loadAll();   // o menu lateral é o mesmo em todas as páginas
  }catch(_){ /* sem menu completo, a página ainda mostra o "Em breve" */ }
  route();
}

function route(){
  paint('<h1 class="post__title">Personagens</h1><p class="muted">Em breve.</p>', 'Personagens');
  setPager(null, null);
  syncTree('personagens.html', []);
}

startPage({ reload, route });
