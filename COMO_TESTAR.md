# Como Correr e Testar a Plataforma

> Guia rápido de comandos de terminal (para colar no terminal do Visual Studio Code) para pôr o projeto a correr e testar as funcionalidades, incluindo a nova Agenda (Fase 6). Criado a 4 de setembro de 2026 — ver `CONTEXTO.md` para a visão geral do projeto e `PLANEAMENTO.md` para o histórico detalhado de decisões e problemas resolvidos.

## 1. Arrancar o backend

Abre um terminal no VS Code (`Terminal > New Terminal`) e corre:

```powershell
cd backend
npm run dev
```

Isto arranca a API em `http://localhost:4000` (com `--watch`: reinicia sozinho sempre que gravas um ficheiro do backend). **Deixa este terminal aberto** — se o fechares, a aplicação deixa de conseguir falar com a base de dados.

Para confirmar que arrancou bem, abre no browser: `http://localhost:4000/api/v1/health` — deve devolver `{"data":{"status":"ok"}}`.

## 2. Arrancar o frontend

Abre um **segundo** terminal (ícone de "+" no painel de terminais do VS Code, não fechar o do backend), na pasta principal do projeto (`Plataforma-Gestao-Pedagogica`, não `backend`):

```powershell
npx serve src -l 5500
```

Isto serve os ficheiros da pasta `src/` em `http://localhost:5500`. **É importante ser exatamente esta porta** — o backend só aceita pedidos vindos de `http://localhost:5500` (variável `CORS_ORIGIN` no `.env`); abrir por outra porta, ou pelo IP da rede local (ex.: `192.168.x.x`), dá o erro de "Failed to fetch" / "credenciais incorretas" que já apareceu antes (ver `PLANEAMENTO.md`).

Se preferires continuar a usar a extensão Live Server em vez deste comando, funciona à mesma — só confirma que fica na porta 5500 (é a porta por omissão da extensão) e abre sempre por `localhost`, nunca pelo IP.

## 3. Abrir a aplicação

No browser: **http://localhost:5500/pages/login.html**

## 4. Testar a Agenda (coordenação + formador)

Desde 2026-09-04, as UCs deixaram de se gerir dentro da página Agenda — passaram a ser geridas "por fora", em **Gestão Turmas** (a Sara pediu esta mudança porque a mesma UC do catálogo pode agora ser associada a várias turmas, cada uma com o seu próprio formador). A Agenda passou a ser só para agendar aulas.

Para testares os dois papéis ao mesmo tempo sem teres de sair/entrar constantemente, usa duas janelas diferentes do browser (ex.: uma normal e outra anónima/privada) — cada uma guarda a sua própria sessão.

1. Janela 1 — entra como coordenadora → **Gestão Turmas** → cria (ou edita) uma turma e escolhe um mediador.
2. Janela 1 — na linha dessa turma, clica no ícone de livros (**Gerir UCs desta turma**) → **Nova UC no catálogo** (se ainda não existir nenhuma) → preenche abreviatura, nome e carga horária → **Criar UC no catálogo**.
3. No mesmo modal, em "Associar UC a esta turma", escolhe a UC que acabaste de criar e o formador que a vai lecionar nesta turma → **Associar UC**. (A mesma UC pode voltar a ser associada a outra turma, com outro formador, sem qualquer conflito.)
4. Janela 2 (anónima) — entra como esse formador → **A Minha Agenda** → clica nalgumas células para marcar Livre e Bloqueado.
5. Volta à Janela 1 → **Agenda** → escolhe a turma → a UC associada aparece na tabela → botão **Agendar** → clica num bloco verde → escolhe a modalidade → **Confirmar Agendamento**.
6. Confirma que a coluna "Em Falta" diminuiu, e que essa célula aparece a azul (com "Aula") na grelha do formador na Janela 2 — pode ser preciso recarregar a página.

### 4b. Testar notas, assiduidade, trabalhos e mensagens (2026-10-20)

Antes: aplicar a migração (secção 6) — estas funcionalidades precisam das tabelas novas. Precisas de uma turma com UCs associadas (secção 4), pelo menos um **formando** nessa turma (cria-o em *Pedidos de Acesso* escolhendo "Formando" e a turma, ou muda-lhe a turma em *Gestão Formandos*) e uma aula **já passada** (agenda uma aula num bloco de uma data anterior a hoje, ou usa uma data de passado ao definir a disponibilidade).

Usa duas janelas do browser (uma normal, outra anónima) para teres formador e formando ao mesmo tempo:
1. **Formador** → *Notas* → escolhe a UC → lança uma nota a um formando. **Formando** → *As Minhas Notas* → confirma que aparece.
2. **Formador** → *Assiduidade* → escolhe a UC e a aula (só aparecem aulas já dadas) → marca um formando como Ausente → *Guardar presenças*.
3. **Formando** → *Assiduidade* → botão *Justificar* na falta → escreve o motivo, anexa um ficheiro → submeter. **Formador** → *Assiduidade* (justificações pendentes) → abrir o anexo → *Aceitar*. O formando passa a ver "Falta justificada".
4. **Formador** → *Trabalhos* → escolhe a UC → *Novo trabalho* (com prazo futuro). **Formando** → *Trabalhos* → *Submeter* um ficheiro → o formador vê-o em *Ver submissões* e avalia. Reenviar até ao prazo substitui o ficheiro e apaga a avaliação.
5. **Formando** → *Mensagens* → *Nova mensagem* → Coordenação. **Coordenação** → *Mensagens* → *Responder*; o formando vê a resposta em "Enviadas".
6. **Coordenação** → *Pautas e Assiduidade* → escolhe a turma → vê a pauta (com média) e a assiduidade → *Exportar pauta (CSV)*.

