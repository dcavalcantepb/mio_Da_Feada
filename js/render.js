/* Utilitários compartilhados entre a leitura e o editor.
   Sem dependências além do cliente do Supabase — roda direto no navegador. */

const SITE_INFO = {
  title: 'O Mio da Feada',
  subtitle: 'Sua Sessão de Escapismo Semanal.'
};

const NO_CAMPAIGN = 'Sem campanha';
const NO_ARC = 'Sem arco';
const NO_AFFILIATION = 'Sem afiliação';

/* ---------- texto ---------- */
function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

/* Markdown bem enxuto: parágrafos, **negrito**, *itálico*, ## subtítulo, listas "- item" */
function renderMarkdownLite(raw){
  const text = String(raw ?? '').replace(/\r\n/g, '\n').trim();
  if(!text) return '';
  const blocks = text.split(/\n\s*\n/);
  let html = '';
  for(const block of blocks){
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if(lines.length && lines.every(l => l.startsWith('- '))){
      html += '<ul>' + lines.map(l => `<li>${inline(l.slice(2))}</li>`).join('') + '</ul>';
    } else if(/^##\s+/.test(lines[0] || '')){
      html += `<h2>${inline(lines[0].replace(/^##\s+/, ''))}</h2>`;
      if(lines.length > 1) html += `<p>${lines.slice(1).map(inline).join('<br>')}</p>`;
    } else {
      html += `<p>${lines.map(inline).join('<br>')}</p>`;
    }
  }
  return html;

  function inline(s){
    let out = escapeHtml(s);
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
    return out;
  }
}

