/* Utilitários compartilhados entre a leitura e o editor.
   Sem dependências externas — tudo roda direto no navegador. */

const TYPE_LABELS = {
  sessao: 'Sessão',
  personagem: 'Personagem',
  local: 'Lugar',
  lore: 'Lenda'
};

const TYPE_ICONS = {
  sessao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20 L16 8 M14 6 l4 4 M17 3 l4 4 -3 3 -4-4z"/></svg>',
  personagem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-4 3.5-6 7-6s7 2 7 6"/></svg>',
  local: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M7 6l3 3-3 3M17 6l-3 3 3 3" stroke-width="1.3"/></svg>',
  lore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M17 4a3 3 0 0 1 3 3v13" /><path d="M8 9h6M8 12h6"/></svg>'
};

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
      html += `<h3>${inline(lines[0].replace(/^##\s+/, ''))}</h3>`;
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

/* Informações fixas do site (não moram no banco — são só texto do cabeçalho) */
const SITE_INFO = {
  title: 'Crônica',
  subtitle: 'registros da mesa'
};

/* Busca todas as entradas na tabela `entries` do Supabase.
   .select('*') pede todas as colunas; .order() pede pro próprio banco
   já devolver ordenado por data, em vez de a gente ordenar no navegador. */
async function fetchStories(){
  const { data, error } = await supabaseClient
    .from('entries')
    .select('*')
    .order('date', { ascending: true });
  if(error) throw new Error(error.message);
  return { site: SITE_INFO, entries: data };
}

function formatDate(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-');
  if(!y || !m || !d) return iso;
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${d} ${meses[+m-1] || m} ${y}`;
}
