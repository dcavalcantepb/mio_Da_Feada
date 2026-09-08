/* Monta as páginas de leitura: index.html (home), campanhas.html e
   tomos.html. Todas buscam as entradas no Supabase (fetchStories, de
   render.js) e desenham a parte que cabe ao escopo da página atual,
   identificado por <body data-scope="home|campanhas|tomos">.

   campanhas.html e tomos.html têm dois modos:
   - "navegar": a barra lateral mostra a árvore Campanha > (Arco ou
     Tomo) pra escolher o que ler.
   - "ler": a barra lateral some por completo, a página fica cheia com
     o texto — em campanhas.html isso é a leitura sequencial de todas
     as entradas do arco escolhido, da mais antiga pra mais nova.
   Uma trilha (Campanhas/Tomos > Campanha > Arco) no topo e links de
   anterior/próximo no fim substituem o antigo link único de "voltar",
   pra facilitar pular entre arcos/tomos sem sair da leitura. */

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

function readHashParams(){
  return new URLSearchParams(location.hash.replace(/^#/, ''));
}

/* ---------- campanhas.html ---------- */
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
      const arcsInCampaign = [...groupByArc(
        campanhas.filter(e => ((e.campaign || '').trim() || 'Sem campanha') === campaign)
      ).keys()];
      const idx = arcsInCampaign.indexOf(arc);
      const prev = idx > 0
        ? { href: `#c=${encodeURIComponent(campaign)}&a=${encodeURIComponent(arcsInCampaign[idx - 1])}`, label: arcsInCampaign[idx - 1] }
        : null;
      const next = idx < arcsInCampaign.length - 1
        ? { href: `#c=${encodeURIComponent(campaign)}&a=${encodeURIComponent(arcsInCampaign[idx + 1])}`, label: arcsInCampaign[idx + 1] }
        : null;
      renderSequentialReading(entries, {
        crumbs: [
          { label: 'Campanhas', href: 'campanhas.html' },
          { label: campaign, href: `campanhas.html#c=${encodeURIComponent(campaign)}` },
          { label: arc }
        ],
        prev, next
      });
      return;
    }
  }

  exitReadingMode();
  if(!campanhas.length){
    spineIndexEl.innerHTML = '<p class="spine__empty">nada por aqui ainda</p>';
    pageEl.innerHTML = '<p class="empty-state">Ainda não há nenhuma Campanha publicada.</p>';
    return;
  }
  spineIndexEl.innerHTML = renderCampaignTree(campanhas, campaign);
  pageEl.innerHTML = '<p class="empty-state">Escolha uma campanha e um arco, ao lado, pra começar a leitura.</p>';
  wireCampaignTree();
}

function renderCampaignTree(items, openCampaign){
  let html = '';
  for(const [campaign, campItems] of groupByCampaign(items)){
    const arcs = groupByArc(campItems);
    const isOpen = openCampaign && campaign === openCampaign;
    html += `<details class="tree-node tree-node--campaign"${isOpen ? ' open' : ''}>
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

/* ---------- tomos.html: também agrupados por Campanha ---------- */
function renderTomosView(){
  const tomos = allEntries.filter(e => e.type === 'tomo');
  const params = readHashParams();
  const id = params.get('id');
  const openCampaign = params.get('c');

  if(id){
    const entry = tomos.find(e => String(e.id) === id);
    if(entry){
      enterReadingMode();
      const campaign = (entry.campaign || '').trim() || 'Sem campanha';
      const group = tomos
        .filter(e => ((e.campaign || '').trim() || 'Sem campanha') === campaign)
        .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
      const idx = group.findIndex(e => String(e.id) === id);
      const prev = idx > 0
        ? { href: `#id=${encodeURIComponent(group[idx - 1].id)}`, label: group[idx - 1].title }
        : null;
      const next = idx < group.length - 1
        ? { href: `#id=${encodeURIComponent(group[idx + 1].id)}`, label: group[idx + 1].title }
        : null;
      renderSingleEntry(entry, {
        crumbs: [
          { label: 'Tomos de Kauntar', href: 'tomos.html' },
          { label: campaign, href: `tomos.html#c=${encodeURIComponent(campaign)}` },
          { label: entry.title }
        ],
        prev, next
      });
      return;
    }
  }

  exitReadingMode();
  if(!tomos.length){
    spineIndexEl.innerHTML = '<p class="spine__empty">nada por aqui ainda</p>';
    pageEl.innerHTML = '<p class="empty-state">Ainda não há nenhum Tomo publicado.</p>';
    return;
  }
  spineIndexEl.innerHTML = renderTomoTree(tomos, openCampaign);
  pageEl.innerHTML = '<p class="empty-state">Escolha uma campanha e um tomo, ao lado, pra ler.</p>';
  wireTomoTree();
}

