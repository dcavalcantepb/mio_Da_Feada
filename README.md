# O Mio da Feada — crônica das Lendas de Netéria

Site estático (HTML + CSS + JS puro, sem build) hospedado no GitHub Pages,
com banco de dados no Supabase. Formato de blog: um episódio por página,
com um índice em árvore numa barra lateral retrátil.

## As duas páginas

- **`index.html`** — a leitura. A página inicial mostra o **último episódio
  publicado** de Campanhas. O botão com o mascote, na borda esquerda,
  abre e fecha o índice (começa fechado):
  - **Campanhas** › Campanha › Arco › Sessões (`1 - A chegada`…)
  - **Tomos do Storyteller** › tomo › subtomo › … (profundidade livre)

  Endereços: `#s=<id>` (sessão) e `#t=<id>` (tomo). "Entrar", o tema
  claro/escuro e — só para quem está logado — "Nova entrada" ficam no topo.
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
index.html   editor.html
css/style.css                    paleta "Véu Élfico" (claro/escuro)
js/supabase-client.js            conexão
js/render.js                     utilitários, consultas, agrupamento e a postagem
js/reader.js                     leitura, índice em árvore, login
js/editor.js                     escritório
js/theme.js                      tema claro/escuro
img/mascot.png                   mascote (botão do índice)
```
