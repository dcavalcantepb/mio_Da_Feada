/* Conexão com o Supabase.
   A URL e a publishable key são seguras de expor no código: quem
   realmente decide o que pode ou não ser feito são as RLS policies
   das tabelas `sessoes` e `tomos`, lá no painel do Supabase
   (visitante lê só o que está publicado; usuário autenticado lê e
   escreve tudo). */

const SUPABASE_URL = 'https://vvsfzhawmpjmpocutxnx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vcwzrvO9zcPuzLcnykpZwg_-O3qyNEM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