function renderTomoTree(items, openCampaign){
  let html = '';
  for(const [campaign, campItems] of groupByCampaign(items)){
    const sorted = campItems.slice().sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    const isOpen = openCampaign && campaign === openCampaign;
    html += `<details class="tree-node tree-node--campaign"${isOpen ? ' open' : ''}>
      <summary class="tree-node__label">${escapeHtml(campaign)}</summary>
      <div class="tree-node__children">${
        sorted.map(e => `<button class="spine__item" data-id="${e.id}">${escapeHtml(e.title)}</button>`).join('')
      }</div>
    </details>`;
  }
  return html;
}

function wireTomoTree(){
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
      <a class="entry-edit-link" href="editor.html#edit=${encodeURIComponent(entry.id)}" hidden>✎ editar</a>
    </p>
    <h1>${escapeHtml(entry.title)}</h1>
    ${entry.summary ? `<p class="page__summary">${escapeHtml(entry.summary)}</p>` : ''}
    ${entry.tags && entry.tags.length ? `<div class="page__tags">${entry.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    <div class="page__body">${renderMarkdownLite(entry.content)}</div>
  `;
}

/* troca o conteúdo de #page com um fade curto, pra não ficar seco
   trocando de entrada — some em prefers-reduced-motion */
function fadeSwap(fn){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){ fn(); return; }
  pageEl.style.opacity = '0';
  window.setTimeout(() => {
    fn();
    pageEl.style.opacity = '1';
  }, 130);
}

function renderSingleEntry(entry, nav){
  const top = nav ? crumbsHtml(nav.crumbs) : '';
  const bottom = nav ? pageNavHtml(nav.prev, nav.next) : '';
  fadeSwap(() => {
    pageEl.innerHTML = top + entryHtml(entry) + bottom;
    revealEditLinks();
  });
}

function renderSequentialReading(entries, nav){
  const top = crumbsHtml(nav.crumbs);
  const bottom = pageNavHtml(nav.prev, nav.next);
  const body = entries.map((e, i) => `
    ${i > 0 ? '<hr class="entry-divider">' : ''}
    <div class="entry-block">${entryHtml(e)}</div>
  `).join('');
  fadeSwap(() => {
    pageEl.innerHTML = top + body + bottom;
    revealEditLinks();
  });
}

/* trilha "Campanhas > Nome da campanha > Arco" (ou equivalente em Tomos) */
function crumbsHtml(parts){
  return `<nav class="crumbs" aria-label="Você está em">${
    parts.map((p, i) => i < parts.length - 1
      ? `<a href="${p.href}">${escapeHtml(p.label)}</a><span class="crumbs__sep" aria-hidden="true">›</span>`
      : `<span class="crumbs__here">${escapeHtml(p.label)}</span>`
    ).join('')
  }</nav>`;
}

/* links de anterior/próximo ao fim da leitura, pra pular pro arco ou
   tomo seguinte sem voltar pro menu */
function pageNavHtml(prev, next){
  if(!prev && !next) return '';
  return `<nav class="page-nav" aria-label="Navegar">
    ${prev ? `<a class="page-nav__link page-nav__link--prev" href="${prev.href}"><span class="page-nav__dir">← Anterior</span><span class="page-nav__label">${escapeHtml(prev.label)}</span></a>` : '<span></span>'}
    ${next ? `<a class="page-nav__link page-nav__link--next" href="${next.href}"><span class="page-nav__dir">Próximo →</span><span class="page-nav__label">${escapeHtml(next.label)}</span></a>` : '<span></span>'}
  </nav>`;
}

/* ---------- destaca em qual página (Campanhas/Tomos) você está ---------- */
function markActiveCategoryLink(){
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.spine__category-link').forEach(a => {
    a.setAttribute('aria-current', a.getAttribute('href') === here ? 'page' : 'false');
  });
}

/* ---------- "+ Nova entrada" e "editar" só aparecem pra quem já está logado ---------- */
let isAuthed = false;
async function checkEditorAccess(){
  try{
    const { data } = await supabaseClient.auth.getSession();
    isAuthed = !!data?.session;
  }catch{ isAuthed = false; }
  if(isAuthed) document.getElementById('btnNewEntry')?.removeAttribute('hidden');
  revealEditLinks();
}

function revealEditLinks(){
  if(!isAuthed) return;
  document.querySelectorAll('.entry-edit-link[hidden]').forEach(a => a.removeAttribute('hidden'));
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
