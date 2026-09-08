/* Monta a leitura pública (index.html): busca as entradas no Supabase
   (via fetchStories, de render.js) e desenha o índice + a página. */

let allEntries = [];
let activeId = null;

const pageEl = document.getElementById('page');
const spineIndexEl = document.getElementById('spineIndex');

/* A página inicial sempre mostra a Campanha mais recente. Tomos de
   Kauntar só aparecem quando alguém clica neles no índice. */
const CATEGORY_ORDER = ['campanha', 'tomo'];
const CATEGORY_LABELS = { campanha: 'Campanhas', tomo: 'Tomos de Kauntar' };

async function init(){
  try{
    const { site, entries } = await fetchStories();
    document.getElementById('siteWord').textContent = site.title;
    document.getElementById('siteSub').textContent = site.subtitle;
    allEntries = entries;
    renderSpine();

    if(!allEntries.length){
      pageEl.innerHTML = '<p class="empty-state">Ainda não há nenhuma entrada na crônica.</p>';
      return;
    }

    activeId = entryIdFromHash() || pickDefaultId();
    renderPage(activeId);
  }catch(err){
    pageEl.innerHTML = `<p class="empty-state">Não consegui carregar a crônica: ${escapeHtml(err.message)}</p>`;
  }
}

function pickDefaultId(){
  const campanhas = allEntries.filter(e => e.type === 'campanha');
  if(campanhas.length) return campanhas[campanhas.length - 1].id; // mais recente (fetchStories já vem por data crescente)
  return allEntries[allEntries.length - 1].id;
}

function entryIdFromHash(){
  const id = location.hash.replace(/^#/, '');
  return allEntries.some(e => String(e.id) === id) ? id : null;
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

function itemButtonHtml(e){
  return `
    <button class="spine__item" data-id="${e.id}" data-type="${e.type}" aria-current="${String(e.id) === String(activeId)}">
      <span class="spine__icon">${TYPE_ICONS[e.type] || ''}</span>${escapeHtml(e.title)}
    </button>
  `;
}

function renderSpine(){
  let html = '';
  for(const type of CATEGORY_ORDER){
    const items = allEntries.filter(e => e.type === type);
    html += `<p class="spine__category" data-type="${type}">${CATEGORY_LABELS[type]}</p>`;
    if(!items.length){
      html += '<p class="spine__empty">nada por aqui ainda</p>';
      continue;
    }
    if(type === 'campanha'){
      const groups = groupByArc(items);
      for(const [arc, arcItems] of groups){
        html += `<p class="spine__arc">${escapeHtml(arc)}</p><div class="spine__list">` +
          arcItems.map(itemButtonHtml).join('') + '</div>';
      }
    } else {
      const sorted = items.slice().sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
      html += '<div class="spine__list">' + sorted.map(itemButtonHtml).join('') + '</div>';
    }
  }
  spineIndexEl.innerHTML = html;
  spineIndexEl.querySelectorAll('.spine__item').forEach(btn => {
    btn.addEventListener('click', () => {
      activeId = btn.dataset.id;
      history.replaceState(null, '', '#' + activeId);
      renderSpine();
      renderPage(activeId);
      closeSpineOnMobile();
      pageEl.scrollIntoView({ behavior:'smooth', block:'start' });
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
  const id = entryIdFromHash();
  if(id){
    activeId = id;
    renderSpine();
    renderPage(id);
  }
});

init();
