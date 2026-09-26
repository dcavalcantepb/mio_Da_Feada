/* Restaura um backup gerado por scripts/backup.mjs.

   Uso:   node scripts/restore.mjs <pasta-do-backup>            (só simula e mostra o que faria)
          SUPABASE_SERVICE_ROLE_KEY=<chave> node scripts/restore.mjs <pasta-do-backup> --apply

   Para restaurar em outro projeto Supabase, defina também SUPABASE_URL. O projeto
   precisa ter o esquema criado antes (supabase/schema.sql). Linhas que já existem são
   atualizadas (mesmo id); nada é apagado. Sem dependências: só Node 18+. */
import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

const pasta = process.argv[2];
const aplicar = process.argv.includes('--apply');
const URL_BASE = process.env.SUPABASE_URL || 'https://vvsfzhawmpjmpocutxnx.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const BUCKET = 'personagens';

if(!pasta){ console.error('Uso: node scripts/restore.mjs <pasta-do-backup> [--apply]'); process.exit(1); }

const dados = JSON.parse(await readFile(join(pasta, 'dados.json'), 'utf-8'));
let fotos = [];
try{ fotos = await readdir(join(pasta, 'fotos')); }catch(_){ /* backup sem fotos */ }

console.log(`Backup de ${dados.exportedAt} (${dados.project})`);
for(const t of ['sessoes', 'tomos', 'personagens']) console.log(`  ${t}: ${dados[t].length} linhas`);
console.log(`  fotos: ${fotos.length} arquivos`);
console.log(`Destino: ${URL_BASE}`);

if(!aplicar){
  console.log('\nSimulação: nada foi gravado. Rode de novo com --apply (e a chave) para restaurar.');
  process.exit(0);
}
if(!KEY){ console.error('\nFalta SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

/* 1) fotos primeiro, para as linhas dos personagens já apontarem para arquivos existentes */
const TIPOS = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
for(const nome of fotos){
  const r = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${encodeURIComponent(nome)}`, {
    method: 'POST',
    headers: { ...headers, 'x-upsert': 'true', 'content-type': TIPOS[extname(nome).toLowerCase()] || 'application/octet-stream' },
    body: await readFile(join(pasta, 'fotos', nome))
  });
  if(!r.ok) throw new Error(`foto ${nome}: HTTP ${r.status} — ${await r.text()}`);
}
console.log(`fotos enviadas: ${fotos.length}`);

/* 2) linhas, mantendo os ids (a tomos aponta para si mesma, então vai numa só requisição) */
for(const t of ['tomos', 'sessoes', 'personagens']){
  const linhas = dados[t];
  if(!linhas.length) continue;
  const r = await fetch(`${URL_BASE}/rest/v1/${t}?on_conflict=id`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(linhas)
  });
  if(!r.ok) throw new Error(`${t}: HTTP ${r.status} — ${await r.text()}`);
  console.log(`${t}: ${linhas.length} linhas restauradas`);
}

console.log(`
Feito. Como os ids foram preservados, rode este SQL uma vez (Supabase > SQL Editor)
para o próximo cadastro não tentar reusar um id:

  select setval(pg_get_serial_sequence('public.sessoes','id'),     coalesce((select max(id) from public.sessoes), 1));
  select setval(pg_get_serial_sequence('public.tomos','id'),       coalesce((select max(id) from public.tomos), 1));
  select setval(pg_get_serial_sequence('public.personagens','id'), coalesce((select max(id) from public.personagens), 1));
`);
