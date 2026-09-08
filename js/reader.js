/* Monta as páginas de leitura: index.html (home), campanhas.html e
   tomos.html. Todas buscam as entradas no Supabase (fetchStories, de
   render.js) e desenham a parte que cabe ao escopo da página atual,
   identificado por <body data-scope="home|campanhas|tomos">. */

const SCOPE = document.body.dataset.scope;

let allEntries = [];
let activeId = null;

const pageEl = document.getElementById('page');
const spineIndexEl = document.getElementById('spineIndex'); // não existe em index.html

async function init(){
  markActiveCategoryLink();
  checkEditorAccess();
  try{
    const { site, entries } = await fetchStories();
    document.getElementById('siteWord').textContent = site.title;
    document.getElementById('siteSub').textContent = site.subtitle;
    allEntries = entries;

    if(SCOPE === 'home') initHome();
    else if(SCOPE === 'campanhas') initList('campanha');
    else if(SCOPE === 'tomos') initList('tomo');
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
  renderPage(campanhas[campanhas.length - 1].id); // fetchStories já vem por data crescente
}

/* ---------- campanhas.html / tomos.html: índice + leitura ---------- */
function initList(type){
  const items = allEntries.filter(e => e.type === type);
  if(!items.length){
    if(spineIndexEl) spineIndexEl.innerHTML = '<p class="spine__empty">nada por aqui ainda</p>';
    pageEl.innerHTML = '<p class="empty-state">Ainda não há nenhuma entrada aqui.</p>';
    return;
  }
  activeId = entryIdFromHash(items) || items[items.length - 1].id;
  renderList(type, items);
  renderPage(activeId);
}

function entryIdFromHash(items){
  const id = location.hash.replace(/^#/, '');
  return items.some(e => String(e.id) === id) ? id : null;
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

function itemButtonHtml(e){
  return `
    <button class="spine__item" data-id="${e.id}" data-type="${e.type}" aria-current="${String(e.id) === String(activeId)}">
      <span class="spine__icon">${TYPE_ICONS[e.type] || ''}</span>${escapeHtml(e.title)}
    </button>
  `;
}

/* Campanhas viram uma árvore de diretórios (Campanha > Arco > entradas);
   Tomos ficam numa lista simples, ordenada por título. */
function renderList(type, items){
  if(!spineIndexEl) return;
  spineIndexEl.innerHTML = type === 'campanha'
    ? renderCampaignTree(items)
    : `<div class="spine__list">${items.slice().sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')).map(itemButtonHtml).join('')}</div>`;
  wireItemClicks();
}

function renderCampaignTree(items){
  let html = '';
  for(const [campaign, campItems] of groupByCampaign(items)){
    html += `<details class="tree-node tree-node--campaign" open>
      <summary class="tree-node__label">${escapeHtml(campaign)}</summary>
      <div class="tree-node__children">${renderArcGroups(campItems)}</div>
    </details>`;
  }
  return html;
}

function renderArcGroups(items){
  let html = '';
  for(const [arc, arcItems] of groupByArc(items)){
    const containsActive = arcItems.some(e => String(e.id) === String(activeId));
    html += `<details class="tree-node tree-node--arc"${containsActive ? ' open' : ''}>
      <summary class="tree-node__label">${escapeHtml(arc)}</summary>
      <div class="spine__list">${arcItems.map(itemButtonHtml).join('')}</div>
    </details>`;
  }
  return html;
}

function wireItemClicks(){
  spineIndexEl.querySelectorAll('.spine__item').forEach(btn => {
    btn.addEventListener('click', () => {
      activeId = btn.dataset.id;
      history.replaceState(null, '', '#' + activeId);
      spineIndexEl.querySelectorAll('.spine__item[aria-current="true"]').forEach(x => x.setAttribute('aria-current', 'false'));
      btn.setAttribute('aria-current', 'true');
      renderPage(activeId);
      closeSpineOnMobile();
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function renderPage(id){
  const entry = allEntries.find(e => String(e.id) === String(id));
  if(!entry) return;
  pageEl.innerHTML = `
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
function closeSpineOnMobile(){
  if(window.matchMedia('(max-width: 760px)').matches){
    spineEl.classList.remove('spine--open');
    spineToggle?.setAttribute('aria-expanded', 'false');
  }
}

window.addEventListener('hashchange', () => {
  if(SCOPE === 'home' || !allEntries.length) return;
  const type = SCOPE === 'campanhas' ? 'campanha' : 'tomo';
  const items = allEntries.filter(e => e.type === type);
  const id = entryIdFromHash(items);
  if(id){
    activeId = id;
    renderPage(id);
    spineIndexEl?.querySelectorAll('.spine__item').forEach(b => b.setAttribute('aria-current', String(b.dataset.id === id)));
  }
});

init();
