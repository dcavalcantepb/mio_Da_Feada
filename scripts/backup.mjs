/* Backup do Mio da Feada: as três tabelas (com rascunhos) + as fotos do Storage.

   Uso:   SUPABASE_SERVICE_ROLE_KEY=<chave> node scripts/backup.mjs [pasta]
   Saída: <pasta>/dados.json  e  <pasta>/fotos/<arquivo>   (padrão: ./backup)

   Precisa da chave "service_role" (Supabase > Project Settings > API), porque só
   ela enxerga os rascunhos. Nunca ponha essa chave no site nem no repositório: no
   GitHub ela fica em Secrets (ver README). Sem dependências: só Node 18+. */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const URL_BASE = process.env.SUPABASE_URL || 'https://vvsfzhawmpjmpocutxnx.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const OUT = process.argv[2] || process.env.OUT || 'backup';
const BUCKET = 'personagens';
/* sessoes/tomos/personagens são do Mio da Feada; escudo_notas/escudo_layout são
   do Escudo de Kauntar — as duas moram no mesmo projeto Supabase, então o mesmo
   backup semanal cobre as duas. Nenhuma tem fotos além do bucket "personagens". */
const TABELAS = ['sessoes', 'tomos', 'personagens', 'escudo_notas', 'escudo_layout'];

if(!KEY){
  console.error('Falta a chave: defina SUPABASE_SERVICE_ROLE_KEY (Supabase > Project Settings > API > service_role).');
  process.exit(1);
}
/* chave nova (sb_secret_...) vai só em 'apikey'; a antiga service_role (JWT, começa com eyJ) também em 'Authorization' */
const headers = KEY.startsWith('sb_') ? { apikey: KEY } : { apikey: KEY, Authorization: `Bearer ${KEY}` };

/* lê a tabela inteira, de 1000 em 1000 linhas */
async function lerTabela(nome){
  const linhas = [], passo = 1000;
  for(let de = 0; ; de += passo){
    const r = await fetch(`${URL_BASE}/rest/v1/${nome}?select=*&order=id.asc`, {
      headers: { ...headers, 'Range-Unit': 'items', Range: `${de}-${de + passo - 1}` }
    });
    if(!r.ok) throw new Error(`${nome}: HTTP ${r.status} — ${await r.text()}`);
    const pagina = await r.json();
    linhas.push(...pagina);
    if(pagina.length < passo) break;
  }
  return linhas;
}

const dados = { version: 1, exportedAt: new Date().toISOString(), project: URL_BASE };
for(const t of TABELAS){
  dados[t] = await lerTabela(t);
  console.log(`${t}: ${dados[t].length} linhas`);
}

/* fotos: cada personagem aponta para a sua pela URL pública */
await mkdir(join(OUT, 'fotos'), { recursive: true });
let fotos = 0;
for(const p of dados.personagens){
  if(!p.photo_url) continue;
  const nome = decodeURIComponent(p.photo_url.split(`/${BUCKET}/`).pop().split('?')[0]);
  const r = await fetch(p.photo_url);
  // um backup incompleto não pode passar por completo: se uma foto falhar, o processo falha
  if(!r.ok) throw new Error(`foto ${nome}: HTTP ${r.status}`);
  await writeFile(join(OUT, 'fotos', nome), Buffer.from(await r.arrayBuffer()));
  fotos++;
}
console.log(`fotos: ${fotos} arquivos`);

dados.resumo = Object.fromEntries([...TABELAS.map(t => [t, dados[t].length]), ['fotos', fotos]]);
await writeFile(join(OUT, 'dados.json'), JSON.stringify(dados, null, 2));
console.log(`backup gravado em ${OUT}/`);