## 5. Correr os testes automatizados do backend

Antes da primeira vez: copia `backend/.env.test.example` para `backend/.env.test` (aponta para uma base **separada**, com `test` no nome) e aplica as migrações a essa base (ver abaixo, "Aplicar uma migração à base de testes"). Os testes apagam todos os dados da base que usam e recusam arrancar se o nome dessa base não incluir `test`.

Num terminal, dentro de `backend`:

```powershell
npm test
```

Deve mostrar `Test Suites: 30 passed` e `Tests: 279 passed` (contagem de 2026-10-28; vai crescendo com cada funcionalidade nova). Corre isto sempre que quiseres confirmar rapidamente que nada ficou partido, sem teres de testar tudo manualmente no browser.

## 6. Comandos úteis extra (só quando precisares)

Ver os dados diretamente na base de dados, numa interface no browser:

```powershell
cd backend
npx prisma studio
```

Depois de alterar o `schema.prisma` (normalmente só quando mudamos o modelo de dados):

```powershell
npx prisma migrate dev --name <nome-da-alteracao>
npx prisma generate
```

Se `npx prisma generate` ou `npx prisma migrate dev` derem o erro `EPERM: operation not permitted, rename ...query_engine-windows.dll.node...`, fecha o terminal do backend e o Prisma Studio (se estiverem abertos) e tenta outra vez — é um ficheiro temporariamente bloqueado por outro processo Node, não um erro real no código (ver `PLANEAMENTO.md` para o histórico completo deste problema).

## 7. Gerar o ficheiro SQL de criação da base de dados (para o relatório/anexos)

Pedido pela Sara para ter um ficheiro `.sql` autónomo com o `CREATE TABLE` completo da base de dados (útil para o relatório/anexos, independente do Prisma). Corre isto sempre que quiseres uma versão atualizada, depois de o `schema.prisma` estar migrado e correto:

```powershell
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > database_schema.sql
```

Isto gera `backend/database_schema.sql` com o SQL completo (todas as tabelas, chaves primárias/estrangeiras, índices e valores de enum) para criar a base de dados do zero, sem precisar de `npx prisma migrate`. Não apaga nem toca na tua base de dados atual — só lê o `schema.prisma` e escreve o ficheiro.

### Aplicar uma migração à base de testes (sem trocar `.env`/`.env.test`)

`migrate dev` **cria** uma migração nova e aplica-a à BD de desenvolvimento (só se mudaste o `schema.prisma`); `migrate deploy` apenas **aplica** as migrações que já existem na pasta `prisma/migrations` — é o que se usa na base de testes e numa instalação nova (`npm run prisma:deploy` faz o mesmo na base do `.env`).

Para aplicar à base de testes **sem renomear ficheiros**, define o `DATABASE_URL` só nessa sessão do PowerShell (o Prisma não sobrepõe uma variável já definida ao ler o `.env`). Corre tudo na mesma janela, de seguida, e **só avança se a linha de confirmação mostrar uma base com `test` no nome**:

```powershell
$env:DATABASE_URL = ((Get-Content .env.test | Where-Object { $_ -like 'DATABASE_URL=*' }) -replace '^DATABASE_URL=','').Trim('"')
$env:DATABASE_URL -replace ':[^:@]*@',':***@'   # confirma que termina em _test antes de continuar
npx prisma migrate deploy
npm test
Remove-Item Env:DATABASE_URL   # só no fim: limpa a variável desta janela
```

Se `migrate deploy` disser "No pending migrations" mas faltarem tabelas (histórico dessincronizado), corre `npx prisma migrate reset` **antes** do `Remove-Item` e só depois de confirmares que a base mostrada é a de testes — o `reset` apaga tudo na base para onde `DATABASE_URL` aponta. Nunca o corras com a variável removida: aí apontaria para a base de desenvolvimento.

## Variáveis de ambiente (.env)

Precisas de dois ficheiros na pasta `backend` (nenhum deles vai para o Git — por isso não vêm no repositório):
- `.env` — base de dados de desenvolvimento. Copia `backend/.env.example` para `backend/.env` e preenche.
- `.env.test` — base de dados só para os testes automatizados (tem de ser uma base de dados **diferente** da de desenvolvimento, porque os testes apagam tudo antes de cada teste). Copia `backend/.env.test.example` (novo, 2026-09-04) para `backend/.env.test` e preenche.

## Resumo rápido (cola e usa)

```powershell
# Terminal 1 — backend
cd backend
npm run dev

# Terminal 2 — frontend (novo separador, pasta principal do projeto)
npx serve src -l 5500
```

Depois abre `http://localhost:5500/pages/login.html`.

## Testar o envio de email (SMTP)

Sem `SMTP_HOST` no `backend/.env`, o backend usa uma conta de teste Ethereal: não entrega a ninguém. Para testar com um servidor real:

1. No `backend/.env` (nunca no `.env.example`) acrescenta, com os dados do teu fornecedor: `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_SECURE` (`false` para 587; `true` para 465), `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM`. Com o Gmail é preciso ativar a verificação em 2 passos e criar uma "palavra-passe de aplicação" (a palavra-passe normal não funciona); servidor `smtp.gmail.com`.
2. A partir de `backend/`, envia um email de teste **para o teu próprio endereço**:

```bash
node scripts/testar-email.js o-teu-email@exemplo.pt
```

O script mostra o modo em uso (sem a palavra-passe), verifica a ligação e o login ao servidor, envia um único email e mostra a resposta. Se falhar, mostra o código do erro (`EAUTH` = credenciais, `ESOCKET`/`ECONNREFUSED` = servidor ou porta, `ETIMEDOUT` = rede/firewall). Depois do teste, reinicia o backend para ele ler o `.env` novo.
