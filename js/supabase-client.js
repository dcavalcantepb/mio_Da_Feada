/* Conexão com o Supabase.
   A URL e a publishable key são seguras de expor no código: quem
   realmente decide o que pode ou não ser feito são as RLS policies
   configuradas na tabela `entries`, lá no painel do Supabase. */

const SUPABASE_URL = 'https://vvsfzhawmpjmpocutxnx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vcwzrvO9zcPuzLcnykpZwg_-O3qyNEM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