function formatDate(iso){
  if(!iso) return '';
  const [y,m,d] = String(iso).slice(0,10).split('-');
  if(!y || !m || !d) return iso;
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${d} ${meses[+m-1] || m} ${y}`;
}

/* 25/09/2026 */
function formatDateBR(iso){
  if(!iso) return '';
  const [y,m,d] = String(iso).slice(0,10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(iso);
}

function todayISO(){
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}

function parseTags(str){
  return String(str || '').split(',').map(t => t.trim()).filter(Boolean);
}

/* ---------- banco ---------- */
async function fetchSessoes(){
  const { data, error } = await supabaseClient
    .from('sessoes').select('*')
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });
  if(error) throw new Error(error.message);
  return data;
}

async function fetchTomos(){
  const { data, error } = await supabaseClient
    .from('tomos').select('*')
    .order('position', { ascending: true })
    .order('id', { ascending: true });
  if(error) throw new Error(error.message);
  return data;
}

async function fetchPersonagens(){
  const { data, error } = await supabaseClient
    .from('personagens').select('*')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if(error) throw new Error(error.message);
  return data;
}

/* ---------- Campanha > Arco > Sessões ---------- */
function sessionLabel(s){
  return s.session != null && s.session !== '' ? `${s.session} - ${s.title}` : s.title;
}

/* Agrupa em [{ name, arcs: [{ name, items }] }].
   Campanhas e arcos em ordem cronológica (pela data mais antiga);
   sessões pelo número, depois pela data. */
function groupSessoes(sessoes){
  const byCampaign = new Map();
  for(const s of sessoes){
    const c = (s.campaign || '').trim() || NO_CAMPAIGN;
    const a = (s.arc || '').trim() || NO_ARC;
    if(!byCampaign.has(c)) byCampaign.set(c, new Map());
    const arcs = byCampaign.get(c);
    if(!arcs.has(a)) arcs.set(a, []);
    arcs.get(a).push(s);
  }
  const firstDate = items => items.reduce((m, s) => (s.date < m ? s.date : m), items[0].date);
  const bySession = (x, y) =>
    (x.session ?? Infinity) - (y.session ?? Infinity) ||
    x.date.localeCompare(y.date) || String(x.created_at).localeCompare(String(y.created_at));

  return [...byCampaign.entries()].map(([name, arcs]) => ({
    name,
    arcs: [...arcs.entries()]
      .map(([arcName, items]) => ({ name: arcName, items: items.slice().sort(bySession) }))
      .sort((x, y) => firstDate(x.items).localeCompare(firstDate(y.items)))
  })).sort((x, y) =>
    firstDate(x.arcs.flatMap(a => a.items)).localeCompare(firstDate(y.arcs.flatMap(a => a.items))));
}

/* ---------- Tomos: árvore de profundidade livre ---------- */
/* Devolve { byId, childrenOf(id|null), roots, pathOf(id) }.
   Nós cujo pai não veio do banco (ex.: filho publicado de um rascunho,
   para o visitante) ficam de fora — só se chega neles a partir da raiz. */
function buildTomoTree(tomos){
  const byId = new Map(tomos.map(t => [t.id, t]));
  const kids = new Map();
  for(const t of tomos){
    const key = t.parent_id ?? null;
    if(!kids.has(key)) kids.set(key, []);
    kids.get(key).push(t);
  }
  const order = (a, b) => a.position - b.position || a.id - b.id;
  for(const list of kids.values()) list.sort(order);
  const childrenOf = id => kids.get(id ?? null) || [];
  const pathOf = id => {
    const path = [];
    let node = byId.get(id);
    const seen = new Set();
    while(node && !seen.has(node.id)){
      seen.add(node.id);
      path.unshift(node);
      node = node.parent_id != null ? byId.get(node.parent_id) : null;
    }
    return path;
  };
  return { byId, childrenOf, roots: childrenOf(null), pathOf };
}

/* ---------- a postagem (usada na leitura e na prévia do editor) ----------
   kind: 'sessao' | 'tomo'. crumbs: trilha de texto acima do título.
   emptyBody: HTML mostrado quando não há texto (padrão: "Ainda sem texto.").
   kickerPrefix: só para sessão — texto antes da data na linha do topo
   (ex.: "Último Episódio - ").

   Sessão:  [prefixo]25/09/2026
            Campanha - Arco - Sessão N
            TÍTULO · resumo · texto
   Tomo:    caminho · título · resumo · texto */
function renderPostHtml(e, kind, crumbs, emptyBody = '<p class="muted">Ainda sem texto.</p>', kickerPrefix = ''){
  const isSessao = kind === 'sessao';
  const kicker = isSessao && e.date ? `${kickerPrefix}${formatDateBR(e.date)}` : '';
  const eyebrow = (crumbs || []).filter(Boolean).map(escapeHtml).join(isSessao ? ' - ' : ' · ');
  const edited = e.created_at && e.updated_at && new Date(e.updated_at) - new Date(e.created_at) > 60000
    ? `editado em ${escapeHtml(formatDateBR(e.updated_at))}` : '';
  const tags = (e.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  return `
    ${kicker ? `<p class="post__kicker">${escapeHtml(kicker)}</p>` : ''}
    ${eyebrow ? `<p class="post__eyebrow">${eyebrow}</p>` : ''}
    <h1 class="post__title">${escapeHtml(e.title || 'Sem título')}${e.published === false ? ' <span class="badge">rascunho</span>' : ''}</h1>
    ${edited ? `<p class="post__meta">${edited}</p>` : ''}
    ${e.summary ? `<p class="post__lead">${escapeHtml(e.summary)}</p>` : ''}
    <div class="post__body">${renderMarkdownLite(e.content) || emptyBody}</div>
    ${tags ? `<p class="post__tags">${tags}</p>` : ''}`;
}

/* ---------- Personagens ---------- */
/* Agrupa pela Afiliação, na ordem em que os personagens foram cadastrados
   (o grupo aparece quando o primeiro membro foi criado; "Sem afiliação" por
   último). Devolve [{ name, items }]. */
function groupPersonagens(personagens){
  const byAff = new Map();
  for(const p of personagens){
    const a = (p.affiliation || '').trim() || NO_AFFILIATION;
    if(!byAff.has(a)) byAff.set(a, []);
    byAff.get(a).push(p);
  }
  return [...byAff.entries()]
    .map(([name, items]) => ({ name, items }))
    .sort((x, y) => (x.name === NO_AFFILIATION) - (y.name === NO_AFFILIATION));
}

const PERFIL_CAMPOS = [
  ['race', 'Raça'], ['age', 'Idade'], ['birthplace', 'Local de Nascimento'],
  ['class', 'Classe'], ['affiliation', 'Afiliação']
];

const SILHUETA = '<svg viewBox="0 0 64 80" fill="currentColor" aria-hidden="true"><circle cx="32" cy="26" r="13"/><path d="M6 80c0-19 11-30 26-30s26 11 26 30z"/></svg>';

/* Foto (ou silhueta, se não houver) — usada na ficha e nos cartões da galeria */
function perfilFotoHtml(p, src){
  const url = src !== undefined ? src : p.photo_url;
  return url
    ? `<img src="${escapeHtml(url)}" alt="Retrato de ${escapeHtml(p.name || 'personagem')}" loading="lazy">`
    : `<div class="perfil__vazio">${SILHUETA}</div>`;
}

/* A ficha em formato de currículo: foto à esquerda dividindo a largura com as
   características; a história embaixo, na largura toda. `src` sobrepõe a foto
   (prévia do editor, antes de enviar). */
function renderPerfilHtml(p, src){
  const itens = PERFIL_CAMPOS
    .filter(([k]) => String(p[k] ?? '').trim())
    .map(([k, label]) => `<div class="perfil__item"><dt>${label}</dt><dd>${escapeHtml(String(p[k]).trim())}</dd></div>`)
    .join('');
  const historia = renderMarkdownLite(p.story);
  return `
    <div class="perfil">
      <div class="perfil__topo">
        <figure class="perfil__foto">${perfilFotoHtml(p, src)}</figure>
        <div class="perfil__dados">
          <div class="perfil__cabeca">
            <h1 class="post__title">${escapeHtml(p.name || 'Sem nome')}${p.published === false ? ' <span class="badge">rascunho</span>' : ''}</h1>
            ${String(p.bio ?? '').trim() ? `<p class="perfil__bio">${escapeHtml(String(p.bio).trim())}</p>` : ''}
          </div>
          ${itens ? `<dl class="perfil__lista">${itens}</dl>` : '<p class="muted">Sem características preenchidas.</p>'}
        </div>
      </div>
      <section class="perfil__historia">
        <h2>História</h2>
        <div class="post__body">${historia || '<p class="muted">Ainda sem história.</p>'}</div>
      </section>
    </div>`;
}
