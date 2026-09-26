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
- **Personagens** › Afiliação › personagem → `personagens.html`. Os grupos do
  menu vêm do campo **Afiliação** (sem afiliação cai em "Sem afiliação"), na
  ordem em que os personagens foram cadastrados. A entrada da seção é uma
  galeria de cartões por afiliação; `#p=<id>` abre a ficha em formato de
  currículo: foto à esquerda dividindo a largura com as características, e a
  **História** embaixo, na largura toda.

Em tela larga, trocar de página com o menu aberto o mantém aberto.

- **`editor.html`** — o escritório (login obrigatório). Abre **em outra aba**
  a partir de "Nova entrada", para você consultar o episódio anterior enquanto
  escreve. Começa com o seletor **Campanha ⇄ Lore ⇄ Personagem**:
  - **Campanha** → tabela `sessoes`: título, campanha, arco, sessão nº, data,
    tags, resumo, texto.
  - **Lore** → tabela `tomos`: título, **pertence a** (onde entra na árvore),
    posição, tags, resumo, texto.
  - **Personagem** → tabela `personagens`: nome, bio (frase sob o nome), raça, idade, local de
    nascimento, classe, afiliação, história e **foto**. A foto é reduzida no
    navegador (máx. 1000 px, WebP/JPEG) antes de subir; ao trocar ou remover,
    o arquivo antigo é apagado. A afiliação sugere os nomes de campanha e as
    afiliações já usadas, para não criar grupos duplicados por erro de digitação.

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

`personagens`: `id, created_at, updated_at, name, bio, race, age, birthplace, class,
affiliation, story, photo_url, published` (`age` é texto livre: "27", "cerca
de 300 anos"). As fotos ficam no **Storage**, bucket público `personagens`
(até 2 MB, JPG/PNG/WebP); `photo_url` guarda a URL pública.

- `published = false` é rascunho.
- **RLS** nas três tabelas: visitante (`anon`) só lê o que está publicado;
  só o usuário-autor (política `autor_tudo`, presa ao `auth.uid()` dele) lê
  rascunhos e escreve. Outras contas autenticadas não escrevem nada. Se um
  dia trocar o usuário do autor, atualize o UUID nas três tabelas e nas três
  políticas do bucket `personagens` (`storage.objects`: insere, atualiza e apaga
  só o autor; a leitura é pública pela URL).
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
4. **Backup** baixa um `.json` com as três tabelas, só como segurança extra
   (as fotos ficam no Storage e não entram no arquivo).

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
js/personagens.js                leitura dos Personagens (personagens.html)
js/editor.js                     escritório
js/theme.js                      tema claro/escuro
img/mascot.png                   mascote (botão do índice)
```
