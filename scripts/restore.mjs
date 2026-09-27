/* Restaura um backup gerado por scripts/backup.mjs.

   Uso:   node scripts/restore.mjs <pasta-do-backup>            (só simula e mostra o que faria)
          SUPABASE_SERVICE_ROLE_KEY=<chave> node scripts/restore.mjs <pasta-do-backup> --apply

   Para restaurar em OUTRO projeto Supabase, defina também SUPABASE_URL (o padrão é o projeto
   original). O projeto de destino precisa ter o esquema criado antes (supabase/schema.sql).
   Linhas que já existem são atualizadas (mesmo id); nada é apagado. As fotos são enviadas ao
   bucket "personagens" e o endereço (photo_url) de cada personagem é reescrito para apontar
   para o projeto de destino. Sem dependências: só Node 18+. */
import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

const pasta = process.argv[2];
const aplicar = process.argv.includes('--apply');
const URL_BASE = (process.env.SUPABASE_URL || 'https://vvsfzhawmpjmpocutxnx.supabase.co').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const BUCKET = 'personagens';

if(!pasta){ console.error('Uso: node scripts/restore.mjs <pasta-do-backup> [--apply]'); process.exit(1); }

const dados = JSON.parse(await readFile(join(pasta, 'dados.json'), 'utf-8'));
let fotos = [];
try{ fotos = await readdir(join(pasta, 'fotos')); }catch(_){ /* backup sem fotos */ }

/* nome do arquivo dentro do bucket, a partir da URL pública guardada no personagem */
const nomeDaFoto = url => decodeURIComponent(String(url).split(`/${BUCKET}/`).pop().split('?')[0]);
/* endereço público da foto no projeto de DESTINO */
const urlDaFoto = nome => `${URL_BASE}/storage/v1/object/public/${BUCKET}/${nome}`;

/* personagens com o photo_url apontando para o destino (só se a foto está no backup) */
const personagens = dados.personagens.map(p => {
  if(!p.photo_url) return p;
  const nome = nomeDaFoto(p.photo_url);
  return fotos.includes(nome) ? { ...p, photo_url: urlDaFoto(nome) } : p;
});
const semFoto = dados.personagens.filter(p => p.photo_url && !fotos.includes(nomeDaFoto(p.photo_url)));
/* tomos primeiro (aponta para si mesma); depois sessoes/personagens; depois qualquer
   outra tabela que o backup tenha trazido (hoje: escudo_notas, escudo_layout do Escudo
   de Kauntar — mesmo projeto, sem fotos, então entram sem tratamento especial) */
const CONHECIDAS = new Set(['tomos', 'sessoes', 'personagens']);
const outras = Object.keys(dados).filter(k => Array.isArray(dados[k]) && !CONHECIDAS.has(k));
const linhas = { tomos: dados.tomos, sessoes: dados.sessoes, personagens };
for(const t of outras) linhas[t] = dados[t];
const ordem = ['tomos', 'sessoes', 'personagens', ...outras];

console.log(`Backup de ${dados.exportedAt} (${dados.project})`);
for(const t of ordem) console.log(`  ${t}: ${dados[t].length} linhas`);
console.log(`  fotos: ${fotos.length} arquivos`);
console.log(`Destino: ${URL_BASE}${URL_BASE === String(dados.project).replace(/\/+$/, '') ? '  (o mesmo projeto do backup)' : '  (OUTRO projeto: os photo_url serão reescritos)'}`);
if(semFoto.length) console.log(`Atenção: ${semFoto.length} personagem(ns) apontam para foto que não está no backup; o endereço deles fica como estava.`);

if(!aplicar){
  console.log('\nSimulação: nada foi gravado. Rode de novo com --apply (e a chave) para restaurar.');
  process.exit(0);
}
if(!KEY){ console.error('\nFalta SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
/* chave nova (sb_secret_...) vai só em 'apikey'; a antiga service_role (JWT, começa com eyJ) também em 'Authorization' */
const headers = KEY.startsWith('sb_') ? { apikey: KEY } : { apikey: KEY, Authorization: `Bearer ${KEY}` };

/* explica em português os erros mais comuns em vez de despejar a resposta crua */
async function falhou(oque, r){
  const corpo = await r.text();
  let dica = '';
  if(/Could not find the table|does not exist|PGRST205/.test(corpo)) dica = '\n  → A tabela não existe no destino. Rode supabase/schema.sql nele antes de restaurar.';
  else if(r.status === 401 || r.status === 403) dica = '\n  → Chave recusada. Use a chave service_role (ou secret) do projeto de DESTINO.';
  else if(/violates row-level security|new row violates/.test(corpo)) dica = '\n  → Bloqueado por RLS: a chave usada não é a service_role.';
  else if(/Bucket not found/.test(corpo)) dica = '\n  → O bucket "personagens" não existe no destino. Rode supabase/schema.sql nele antes.';
  throw new Error(`${oque}: HTTP ${r.status} — ${corpo}${dica}`);
}

/* 1) fotos primeiro, para as linhas dos personagens já apontarem para arquivos existentes */
const TIPOS = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
for(const nome of fotos){
  const r = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${encodeURIComponent(nome)}`, {
    method: 'POST',
    headers: { ...headers, 'x-upsert': 'true', 'content-type': TIPOS[extname(nome).toLowerCase()] || 'application/octet-stream' },
    body: await readFile(join(pasta, 'fotos', nome))
  });
  if(!r.ok) await falhou(`foto ${nome}`, r);
}
console.log(`fotos enviadas: ${fotos.length}`);

/* 2) linhas, mantendo os ids (a tomos aponta para si mesma, então vai numa só requisição) */
for(const t of ordem){
  if(!linhas[t].length) continue;
  const r = await fetch(`${URL_BASE}/rest/v1/${t}?on_conflict=id`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(linhas[t])
  });
  if(!r.ok) await falhou(t, r);
  console.log(`${t}: ${linhas[t].length} linhas restauradas`);
}

console.log(`
Feito. Como os ids foram preservados, rode este SQL uma vez (Supabase > SQL Editor)
para o próximo cadastro não tentar reusar um id:

  select setval(pg_get_serial_sequence('public.sessoes','id'),     coalesce((select max(id) from public.sessoes), 1));
  select setval(pg_get_serial_sequence('public.tomos','id'),       coalesce((select max(id) from public.tomos), 1));
  select setval(pg_get_serial_sequence('public.personagens','id'), coalesce((select max(id) from public.personagens), 1));${linhas.escudo_notas ? `
  select setval(pg_get_serial_sequence('public.escudo_notas','id'), coalesce((select max(id) from public.escudo_notas), 1));` : ''}

Se o destino é OUTRO projeto, lembre também de atualizar js/supabase-client.js (URL e chave pública)
e o segredo SUPABASE_SERVICE_ROLE_KEY no GitHub.
`);
