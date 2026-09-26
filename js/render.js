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

/* Cores de texto disponíveis (nomes usados na marca [cor=nome]…[/cor]).
   Cada uma tem um tom para o tema claro e outro para o escuro (style.css). */
const TEXT_COLORS = [
  ['ouro', 'Ouro'], ['brasa', 'Brasa'], ['rubi', 'Rubi'], ['rosa', 'Rosa'],
  ['violeta', 'Violeta'], ['ceu', 'Céu'], ['turquesa', 'Turquesa'], ['verde', 'Verde']
];
const TEXT_COLOR_NAMES = new Set(TEXT_COLORS.map(c => c[0]));

/* ---------- menções: [[Nome]] e [[Nome|texto exibido]] ----------
   Viram link para o personagem, tomo ou sessão de mesmo nome (sem diferenciar
   maiúsculas nem acentos). Se houver nomes repetidos, vale a ordem
   personagem > tomo > sessão. Sem correspondência, o leitor vê só o texto; no
   editor (MENTION_WARN) a menção sem página aparece marcada. O índice é
   montado pelas páginas depois de carregar os dados (setMentionIndex). */
const MENTION_RE = /\[\[([^\[\]|\n]+?)(?:\|([^\[\]\n]+?))?\]\]/g;
const MENTION_KINDS = { personagem: 'Personagem', tomo: 'Tomo', sessao: 'Sessão' };
const mentionKey = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
let MENTION_INDEX = new Map();
let MENTION_LIST = [];        // {kind, name, href}, para as sugestões do editor
let MENTION_WARN = false;

function setMentionIndex({ sessoes = [], tomos = [], personagens = [] }){
  const map = new Map(), list = [];
  const add = (kind, name, href) => {
    const k = mentionKey(name || '');
    if(!k) return;
    list.push({ kind, name, href });
    if(!map.has(k)) map.set(k, { kind, name, href });
  };
  personagens.forEach(p => add('personagem', p.name, `personagens.html#p=${p.id}`));
  tomos.forEach(t => add('tomo', t.title, `tomos.html#t=${t.id}`));
  sessoes.forEach(x => add('sessao', x.title, `index.html#s=${x.id}`));
  MENTION_INDEX = map;
  MENTION_LIST = list;
}

function mentionHtml(target, label){
  const text = escapeHtml((label || target).trim());
  const hit = MENTION_INDEX.get(mentionKey(target));
  if(hit){
    return `<a class="mencao mencao--${hit.kind}" href="${hit.href}" title="${MENTION_KINDS[hit.kind]}: ${escapeHtml(hit.name)}">${text}</a>`;
  }
  return MENTION_WARN
    ? `<span class="mencao mencao--x" title="Não achei &quot;${escapeHtml(target.trim())}&quot;: confira o nome">${text}</span>`
    : text;
}

/* Formatação do texto das entradas. As marcas ficam legíveis no que se digita:
     # Título 1   ## Título 2   ### Título 3
     **negrito**  *itálico*  __sublinhado__  ~~riscado~~  ==marca-texto==
     [cor=ouro]texto[/cor]   ||spoiler||   [texto](https://link)   [[Nome]]
     - marcador   1. numerada   > citação   ---  (divisor)
   Linha em branco separa parágrafos. Tudo passa por escapeHtml antes de virar
   HTML, então só as marcas acima produzem tags. */
function renderMarkdownLite(raw){
  const lines = String(raw ?? '').replace(/\r\n/g, '\n').trim().split('\n');
  if(lines.length === 1 && !lines[0]) return '';

  const out = [];
  let para = [], list = null, quote = [];
  const flush = () => {
    if(para.length){ out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; }
    if(list){ out.push(`<${list.tag}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; }
    if(quote.length){ out.push(`<blockquote><p>${quote.map(inline).join('<br>')}</p></blockquote>`); quote = []; }
  };

  for(const rawLine of lines){
    const line = rawLine.trim();
    let m;
    if(!line){ flush(); }
    else if(/^-{3,}$/.test(line)){ flush(); out.push('<div class="md-hr" role="separator"><span>✦</span></div>'); }
    else if((m = line.match(/^(#{1,3})\s+(.+)$/))){
      flush();
      const n = m[1].length;   // # → h2, ## → h3, ### → h4 (o título da página já é o h1)
      out.push(`<h${n + 1} class="md-h${n}">${inline(m[2])}</h${n + 1}>`);
    }
    else if((m = line.match(/^>\s?(.*)$/))){
      if(para.length || list) flush();
      quote.push(m[1]);
    }
    else if((m = line.match(/^(?:-|\*)\s+(.+)$/)) && !/^\*\*/.test(line)){
      if(para.length || quote.length || (list && list.tag !== 'ul')) flush();
      (list = list || { tag: 'ul', items: [] }).items.push(m[1]);
    }
    else if((m = line.match(/^\d+[.)]\s+(.+)$/))){
      if(para.length || quote.length || (list && list.tag !== 'ol')) flush();
      (list = list || { tag: 'ol', items: [] }).items.push(m[1]);
    }
    else {
      if(list || quote.length) flush();
      para.push(line);
    }
  }
  flush();
  return out.join('');

  /* Marcas dentro da linha. Os links saem antes (viram marcadores) para que
     _ e * dentro do endereço não sejam lidos como formatação. */
  function inline(s){
    const links = [];
    let t = String(s).replace(MENTION_RE, (_, target, label) => {
      links.push(mentionHtml(target, label));
      return `\u0000${links.length - 1}\u0000`;
    });
    t = escapeHtml(t).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
      links.push(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
      return `\u0000${links.length - 1}\u0000`;
    });
    t = t.replace(/\|\|(.+?)\|\|/g, '<span class="spoiler" role="button" tabindex="0" aria-pressed="false" title="Spoiler: clique para revelar">$1</span>');
    t = t.replace(/\[cor=([a-z]+)\](.+?)\[\/cor\]/g, (all, name, txt) =>
      TEXT_COLOR_NAMES.has(name) ? `<span class="c-${name}">${txt}</span>` : all);
    t = t.replace(/==(.+?)==/g, '<mark class="md-mark">$1</mark>');
    t = t.replace(/~~(.+?)~~/g, '<s>$1</s>');
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/__(.+?)__/g, '<u>$1</u>');
    t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
    return t.replace(/\u0000(\d+)\u0000/g, (_, i) => links[+i]);
  }
}

/* Spoiler: clique (ou Enter/Espaço) revela e esconde de novo. Vale em todas as
   páginas que carregam este arquivo, inclusive na prévia do editor. */
document.addEventListener('click', e => {
  const s = e.target.closest('.spoiler');
  if(s){ const open = s.classList.toggle('is-open'); s.setAttribute('aria-pressed', String(open)); }
});
document.addEventListener('keydown', e => {
  if((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('spoiler')){
    e.preventDefault();
    e.target.click();
  }
});

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
