# O Mio da Feada — crônica das Lendas de Netéria

Site front-end estático (HTML + CSS + JS puro, sem build) hospedado no
GitHub Pages, com um banco de dados de verdade no Supabase:

- **`index.html`** — a página inicial. Só os links para as duas seções e
  a Campanha mais recente, em leitura completa.
- **`campanhas.html`** — clique numa Campanha pra ver seus Arcos, clique
  num Arco pra ler todas as entradas dele em sequência (mais antiga
  primeiro, rolando a tela). Ao entrar nessa leitura a barra lateral
  some por completo, só sobra "← Campanhas" pra voltar.
- **`tomos.html`** — mesma ideia, mas numa lista só (lore não tem Arco):
  clique num Tomo pra ler, a barra lateral some do mesmo jeito.
- **`editor.html`** — o escritório. Onde você cria e edita as entradas,
  atrás de um login real (Supabase Authentication). Quem já está logado
  também vê um botão **"+ Nova entrada"** direto nas páginas de leitura,
  acima do índice lateral — visitantes anônimos nunca veem esse botão.

## Como funciona o controle de quem edita

Isso mudou desde a primeira versão do projeto. Agora:

1. Existe um usuário seu cadastrado em **Authentication > Users** no Supabase.
2. `editor.html` pede login de verdade (e-mail + senha) usando esse usuário.
3. A tabela `entries` tem **Row Level Security** ativada, com duas regras:
   - qualquer um pode **ler** (`SELECT`) — é isso que faz `index.html` funcionar
     para todo mundo, sem login;
   - só quem estiver **autenticado** pode **escrever** (`INSERT`/`UPDATE`/`DELETE`).

Ou seja, a proteção não depende mais de esconder uma senha no código-fonte —
é o próprio banco de dados que decide quem pode fazer o quê.

## Fluxo de trabalho para adicionar/editar uma história

Ficou bem mais direto que antes: não tem mais exportar arquivo, nem `git push`
para publicar conteúdo.

1. Abra `editor.html` e faça login com seu e-mail/senha.
2. Preencha o formulário à esquerda — o painel à direita mostra a
   pré-visualização exatamente como vai aparecer para quem ler.
3. Clique em **Salvar entrada no banco**. A entrada já fica publicada
   na hora — qualquer pessoa que abrir `index.html` já vê a novidade.
4. Para editar uma entrada existente, abra a lista **"Entradas existentes"**,
   clique nela para carregar no formulário, ajuste o que quiser e salve de novo.
5. Para excluir, use o botão **"Excluir esta entrada"** (dentro do formulário)
   ou o ✕ ao lado da entrada na lista.

O botão **"Baixar cópia de backup"** é opcional — baixa um `.json` com tudo
que está no banco hoje, só como segurança extra. Não é mais necessário para
publicar nada.

## Configuração técnica (já feita neste projeto)

- `js/supabase-client.js` guarda a URL do projeto e a *publishable key*.
  Ambas são seguras de expor no código: quem decide o que pode ou não ser
  feito são as RLS policies da tabela, não essas credenciais.
- A tabela `entries` tem as colunas: `id`, `created_at` (automáticas),
  `title`, `type`, `campaign`, `arc`, `session`, `date`, `tags` (lista),
  `summary`, `content`.
- `type` aceita duas categorias: `campanha` (relatos de mesa) e `tomo`
  (lore de Kauntar). Rótulos e ícones em `js/render.js`, cores em
  `css/style.css`.
- `campaign` só faz sentido para `type = campanha` — é o nível acima de
  `arc` na árvore de `campanhas.html` (ex.: campanha "A Queda de
  Ferramor" contendo os arcos "Arco 1", "Arco 2"...). Entradas sem
  `campaign` caem num grupo "Sem campanha" na árvore, não desaparecem.
- O botão "+ Nova entrada" nas páginas de leitura é só uma conveniência
  de interface: ele consulta `supabaseClient.auth.getSession()` no
  navegador pra decidir se aparece. Quem realmente barra escrita não
  autorizada é a RLS da tabela (`authenticated_Writing`), não esse
  botão — então não há problema de segurança em como ele é escondido.

Se algum dia você trocar de projeto Supabase (ou criar um segundo, por
exemplo para testes), só precisa atualizar `SUPABASE_URL` e
`SUPABASE_PUBLISHABLE_KEY` em `js/supabase-client.js`.

## Publicando no GitHub Pages

O front-end continua 100% estático — o GitHub Pages só entrega os arquivos,
quem fala com o banco é o JavaScript rodando no navegador de quem acessa.

1. Suba esta pasta inteira (`index.html`, `campanhas.html`, `tomos.html`,
   `editor.html`, `css/`, `js/`) para um repositório no GitHub.
2. No repositório, vá em **Settings → Pages**.
3. Em **Source**, escolha a branch `main` (ou `master`) e a pasta `/ (root)`.
4. Salve. Em alguns minutos o GitHub mostra o link público, algo como:
   `https://seu-usuario.github.io/nome-do-repositorio/`
5. Compartilhe esse link — ele abre em `index.html` (a leitura). O escritório
   fica em `.../editor.html`; você não precisa divulgar esse link, mas mesmo
   que alguém o encontre, só quem tiver seu login consegue editar algo.

Qualquer outro host estático gratuito (Netlify, Vercel, Cloudflare Pages,
Surge etc.) funciona do mesmo jeito, sem passo de build.
