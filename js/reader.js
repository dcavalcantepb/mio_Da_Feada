/* Monta as páginas de leitura: index.html (home), campanhas.html e
   tomos.html. Todas buscam as entradas no Supabase (fetchStories, de
   render.js) e desenham a parte que cabe ao escopo da página atual,
   identificado por <body data-scope="home|campanhas|tomos">.

   campanhas.html e tomos.html têm dois modos:
   - "navegar": a barra lateral mostra a lista pra escolher o que ler
     (Campanha > Arco em campanhas.html; lista simples em tomos.html).
   - "ler": a barra lateral some por completo, a página fica cheia com
     o texto — em campanhas.html isso é a leitura sequencial de todas
     as entradas do arco escolhido, da mais antiga pra mais nova. */

const SCOPE = document.body.dataset.scope;

let allEntries = [];

const pageEl = document.getElementById('page');
const spineIndexEl = document.getElementById('spineIndex'); // não existe em index.html
const chronicleEl = document.querySelector('.chronicle');

async function init(){
  markActiveCategoryLink();
  checkEditorAccess();
  try{
    const { site, entries } = await fetchStories();
    document.getElementById('siteWord').textContent = site.title;
    document.getElementById('siteSub').textContent = site.subtitle;
    allEntries = entries;

    if(SCOPE === 'home') return initHome();
    if(SCOPE === 'campanhas') return renderCampanhasView();
    if(SCOPE === 'tomos') return renderTomosView();
  }catch(err){
    pageEl.innerHTML = `<p class="empty-state">Não consegui carregar: ${escapeHtml(err.message)}</p>`;
  }
}

/* ---------- home: só a Campanha mais recente ---------- */
function initHome(){
  const campanhas = allEntries.filter(e => e.type === 'campanha');
  if(!campanhas.length){
    pageEl.innerHTML = '<p class="empty-state">Ainda não há nenhuma Campanha publicada.</p>';
    return;
  }
  renderSingleEntry(campanhas[campanhas.length - 1]);
}

function groupByArc(entries){
  const groups = new Map();
  for(const e of entries){
    const key = (e.arc || '').trim() || 'Sem arco';
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return groups;
}

function groupByCampaign(entries){
  const groups = new Map();
  for(const e of entries){
    const key = (e.campaign || '').trim() || 'Sem campanha';
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return groups;
}

/* ---------- campanhas.html ---------- */
function readHashParams(){
  return new URLSearchParams(location.hash.replace(/^#/, ''));
}

function renderCampanhasView(){
  const campanhas = allEntries.filter(e => e.type === 'campanha');
  const params = readHashParams();
  const campaign = params.get('c');
  const arc = params.get('a');

  if(campaign && arc){
    const entries = campanhas.filter(e =>
      ((e.campaign || '').trim() || 'Sem campanha') === campaign &&
      ((e.arc || '').trim() || 'Sem arco') === arc
    );
    if(entries.length){
      enterReadingMode();
      renderSequentialReading(entries, campaign + ' · ' + arc);
      return;
    }
  }

  exitReadingMode();
  if(!campanhas.length){
    spineIndexEl.innerHTML = '<p class="spine__empty">nada por aqui ainda</p>';
    pageEl.innerHTML = '<p class="empty-state">Ainda não há nenhuma Campanha publicada.</p>';
    return;
  }
  spineIndexEl.innerHTML = renderCampaignTree(campanhas);
  pageEl.innerHTML = '<p class="empty-state">Escolha uma campanha e um arco, ao lado, pra começar a leitura.</p>';
  wireCampaignTree();
}

function renderCampaignTree(items){
  let html = '';
  for(const [campaign, campItems] of groupByCampaign(items)){
    const arcs = groupByArc(campItems);
    html += `<details class="tree-node tree-node--campaign">
      <summary class="tree-node__label">${escapeHtml(campaign)}</summary>
      <div class="tree-node__children">${
        [...arcs.keys()].map(arc => `
          <button class="spine__item" data-c="${escapeHtml(campaign)}" data-a="${escapeHtml(arc)}">${escapeHtml(arc)}</button>
        `).join('')
      }</div>
    </details>`;
  }
  return html;
}

function wireCampaignTree(){
  spineIndexEl.querySelectorAll('.spine__item').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = btn.dataset.c, a = btn.dataset.a;
      location.hash = `c=${encodeURIComponent(c)}&a=${encodeURIComponent(a)}`;
    });
  });
}

