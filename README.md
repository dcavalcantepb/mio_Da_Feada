# O Mio da Feada — crônica das Lendas de Netéria

Site estático (HTML + CSS + JS puro, sem build) hospedado no GitHub Pages,
com banco de dados no Supabase. Formato de blog: um episódio por página,
com um índice em árvore numa barra lateral retrátil.

## As páginas

Todas as páginas de leitura têm o **mesmo menu lateral** (retrátil, começa
fechado; o botão é o mascote, na borda esquerda), com três categorias:

- **Campanhas** › Campanha › Arco › Sessões (`1 - A chegada`…) → `index.html`.
  A página inicial mostra o **último episódio publicado**. Endereço de uma
  sessão: `#s=<id>`. O anterior/próximo do fim do post fica dentro da mesma
  campanha.
- **Tomos do Storyteller** › árvore de profundidade livre → `tomos.html`.
  A entrada lista os tomos de nível mais alto. Endereço de um tomo: `#t=<id>`.
  (`index.html#t=…` redireciona para cá.)
- **Personagens** → `personagens.html`, seção reservada: por enquanto só
  mostra "Em breve".

Em tela larga, trocar de página com o menu aberto o mantém aberto.

- **`editor.html`** — o escritório (login obrigatório). Abre **em outra aba**
  a partir de "Nova entrada", para você consultar o episódio anterior enquanto
  escreve. Começa com o seletor **Campanha ⇄ Lore**:
  - **Campanha** → tabela `sessoes`: título, campanha, arco, sessão nº, data,
    tags, resumo, texto.
  - **Lore** → tabela `tomos`: título, **pertence a** (onde entra na árvore),
    posição, tags, resumo, texto.

  Ao lado do formulário fica a prévia ao vivo. Tem **Publicar** / **Salvar
  rascunho**; o que não foi salvo fica guardado no navegador
  (`localStorage`) e o editor oferece restaurar.

Nas páginas de leitura, "Entrar", o tema claro/escuro e — só para quem está
logado — "Nova entrada" ficam no topo.

## Banco de dados (Supabase)

`sessoes`: `id, created_at, updated_at, title, campaign, arc, session, date,
tags, summary, content, published`

`tomos`: `id, created_at, updated_at, parent_id, position, title, summary,
content, tags, published`
(`parent_id` aponta para outro tomo; vazio = raiz. `position` é a ordem entre
irmãos. Um tomo com filhos não pode ser excluído antes deles.)

- `published = false` é rascunho.
- **RLS** nas duas tabelas: visitante (`anon`) só lê o que está publicado;
  só o usuário-autor (política `autor_tudo`, presa ao `auth.uid()` dele) lê
  rascunhos e escreve. Outras contas autenticadas não escrevem nada. Se um
  dia trocar o usuário do autor, atualize o UUID nas duas políticas.
- `js/supabase-client.js` guarda a URL e a *publishable key* (seguras de
  expor: quem decide são as políticas de RLS).
- A tabela antiga `entries` foi removida.

## Como escrever

1. Abra o site, clique em **Entrar** e depois em **Nova entrada** (abre o editor).
2. Escolha **Campanha** ou **Lore**, preencha e clique em **Publicar**.
   Em Campanha, ao digitar campanha e arco já existentes, o número da próxima
   sessão é sugerido.
3. Para editar, use o link "Editar esta entrada" no fim do post, ou
   "Abrir uma entrada existente" no editor. O tipo (Campanha/Lore) não muda
   numa entrada já salva.
4. **Backup** baixa um `.json` com as duas tabelas, só como segurança extra.

Formatação do texto: `**negrito**`, `*itálico*`, `## Subtítulo`, listas com
`- item`, linha em branco entre parágrafos.

## Arquivos

```
index.html   tomos.html   personagens.html   editor.html
css/style.css                    paleta "Véu Élfico" (claro/escuro)
js/supabase-client.js            conexão
js/render.js                     utilitários, consultas, agrupamento e a postagem
js/shell.js                      casca das páginas de leitura: menu, login, árvore, anterior/próximo
js/reader.js                     leitura das Campanhas (index.html)
js/tomos.js                      leitura dos Tomos (tomos.html)
js/personagens.js                seção Personagens ("Em breve")
js/editor.js                     escritório
js/theme.js                      tema claro/escuro
img/mascot.png                   mascote (botão do índice)
```
