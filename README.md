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

### Barra de ferramentas de texto

No editor, acima do campo de texto (o mesmo nos três modos: Texto da Campanha,
Texto da Lore e História do Personagem), há uma barra com: desfazer/refazer,
**H1/H2/H3**, **alinhamento** (esquerda, centralizado, direita, justificado),
**negrito** (Ctrl+B), *itálico* (Ctrl+I), sublinhado (Ctrl+U), riscado, marca-texto, **cor do texto** (8 cores), lista de marcadores, lista
numerada, citação, divisor, link, **spoiler** (o leitor clica para revelar) e
limpar formatação. Clicar de novo numa ferramenta já aplicada a desliga.
Resumo e Bio são texto puro, sem formatação.

As marcas ficam no próprio texto (texto puro no banco); o motor está em
`renderMarkdownLite()` (`js/render.js`) e a barra em `js/toolbar.js`:

| Efeito | Marca |
|---|---|
| Títulos | `# H1`  `## H2`  `### H3` (no início da linha) |
| Negrito / itálico | `**texto**`  `*texto*` |
| Sublinhado / riscado | `__texto__`  `~~texto~~` |
| Marca-texto | `==texto==` |
| Cor | `[cor=ouro]texto[/cor]` (ouro, brasa, rubi, rosa, violeta, ceu, turquesa, verde) |
| Spoiler | `\|\|texto\|\|` |
| Link | `[texto](https://endereço)` (só http/https) |
| Menção | `[[Nome]]` ou `[[Nome\|texto exibido]]` |
| Listas | `- item`  e  `1. item` |
| Citação / divisor | `> fala`  e  `---` |
| Alinhamento | `{centro}texto`, `{direita}texto`, `{justificado}texto` no começo da linha (também antes de `#` e `>`). `{esquerda}` é o padrão; o botão "esquerda" só tira o alinhamento. Vale para parágrafo, título e citação; em listas é ignorado. |

**Menções.** `[[Soryenn Sakhari]]` vira link para o personagem, tomo ou sessão de
mesmo nome (sem diferenciar maiúsculas nem acentos; se o nome se repetir, vale
personagem > tomo > sessão). Roxo = personagem, turquesa = tomo, ouro = sessão.
No editor, digitar `[[` abre a lista de sugestões (setas, Enter/Tab para aceitar,
Esc para fechar), e há o botão **@** na barra. Uma menção sem página aparece
marcada em vermelho pontilhado só na prévia do editor; para o leitor vira texto
simples. Como o link segue o *nome*, renomear uma entrada desfaz as menções a ela.

As cores têm um tom para o tema claro e outro para o escuro (`--c-*` em
`css/style.css`), todos com contraste mínimo de 4,5:1. Todo texto é escapado
antes de virar HTML: só as marcas acima geram tags.

## Backup automático

Todo domingo (e quando você pedir), o GitHub Actions (`.github/workflows/backup.yml`)
baixa as três tabelas **com os rascunhos** e as fotos, compacta, **criptografa**
(AES-256) e guarda como arquivo da execução por **90 dias** (uns três meses de
semanais). Como o repositório é público, o arquivo só sai criptografado: sem a
senha, ninguém lê nada.

**Configuração (uma vez):** GitHub > repositório > Settings > Secrets and variables >
Actions > *New repository secret*:

| Segredo | O que é |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API Keys > chave `service_role` (ou a "secret", nas chaves novas). Nunca vai para o código. |
| `BACKUP_PASSPHRASE` | Uma frase longa inventada por você. **Guarde num gerenciador de senhas: sem ela os backups não abrem.** |

Para testar na hora: aba **Actions > Backup semanal > Run workflow**. Se faltar um
segredo, a execução falha e avisa qual.

**Baixar e abrir:** na execução, em *Artifacts*, baixe o `.zip` (traz o
`backup.tar.gz.enc`). No Git Bash ou WSL (que têm `openssl`):

```
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in backup.tar.gz.enc -out backup.tar.gz
tar -xzf backup.tar.gz        # cria a pasta backup/ com dados.json e fotos/
```

(ele pergunta a senha). Ou, num passo só, com o script:
`bash scripts/abrir-backup.sh caminho/do/backup-mio-N.zip` (confere a senha, mostra o
resumo e apaga o que abriu).

> **Armadilha do Windows:** no Git Bash, o `openssl` termina as linhas com um ``
> invisível. Se você guardar a senha numa variável (por exemplo com `read` ou `$(...)`),
> tire-o antes de usar, senão uma senha "idêntica" dá `bad decrypt`:
> `P=$(printf '%s' "$P" | tr -d '
')`. Digitar a senha no prompt do `openssl` não tem
> esse problema. Ao **cadastrar** o segredo, prefira gerar a senha só com letras e números
> (`openssl rand -hex 16 | tr -d '
'`) e passá-la por `gh secret set --body "$P"`.

A pasta `backups/` (e `backup/`, `aberto-*/`, `*.tar.gz*`) está no `.gitignore` para que
nada disso seja versionado por engano: o repositório é público e o backup tem rascunhos.

**Restaurar** (numa base vazia com o esquema criado, ver
`supabase/schema.sql`):

```
node scripts/restore.mjs backup            # só simula e mostra o que faria
SUPABASE_SERVICE_ROLE_KEY=... node scripts/restore.mjs backup --apply
```

