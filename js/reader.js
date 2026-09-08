/* Monta a leitura pública (index.html): busca as entradas no Supabase
   (via fetchStories, de render.js) e desenha o índice + a página. */

let allEntries = [];
let activeId = null;

const pageEl = document.getElementById('page');
const spineIndexEl = document.getElementById('spineIndex');

async function init(){
  try{
    const { site, entries } = await fetchStories();
    document.getElementById('siteWord').textContent = site.title;
    document.getElementById('siteSub').textContent = site.subtitle;
    allEntries = entries;

    if(!allEntries.length){
      pageEl.innerHTML = '<p class="empty-state">Ainda não há nenhuma entrada na crônica.</p>';
      return;
    }

    activeId = entryIdFromHash() || allEntries[allEntries.length - 1].id;
    renderSpine();
    renderPage(activeId);
  }catch(err){
    pageEl.innerHTML = `<p class="empty-state">Não consegui carregar a crônica: ${escapeHtml(err.message)}</p>`;
  }
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

function renderSpine(){
  const groups = groupByArc(allEntries);
  let html = '';
  for(const [arc, items] of groups){
    html += `<p class="spine__arc">${escapeHtml(arc)}</p><div class="spine__list">`;
    html += items.map(e => `
      <button class="spine__item" data-id="${e.id}" data-type="${e.type}" aria-current="${String(e.id) === String(activeId)}">
        <span class="spine__icon">${TYPE_ICONS[e.type] || ''}</span>${escapeHtml(e.title)}
      </button>
    `).join('');
    html += '</div>';
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