/* ---------- tomos.html ---------- */
function renderTomosView(){
  const tomos = allEntries.filter(e => e.type === 'tomo');
  const params = readHashParams();
  const id = params.get('id');

  if(id){
    const entry = tomos.find(e => String(e.id) === id);
    if(entry){
      enterReadingMode();
      renderSingleEntry(entry, true);
      return;
    }
  }

  exitReadingMode();
  if(!tomos.length){
    spineIndexEl.innerHTML = '<p class="spine__empty">nada por aqui ainda</p>';
    pageEl.innerHTML = '<p class="empty-state">Ainda não há nenhum Tomo publicado.</p>';
    return;
  }
  const sorted = tomos.slice().sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  spineIndexEl.innerHTML = `<div class="spine__list">${
    sorted.map(e => `<button class="spine__item" data-id="${e.id}">${escapeHtml(e.title)}</button>`).join('')
  }</div>`;
  pageEl.innerHTML = '<p class="empty-state">Escolha um tomo, ao lado, pra ler.</p>';
  spineIndexEl.querySelectorAll('.spine__item').forEach(btn => {
    btn.addEventListener('click', () => { location.hash = `id=${encodeURIComponent(btn.dataset.id)}`; });
  });
}

/* ---------- modo de leitura: some com a lombada, a página fica cheia ---------- */
function enterReadingMode(){ chronicleEl.classList.add('is-reading'); }
function exitReadingMode(){ chronicleEl.classList.remove('is-reading'); }

function entryHtml(entry){
  return `
    <p class="page__eyebrow" data-type="${entry.type}">
      ${TYPE_ICONS[entry.type] || ''}
      <span>${TYPE_LABELS[entry.type] || entry.type}</span>
      ${entry.date ? `<span class="dot">·</span><span>${formatDate(entry.date)}</span>` : ''}
      ${entry.session ? `<span class="dot">·</span><span>Sessão ${entry.session}</span>` : ''}
    </p>
    <h1>${escapeHtml(entry.title)}</h1>
    ${entry.summary ? `<p class="page__summary">${escapeHtml(entry.summary)}</p>` : ''}
    ${entry.tags && entry.tags.length ? `<div class="page__tags">${entry.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    <div class="page__body">${renderMarkdownLite(entry.content)}</div>
  `;
}

function renderSingleEntry(entry, withBackLink){
  const back = withBackLink ? backLinkHtml() : '';
  pageEl.innerHTML = back + entryHtml(entry);
}

function renderSequentialReading(entries, label){
  const back = backLinkHtml();
  const body = entries.map((e, i) => `
    ${i > 0 ? '<hr class="entry-divider">' : ''}
    <div class="entry-block">${entryHtml(e)}</div>
  `).join('');
  pageEl.innerHTML = back + body;
}

function backLinkHtml(){
  const href = SCOPE === 'campanhas' ? 'campanhas.html' : 'tomos.html';
  const label = SCOPE === 'campanhas' ? 'Campanhas' : 'Tomos de Kauntar';
  return `<a class="page__back" href="${href}">← ${label}</a>`;
}

/* ---------- destaca em qual página (Campanhas/Tomos) você está ---------- */
function markActiveCategoryLink(){
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.spine__category-link').forEach(a => {
    a.setAttribute('aria-current', a.getAttribute('href') === here ? 'page' : 'false');
  });
}

/* ---------- "+ Nova entrada" só aparece pra quem já está logado ---------- */
async function checkEditorAccess(){
  try{
    const { data } = await supabaseClient.auth.getSession();
    if(data?.session) document.getElementById('btnNewEntry')?.removeAttribute('hidden');
  }catch{ /* sem sessão, botão continua escondido */ }
}

/* ---------- índice em telas pequenas ---------- */
const spineToggle = document.getElementById('spineToggle');
const spineEl = document.getElementById('spine');
spineToggle?.addEventListener('click', () => {
  const open = spineEl.classList.toggle('spine--open');
  spineToggle.setAttribute('aria-expanded', String(open));
});

window.addEventListener('hashchange', () => {
  if(!allEntries.length) return;
  if(SCOPE === 'campanhas') renderCampanhasView();
  else if(SCOPE === 'tomos') renderTomosView();
});

init();