O restaurador mantém os ids, não apaga nada e, no fim, mostra 3 linhas de SQL para
ajustar os contadores de id. Para restaurar em **outro projeto**, defina também
`SUPABASE_URL`: nesse caso ele reescreve o `photo_url` de cada personagem para apontar
para as fotos do projeto de destino. Rodar duas vezes é seguro (as linhas são atualizadas
pelo id, sem duplicar). Se algo faltar no destino (tabela, bucket, chave errada), ele
para e diz o que fazer.

### Ensaio de restauração (faça uma vez, quando tiver 15 minutos)

> **Já feito em 26/09/2026, e passou:** `schema.sql` rodou do zero num projeto vazio, a
> restauração trouxe tomos, personagens e fotos com conteúdo idêntico ao do site real
> (conferido por hash), os `photo_url` foram reescritos para o projeto novo, os contadores
> de id funcionaram e o site leu o projeto restaurado sem erros. Esse ensaio usou a chave
> pública com a escrita liberada só no projeto de teste; o caminho com a chave
> `service_role` foi validado apenas contra um servidor simulado. Refaça o ensaio se
> `scripts/restore.mjs` ou `supabase/schema.sql` mudarem.

Um backup só vale se a restauração funciona. Este ensaio usa um projeto de teste e **não
toca no site real**:

1. Em supabase.com, crie um projeto novo e gratuito, por exemplo `mio-ensaio`.
2. No **SQL Editor** dele, cole o conteúdo de `supabase/schema.sql` e rode. Pode deixar o
   UUID de exemplo: no ensaio quem escreve é a chave `service_role`, que ignora as regras.
3. Abra um backup: `bash scripts/abrir-backup.sh caminho/do/backup-mio-N.zip --manter`
   (a pasta `aberto-…/backup` fica disponível; apague-a depois).
4. Restaure no projeto de ensaio, com a URL e a chave **dele** (Project Settings > API):
   ```
   SUPABASE_URL=https://<ref-do-ensaio>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<chave-do-ensaio> \
     node scripts/restore.mjs caminho/aberto-…/backup --apply
   ```
5. Rode as 3 linhas de SQL que ele mostra no fim.
6. Confira: no **Table Editor** as contagens batem com o resumo do backup, e uma foto abre
   pelo `photo_url` do personagem (agora com o endereço do projeto de ensaio).
7. Apague o projeto de ensaio (Project Settings > General > Delete project) e a pasta `aberto-…`.

### Se o projeto do Supabase for perdido de verdade

1. Crie o projeto novo e, em **Authentication > Users**, o seu usuário (a conta de login
   **não** vai no backup).
2. No SQL Editor, rode `supabase/schema.sql` trocando o UUID de exemplo pelo do usuário novo.
3. Restaure como no ensaio, mas com a URL e a chave do projeto novo.
4. Troque, em `js/supabase-client.js`, a URL e a chave pública (*publishable*) e envie ao
   GitHub; atualize o segredo `SUPABASE_SERVICE_ROLE_KEY` do repositório para a chave nova.
5. Rode **Actions > Backup semanal > Run workflow** para confirmar que o backup volta a funcionar.

**Backup local (OneDrive):** o mesmo script roda no seu computador, sem criptografia:
`SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup.mjs "C:\Users\danil\OneDrive\Backups\mio"`.
(O botão **Backup** do editor continua baixando um `.json` só com as tabelas
publicadas e não inclui as fotos.)

**Limites que vale saber:**
- O GitHub **desativa agendamentos de repositórios públicos após 60 dias sem
  atividade** (ele avisa por e-mail antes). Enquanto você for mexendo no site, não
  é problema; numa pausa longa, reative em Actions.
- Se o backup falhar (chave revogada, projeto pausado…), o GitHub manda e-mail.
- Nunca guarde `dados.json` sem criptografia no repositório: ele tem os rascunhos.

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
js/toolbar.js                    barra de ferramentas de texto do editor + sugestões de menção
scripts/backup.mjs               backup das tabelas e fotos (usado pelo Actions)
scripts/restore.mjs              restaura um backup
supabase/schema.sql              esquema do banco (para recriar o projeto)
.github/workflows/backup.yml     backup semanal criptografado
js/theme.js                      tema claro/escuro
img/mascot.png                   mascote (botão do índice)
favicon.ico, img/favicon-32.png, img/apple-touch-icon.png   ícone do site (aba, favoritos, tela inicial do celular)
scripts/gerar-favicon.js         refaz os ícones a partir do mascote
```

## Convenções

- **Toda página tem favicon.** Ao criar uma página nova, copie estas 3 linhas do `<head>`
  de `index.html` (antes do `css/style.css`); páginas dentro de subpastas precisam ajustar os
  caminhos:
  ```html
  <link rel="icon" href="favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="img/favicon-32.png">
  <link rel="apple-touch-icon" href="img/apple-touch-icon.png">
  ```
  O ícone é o mascote recortado rente ao desenho, com fundo transparente (legível em abas
  claras e escuras, mesmo a 16 px); o `apple-touch-icon` leva o roxo `#1B0F3B` de fundo porque
  o iOS não aceita transparência. Se o mascote mudar, rode `node scripts/gerar-favicon.js`
  (precisa do Playwright). O navegador guarda o favicon em cache: após trocar, use Ctrl+F5
  (ou abra numa aba anônima) para ver o novo.
- **Depois de mexer no código, rode os testes de navegador** (Playwright) antes de subir e
  confira também no tema escuro e no celular.
