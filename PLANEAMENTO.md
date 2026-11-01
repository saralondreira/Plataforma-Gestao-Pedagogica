# Ponto de Situação e Planeamento

> Criado a 30 de julho de 2026 · última atualização a 4 de setembro de 2026 · Sem prazo fixo — plano organizado por fases e prioridades.

## Ponto de situação

### ✅ Feito

- UI completa e responsiva: login, forms, dashboard, turmas, formadores, painel do formador, perfil.
- **Migração completa de Firebase para stack própria** (Node/Express + MySQL + Prisma + JWT), conforme o guia oficial da UC00605/UC00614:
  - Fase 0 — Fundação (auth JWT/bcrypt) + Turmas.
  - Fase 1 — Formadores (agora contas de login reais, não só um roster) + Perfil.
  - Fase 2 — Entregas, com upload real de ficheiros (multer) e via de exceção.
  - Fase 3 — Pedidos de Acesso (rota pública).
  - Fase 4 — Testes automatizados (Jest + Supertest, 30 testes), documentação OpenAPI (`/api-docs`), checklist RGPD (`backend/RGPD.md`), remoção completa do Firebase do projeto.
- Modelo de dados relacional real: `Entrega.formadorId`/`turmaId` são foreign keys, não texto livre casado por nome (como era no Firestore).
- **Fase 8 — Aprovação de Pedidos de Acesso** (2026-09-02): fluxo completo de aprovação/rejeição, com criação real de conta. Fase 8b (mesmo dia, após testes manuais): credenciais passam a ser enviadas por email (o coordenador deixa de ver a password) e o papel FORMANDO já pode ser atribuído. Ver detalhe da sessão de trabalho mais abaixo.
- **Migração da Fase 8b aplicada com sucesso à BD real e de teste (2026-09-04)** — o papel FORMANDO deixou de existir só no `schema.prisma` e passou a existir de facto na base de dados, depois de resolvido o bloqueio de permissões do MySQL. Suite de testes completa a passar (39/39). Ver registo completo na secção da Fase 8, mais abaixo.
- **Relatório de ponto de situação e apresentação atualizados** (2026-09-01 a 2026-09-03) — novo PowerPoint (11 diapositivos) e um relatório Word completo, com introdução, caso de estudo (com diagrama de casos de uso UML), explicação de cada ator com os painéis da aplicação, modelo de dados, modelo de base de dados, dificuldades encontradas, próximos passos, anexos e bibliografia/webgrafia em formato APA. Ver registo de sessão próprio mais abaixo.
- **Fase 6 — Agenda: backend completo (2026-09-04)** — simulação interna de agendamento (sem ligação real ao Google Calendar/Outlook, por decisão explícita da Sara). Novas entidades `Uc`, `Disponibilidade` e `Aula`, mais `idCursoIEFP`/`mediadorId` na Turma. Testes automatizados a passar: **56/56**. Falta só o frontend (grelha do formador + calendário de agendamento da coordenação). Ver registo de sessão completo mais abaixo.

### Problemas históricos (da fase Firebase, todos moot — código já não existe)

Os problemas P1–P8 identificados na revisão de 14/jul (regras Firestore expiradas, caminho errado do `auth.js`, dashboard sem `<script>`, etc.) deixaram de se aplicar: essa integração foi substituída por completo pela stack Node/Express/MySQL. Ver `CONTEXTO.md` para o histórico.

### ⚠️ Pendências atuais

| # | Item | Impacto |
|---|------|---------|
| Q1 | Sem guarda de autenticação client-side nas páginas internas — só se descobre que a sessão expirou quando uma chamada à API devolve 401 | UX pobre (mostra a página vazia antes de eventualmente falhar), não é um problema de segurança (a API já exige JWT em todas as rotas protegidas) |
| Q2 | **"Terminar Sessão"** é só um link para `login.html`, não chama `clearSession()` | O token fica no `localStorage` depois de "sair"; ao voltar para trás no browser a sessão parece ainda ativa até expirar (7 dias) |
| Q3 | `agenda.html` continua placeholder | Funcionalidade prometida, nunca começada |
| Q4 | Sem rate limiting em `/auth/login` e `/auth/register` | Ver `backend/RGPD.md` §7 |
| Q5 | Ficheiros em `backend/uploads/` acessíveis por URL direta, sem exigir autenticação para download | Ver `backend/RGPD.md` §3 |

## Plano de trabalho

### Fase 5 — Polimento de sessão (~1 sessão)
1. Criar um pequeno `guard.js` partilhado: chama `GET /auth/me` ao carregar cada página interna; se 401, redireciona para login (Q1).
2. Ligar `clearSession()` ao botão "Terminar Sessão" em todas as páginas (Q2).

### Fase 6 — Agenda (funcionalidade nova, ~2–3 sessões)

> Nota (2026-09-04): o bloqueio de migração que tinha ficado pendente da Fase 8b está resolvido — nada impede agora avançar para esta fase, incluindo a nova migração que a entidade `Disponibilidade` vai exigir.

1. Grelha de calendário mensal (CSS Grid, navegação mês anterior/seguinte).
2. Nova entidade `Disponibilidade` no schema Prisma (formadorId, data, período).
3. Formadores marcam disponibilidade; coordenadora vê disponibilidades agregadas no calendário.
4. Endpoints REST + testes, seguindo o mesmo padrão das restantes entidades.

### Fase 7 — Segurança antes de um deploy real (~1 sessão)
1. Rate limiting no login/registo (Q4).
2. Proteger o acesso aos ficheiros em `/uploads` (Q5).
3. Rever os restantes itens do checklist `backend/RGPD.md` (política de privacidade, direito ao apagamento).
4. Preparar `Dockerfile`/variáveis de ambiente de produção (M07 do guia).

## Fase 8 — Aprovação de Pedidos de Acesso (registo de sessão, 2026-09-02)

> Registo detalhado dos passos e decisões desta sessão, para servir de base ao relatório.

### Motivação

Durante uma sessão de orientação para retomar o projeto, foi identificado que o link de login "Solicitar credenciais" (→ `forms.html`, o formulário público de Pedido de Acesso) tinha sido substituído por um botão de auto-registo durante a fase Firebase (27/jul) e nunca reposto. Ao investigar o porquê disto ser um problema real (não só estético), confirmou-se o contexto de negócio: as contas nesta plataforma **não são de auto-registo** — uma entidade externa (ex.: IEFP) atribui o email e as credenciais iniciais ao formador/formando, e é a coordenação (o "responsável master") que aprova o pedido e cria a conta.

Isto revelou uma segunda lacuna, mais profunda: o backend do `PedidoAcesso` (construído na Fase 3) só tinha o `POST /pedidos-acesso` (submissão pública). Não existia nenhuma forma de a coordenação ver os pedidos pendentes, aprová-los (criando a conta real) ou rejeitá-los — o pedido ficava para sempre em estado `PENDENTE`, sem seguimento possível pela aplicação.

### Passo 1 — Corrigir o login (já feito antes desta fase)

- `src/pages/login.html`: substituído o formulário de auto-registo (nome + papel + botão "Registar novo utilizador") por um link simples "Solicitar credenciais" → `forms.html`.
- `src/js/auth.js`: removido o handler do botão de registo direto e as referências às variáveis DOM que deixaram de existir (`btnRegister`, `registoNomeInput`, `registoRoleSelect`).

### Passo 2 — Desenhar o fluxo de aprovação (decisões tomadas)

- O modelo `PedidoAcesso` já tinha o campo `estado` (`PENDENTE` / `APROVADO` / `REJEITADO`) desde a Fase 3 — **não foi preciso alterar o schema Prisma nem correr uma nova migração**.
- `PedidoAcesso.cargo` é texto livre submetido por quem pede acesso (ex.: "formador"); não corresponde diretamente ao enum `Role`. Por isso, ao aprovar, é a coordenação que escolhe explicitamente o papel real (`COORDENADOR` ou `FORMADOR`) — não se confia no texto livre do pedido.
- Não existe (ainda) envio de email na plataforma. Decisão: ao aprovar, gera-se uma password temporária aleatória no servidor (`crypto.randomBytes`), guarda-se só o hash (`bcrypt`, como em todo o resto do projeto) e a password em claro é devolvida **uma única vez**, na resposta do próprio pedido de aprovação — cabe à coordenação copiá-la e comunicá-la à pessoa por fora da plataforma. Ficou documentado como limitação conhecida (ver "Por fazer" mais abaixo).
- A aprovação e a atualização de estado do pedido correm dentro de uma transação Prisma (`prisma.$transaction`), para nunca ficar um `User` criado sem o `PedidoAcesso` atualizado (ou vice-versa).
- Só o `COORDENADOR` pode listar, aprovar ou rejeitar pedidos — reutiliza-se o middleware `requireRole`, que já existia no projeto mas não estava a ser usado em lado nenhum.

### Passo 3 — Backend

Ficheiros alterados/criados em `backend/src/`:

- `services/pedidosAcesso.service.js` — adicionadas `listar()`, `aprovar(id, role)`, `rejeitar(id)`, mais os guardas `obterPendenteOuFalhar` (404 se não existir, 409 se já tiver sido tratado) e `gerarPasswordTemporaria()`.
- `controllers/pedidosAcesso.controller.js` — adicionados os handlers `listar`, `aprovar` (valida `{ role }` com zod) e `rejeitar`.
- `routes/pedidosAcesso.routes.js` — `POST /` continua pública; `GET /`, `PATCH /:id/aprovar` e `PATCH /:id/rejeitar` passam a exigir `requireAuth` + `requireRole("COORDENADOR")`. Documentação OpenAPI/Swagger incluída em todas as rotas novas (visível em `/api-docs`).

### Passo 4 — Testes automatizados

`backend/tests/integration/pedidosAcesso.test.js` — mantidos os 2 testes originais do `POST` público e acrescentados:
- `GET /pedidos-acesso` exige autenticação e papel de coordenação (401 sem token, 403 como formador).
- Ciclo completo de aprovação: cria pedido → aprova → conta fica mesmo criada e consegue fazer login com a password devolvida → papel (`role`) fica correto.
- Aprovar duas vezes o mesmo pedido devolve 409.
- Aprovar um pedido inexistente devolve 404.
- Rejeitar marca o pedido como `REJEITADO` e confirma que nenhuma conta foi criada (login falha).

Corre com `npm test` dentro de `backend/` (ver secção própria mais acima sobre como preparar a base de dados de teste).

### Passo 5 — Frontend

- `src/pages/pedidosAcesso.html` (nova página) — tabela com os pedidos (nome, email, cargo pretendido, motivo, estado), botões de Aprovar/Rejeitar por linha, modal para escolher o papel ao aprovar, e um segundo modal de confirmação (ver Passo 7 — deixou de mostrar a password).
- `src/js/pedidosAcesso.js` (novo) — segue o mesmo padrão dos outros módulos (`api-client.js` + `toast.js`), carrega a lista, liga os botões de ação e os dois modais.
- Link "Pedidos de Acesso" acrescentado ao menu lateral em todas as páginas autenticadas: `dashboardCoord.html`, `turmas.html`, `formadores.html`, `agenda.html`, `perfil.html` e na própria `pedidosAcesso.html` (marcado como ativo).

### Passo 6 — Correção: testes instáveis após correr `npm test`

Ao correr `npm test` pela primeira vez depois de acrescentar `tests/integration/pedidosAcesso.test.js`, apareceram falhas:

```
Test Suites: 4 failed, 2 passed, 6 total
Tests:       7 failed, 31 passed, 38 total
```

Falharam `turmas.test.js`, `formadores.test.js`, `entregas.test.js` e `pedidosAcesso.test.js` — com erros do tipo "unique constraint failed" (email duplicado), P2025 "no record found" ao atualizar/apagar, e P2003 (violação de chave estrangeira). `auth.test.js` e `validation.test.js` passaram sempre.

**Diagnóstico:** não é um bug no código novo. `backend/jest.config.js` não tinha `maxWorkers: 1`, ou seja o Jest corre vários ficheiros de teste **em paralelo**, todos contra a mesma base de dados `plataforma_pedagogica_test`. Cada ficheiro tem um `beforeEach(limparBaseDados)` que apaga tudo (`deleteMany` em `entrega`, `pedidoAcesso`, `turma`, `user`) — com dois ficheiros a correr ao mesmo tempo, um apaga registos de que o outro ainda precisa a meio do teste. Isto já era um risco estrutural antes desta fase; o 6º ficheiro de testes (pedidosAcesso) só tornou a corrida praticamente garantida.

**Correção:** acrescentado `maxWorkers: 1` a `backend/jest.config.js`, forçando os ficheiros de teste a correr em série (um de cada vez). Resolve a corrida à custa de testes um pouco mais lentos — aceitável para a dimensão atual da suite.

```js
module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setupEnv.js"],
  testTimeout: 15000,
  testPathIgnorePatterns: ["/node_modules/", "/uploads/"],
  maxWorkers: 1,
};
```

Alternativa para o futuro, se a suite crescer muito e a serialização ficar lenta: dar a cada ficheiro de teste o seu próprio "espaço" de dados (ex.: prefixar emails/códigos por ficheiro) em vez de depender de `maxWorkers: 1`.

### Passo 7 — Fase 8b: email automático + papel Formando (2026-09-02, sessão de testes manuais)

Ao testar o ciclo completo na prática (ver mais abaixo "Registo da sessão de testes manuais"), a Sara identificou duas lacunas de desenho a corrigir antes de considerar a Fase 8 fechada:

1. **O coordenador não devia ver a password gerada** — só devia servir para o próprio destinatário.
2. **Devia ser possível aprovar um pedido como "Formando"** — hoje o `Role` só tinha COORDENADOR/FORMADOR.

Decisões tomadas (perguntadas diretamente à Sara, por serem escolhas de arquitetura com impacto real):

- **Entrega de credenciais:** envio automático de email, em vez de continuar a mostrar a password ao coordenador. Alternativa de "link de ativação com password definida pela própria pessoa" foi considerada mas não escolhida — fica registada como possível evolução futura, mais segura (o link pode expirar e ser de uso único), mas mais complexa (precisa de uma rota pública nova, tokens com validade, e uma página de "definir password").
- **Papel Formando:** adicionado já ao sistema (`enum Role` no Prisma), em vez de só ajustar o formulário — é o primeiro passo real da "Visão futura — papel Formando" já documentada mais abaixo.

**Alterações:**

- `prisma/schema.prisma` — `enum Role` passa a `COORDENADOR | FORMADOR | FORMANDO`. Exige migração (`npx prisma migrate dev --name add-role-formando`, aplicada à BD de desenvolvimento **e** à de teste — ver nota no fim desta secção).
- `backend/src/lib/mailer.js` (novo) — envia o email de credenciais via `nodemailer`. Sem configuração nenhuma no `.env`, cria automaticamente uma conta de teste Ethereal (não envia nada a sério, só dá um link de pré-visualização no terminal do backend — zero credenciais reais necessárias em desenvolvimento). Se `SMTP_HOST` estiver definido no `.env`, usa esse servidor real. Em testes automatizados (`NODE_ENV=test`), usa o `jsonTransport` do nodemailer — não sai nada, fica só em memória (`testOutbox`), para os testes conseguirem verificar o conteúdo sem depender de rede.
- `backend/src/services/pedidosAcesso.service.js` — `aprovar()` deixou de devolver `credenciais` na resposta; agora chama `enviarCredenciaisAcesso(...)` e devolve só `{ pedido, emailEnviado }`. Se o envio falhar (ex.: sem rede), a aprovação **não** é revertida — a conta já foi criada; fica só registado no log do servidor (`console.error`) e `emailEnviado: false` na resposta, para a coordenação poder agir manualmente.
- `backend/src/controllers/pedidosAcesso.controller.js` e `routes/pedidosAcesso.routes.js` — `aprovarSchema`/swagger passam a aceitar `role: FORMANDO`.
- `src/pages/pedidosAcesso.html` / `src/js/pedidosAcesso.js` — select de aprovação ganha a opção "Formando(a)"; o modal final deixou de ter o campo de password, mostra só o email e uma mensagem de confirmação (ou um aviso, se o envio do email tiver falhado).
- `src/js/auth.js` — o redirecionamento pós-login passa a tratar `FORMANDO` explicitamente: vai para `perfil.html` (ainda não existe dashboard de formando — ver "Por fazer").
- `backend/tests/integration/pedidosAcesso.test.js` — o teste do ciclo completo passou a ler a password gerada do `testOutbox` do mailer (não da resposta da API) e confirma explicitamente que a resposta **não** contém `credenciais`/password nenhuma (teste de regressão de segurança). Novo teste cobre aprovação com `role: FORMANDO`.
- `backend/.env.example` — documentadas as variáveis opcionais `SMTP_HOST/PORT/SECURE/USER/PASS/FROM`.

**Passos que a Sara teve de correr no próprio terminal** (o ambiente isolado usado nesta sessão não tem acesso à BD real nem à internet):

```
cd backend
npm install nodemailer
npx prisma migrate dev --name add-role-formando   # aplica a migração à BD de desenvolvimento

# aplicar a mesma migração à BD de teste (troca temporariamente o .env):
Copy-Item .env .env.dev.bak
Copy-Item .env.test .env -Force
npx prisma migrate deploy
Copy-Item .env.dev.bak .env -Force
Remove-Item .env.dev.bak
```

### Registo da sessão de testes manuais (2026-09-02)

Testámos o ciclo completo em ambiente real pela primeira vez (não só nos testes automatizados). Coisas encontradas pelo caminho, com valor para o relatório:

- **A BD de desenvolvimento não tinha nenhuma conta criada** (`User` com 0 registos) — por isso a Sara não sabia com que conta de coordenadora entrar. Resolvido criando a primeira conta manualmente no Prisma Studio (`npx prisma studio`, na tabela `User`), com uma password gerada por `bcrypt.hashSync` no terminal.
- **Ao colar o hash da password no Prisma Studio, ficaram 2 espaços a mais no início** (62 caracteres em vez dos 60 esperados de um hash bcrypt), o que fazia o login falhar mesmo com a password certa. Diagnosticado com um pequeno script Node (`prisma.user.findUnique` + `bcrypt.compare` + `JSON.stringify`/`.length` para expor caracteres invisíveis) e corrigido com um `prisma.user.update` direto. Nota para o relatório: ao copiar/colar valores sensíveis (hashes, tokens) para um campo de formulário, vale sempre a pena confirmar o comprimento/conteúdo exato — espaços invisíveis são um erro fácil de cometer e difícil de ver a olho.
- **Pormenor de PowerShell:** testar um hash bcrypt diretamente na linha de comandos (`node -e "...'$2b$10$...'..."`) dentro de aspas duplas falha silenciosamente no PowerShell, porque ele tenta expandir os `$` como variáveis (`$2b`, `$10`, etc. tornam-se strings vazias). A forma segura de testar valores com `$` é sempre por um ficheiro `.js` temporário, nunca por `-e` com aspas duplas.
- **"Failed to fetch" / "credenciais incorretas" ao abrir pela rede local.** Numa sessão de retoma (2026-09-03), o login falhava sempre com "As credenciais estão incorretas", mesmo com a password certa (confirmado com um script que compara o hash diretamente na base de dados). A causa real só apareceu na consola do browser (F12 → Network): a página estava a ser aberta em `http://192.168.4.254:5500` (o IP da máquina na rede local) em vez de `http://localhost:5500`, e o backend só tem `http://localhost:5500` na lista de origens permitidas pelo CORS — o pedido de login era bloqueado antes de chegar ao servidor, e o frontend mostra a mesma mensagem genérica para qualquer falha de rede. Resolvido abrindo a aplicação por `localhost` em vez do IP. Nota para o relatório: quando o erro é sempre "credenciais incorretas" mas a base de dados está confirmada como correta, vale a pena olhar à consola do browser antes de mexer na password.
- Confirmado o ciclo completo a funcionar: pedido criado em `forms.html` → listado em `pedidosAcesso.html` → aprovado → conta criada → login com sucesso.
- **Migração do FORMANDO aplicada com sucesso (2026-09-04).** Depois de correr `GRANT ALL PRIVILEGES ON *.* TO 'app_pedagogica'@'localhost'; FLUSH PRIVILEGES;` no MySQL Workbench (como admin), `npx prisma migrate dev --name add-role-formando` aplicou-se sem erros à BD de desenvolvimento ("Your database is now in sync with your schema."). A seguir, `prisma generate` falhou uma vez com `EPERM` (o motor do Prisma estava bloqueado por um processo Node ainda a correr — backend ou Studio); resolvido fechando essas janelas e correndo `npx prisma generate` outra vez. Por fim, a mesma migração foi aplicada à BD de teste com o procedimento de troca de `.env` documentado acima (`npx prisma migrate deploy`). Suite de testes completa a passar: **39/39**. O bloqueio da Fase 8b fica assim resolvido.

### Por fazer (decorrente desta fase)

- Sem campo para guardar o motivo de rejeição (`PedidoAcesso` não tem esse campo no schema atual); se vier a ser pedido, implica uma pequena migração Prisma.
- O `cargo` do pedido continua texto livre; o mapeamento para `Role` é feito à mão pela coordenação no momento da aprovação.
- **Ainda não existe dashboard para o papel Formando** — por agora, ao fazer login, uma conta FORMANDO é enviada para `perfil.html`. É só um destino provisório seguro; o dashboard real faz parte da "Visão futura" mais abaixo.
- **Lacuna de controlo de acesso encontrada (não corrigida nesta fase, por estar fora do pedido original):** as rotas de `turmas`, `formadores` e `entregas` só exigem `requireAuth` (autenticado), sem `requireRole`. Ou seja, hoje um FORMANDO autenticado consegue, tecnicamente, chamar a API de gestão de turmas/formadores da mesma forma que um coordenador — só `pedidos-acesso` está restrito a COORDENADOR. Vale a pena tratar isto antes de dar contas FORMANDO a pessoas reais.
- Alternativa mais segura para o futuro, se fizer sentido (ver Passo 7): trocar o envio direto da password por um link de ativação de uso único, onde a própria pessoa define a password.


## Documentação e apresentação do projeto (registo de sessão, 2026-09-01 a 2026-09-03)

> Registo do processo de construção do relatório de ponto de situação e da apresentação PowerPoint, incluindo os pedidos da Sara e as decisões tomadas ao longo do caminho — para ficar claro como se chegou à versão final destes documentos.

### Pedido inicial (2026-09-01)

A Sara pediu uma apresentação PowerPoint e um relatório de ponto de situação para entregar na disciplina. Foi construída uma primeira versão de ambos: um PowerPoint com os diapositivos principais (contexto, stack, fases feitas, dificuldades, próximos passos) e um relatório Word inicial, mais orientado a tabelas e listas (semelhante a um resumo executivo).

### Primeira correção de rumo: relatório mais completo e em prosa

Depois de ver a primeira versão, a Sara pediu explicitamente um relatório diferente: **"Quero um relatorio mais completo do genero do que te mandei"**, referindo-se ao relatório de ponto de situação anterior (`Ponto_de_Situacao_SaraLondreira.docx`, entregue na primeira entrega da disciplina), que é escrito em prosa corrida/narrativa, não em tabelas. O relatório foi reescrito de raiz nesse estilo — texto corrido, parágrafos explicativos, em vez de bullets soltos.

### Segunda correção de rumo: estrutura académica completa

Ainda sobre o relatório, a Sara pediu depois a estrutura completa exigida para este tipo de entrega académica, com o seguinte pedido literal: *"o relatório tem que incluir o que foi entregue na primeira entrega de ponto de situação, tem que conter introdução índice, resumo, caso estudo com respetivo desenho de use case modelação da base de dados, respetivo modelo er, precisamos de explicação de cada ator e respetivos paineis com prints e legendas dos prints, conclusão anexos e bibliografia ou webgrafia, seguindo a norma apa"*.

Isto implicou reconstruir o relatório com a seguinte estrutura (15 páginas no total): capa, índice, resumo, introdução, enquadramento, trabalho realizado (cobrindo o que já constava na primeira entrega — enquadramento, trabalho realizado, dificuldades encontradas, próximos passos — confirmado por leitura do documento original enviado pela Sara), caso de estudo com diagrama de casos de uso UML, explicação de cada ator com os respetivos painéis da aplicação (capturas de ecrã com legenda numerada), modelo de dados, modelo de base de dados (com diagrama ER), dificuldades encontradas, próximos passos, conclusão, anexos e bibliografia/webgrafia em formato APA (7ª edição).

Mais tarde a Sara confirmou também **"em português de portugal"** — o documento já estava escrito em PT-PT, foi feita uma verificação dedicada ao texto para confirmar que não havia nenhum brasileirismo a corrigir. Esta preferência ficou registada de forma permanente (aplica-se a toda a comunicação escrita em português, não só a este relatório).

### O que foi construído para cumprir o pedido

- **Diagrama de casos de uso (UML)** — desenhado de raiz (script Python/matplotlib), com os quatro atores (Visitante, Coordenador(a), Formador(a), Formando(a)), os casos de uso já implementados a linha contínua e os casos de uso do papel Formando ainda planeados a linha tracejada âmbar (para não passar a ideia de que já estão feitos), e a relação «include» entre "Aprovar/rejeitar pedidos de acesso" e "Enviar credenciais por email".
- **Novo screenshot do painel do Formador** (`dashboardFormador.png`, "Os Meus Documentos") — não existia ainda nenhuma captura desta página; foi acrescentada uma segunda sessão de browser ao script de screenshots (`shoot.js`), autenticada como formador, especificamente para este relatório.
- **Índice com números de página reais** — a primeira tentativa usou um campo de Índice automático (`TableOfContents`) e depois `PositionalTab`, mas nenhum dos dois se revelou fiável na conversão para PDF usada para verificar o documento (o campo automático aparecia em branco; o `PositionalTab` não alinhava à direita nem mostrava os pontos de guia). Solução final: índice construído manualmente, com tabulação e pontos de guia, e números de página confirmados visualmente a olhar para o PDF gerado.
- **8 referências em formato APA (webgrafia)** — documentação do Prisma, Express.js, RFC 7519 (JWT), OWASP Authentication Cheat Sheet, texto oficial do RGPD (EUR-Lex), documentação do Node.js, página do bcrypt no npm, manual de referência do MySQL 8.0.
- Três anexos: lista de endpoints da API, resumo do checklist RGPD, e lista dos campos das entidades Prisma.

### Apresentação (PowerPoint)

Depois de entregue o PowerPoint (11 diapositivos), a Sara pediu ajuda para conseguir explicar o conteúdo por palavras próprias: primeiro uma explicação em linguagem simples de cada diapositivo (feita na conversa, sem gerar ficheiro), depois notas de apresentação mais curtas e organizadas por tópico, para servirem de guião rápido durante a apresentação oral — cobrindo todos os diapositivos do deck.

### Onde ficaram os ficheiros

- Relatório: `Ponto_Situacao_PlataformaGestaoPedagogica.docx`, na pasta OneDrive `Plataforma Pedagogica/Relatório Ponto Situação/`.
- PowerPoint e notas de apresentação: entregues anteriormente na conversa (ver histórico da sessão de 2026-09-01).

## Fase 6 — Agenda (registo de sessão, 2026-09-04)

> Registo detalhado da primeira parte da Fase 6 (backend), incluindo a discussão sobre ligação a calendários externos que motivou o desenho final.

### Motivação e pivot inicial: Google Calendar / Outlook

O pedido inicial da Sara para a Agenda foi **"ligação com o Google Calendário ou Outlook Calendário"**. Antes de desenhar o schema, foram apresentadas as duas abordagens possíveis: (1) exportação simples via ficheiro/link `.ics`, sem OAuth nem contas de developer; ou (2) integração real via API (Google Calendar API / Microsoft Graph), com login OAuth2, gestão seguro de tokens de terceiros e mais pontos de falha numa demonstração.

Depois de pesada esta troca, a Sara pivotou o pedido: **"vamos fazer uma simulação então de forma a dar uma demonstração do que se pretende futuramente"** — ou seja, nesta fase constrói-se a funcionalidade de agenda 100% interna à plataforma (sem qualquer ligação externa real), a demonstrar o comportamento pretendido. A ligação real ao Google/Outlook fica registada como possível evolução futura, fora do âmbito desta fase.

### Desenho do fluxo (decisões tomadas com a Sara)

A Sara descreveu o fluxo pretendido em detalhe: o formador define a sua disponibilidade em blocos de 1h (livre, ou bloqueado — ex.: hora de almoço/jantar); a coordenação escolhe um curso, escolhe o formador, e agenda dentro dos blocos livres desse formador, indicando se a aula é presencial ou online; e a coordenação deve conseguir ver a quantidade de horas já agendadas vs. as horas que faltam, por UC.

Para calibrar o modelo de dados, a Sara enviou o seu cronograma real da IEFP (curso 25.0422, formato usado pelo Centro de Emprego e Formação Profissional de Entre Douro e Vouga). Esse documento confirmou o formato esperado: cada UC tem uma carga horária total prevista ("CT"), horas dadas por mês, e um total acumulado ("T") — exatamente a lógica de horas dadas vs. horas em falta pedida. Também mostrou linhas especiais (RESP, REUN, PCT, TPJ) e um "Func. Resp." ao nível do curso — o que motivou o campo `mediadorId` na Turma.

Ficou por confirmar, e foi perguntado diretamente à Sara, se "curso" corresponderia à `Turma` já existente (com um único total de carga horária) ou a uma nova entidade UC/disciplina dentro da Turma — a Sara escolheu a segunda opção, mais fiel ao cronograma real, onde uma Turma tem várias UCs, cada uma com a sua própria carga horária e formador. Também foi perguntado se o "mediador responsável" devia ser uma conta já existente ou só um nome em texto livre — a Sara esclareceu que é sempre **uma conta de formador já existente**, que pode simultaneamente lecionar várias UCs na mesma formação e ser o mediador responsável do curso.

### Modelo de dados

- `Turma` ganhou `idCursoIEFP` (referência opcional, texto livre) e `mediadorId` (FK para um `User` com role FORMADOR — validado no backend).
- `Uc` (nova) — `turmaId`, `abreviatura` (ex.: "UC00034"), `nome`, `cargaHoraria`, `formadorId`. Abreviatura única por turma.
- `Disponibilidade` (nova) — grelha de blocos de 1h por formador: `formadorId`, `data`, `horaInicio`, `estado` (LIVRE/BLOQUEADO), `motivo` opcional (ex.: "Almoço"). Bloco único por formador/data/hora.
- `Aula` (nova) — a marcação em si: `ucId`, `disponibilidadeId` (único — um bloco só pode ter uma aula), `data`/`horaInicio` copiados do bloco, `duracaoHoras` (1h por bloco, para já), `modalidade` (PRESENCIAL/ONLINE).

Migração `20260904103944_add_agenda_uc_disponibilidade_aula` aplicada com sucesso à BD de desenvolvimento e à de teste, com o mesmo procedimento já documentado nas fases anteriores (GRANTs já resolvidos na Fase 8b, e troca de `.env`/`.env.test` para a base de teste).

### Backend

Ficheiros novos em `backend/src/`: `services/uc.service.js`, `controllers/uc.controller.js`, `routes/uc.routes.js` (montada em `/api/v1/ucs`); os mesmos três para `disponibilidade` (`/api/v1/disponibilidade`) e para `aula` (`/api/v1/aulas`). `turmas.service.js`/`turmas.controller.js` atualizados para validar `mediadorId` (tem de ser uma conta com role FORMADOR) e aceitar `idCursoIEFP`. Documentação Swagger atualizada com os schemas `UC`, `Disponibilidade` e `Aula`.

Regras de negócio implementadas no backend (não só no frontend):
- Só a coordenação cria/edita/apaga UCs e agenda/cancela aulas; cada formador só gere a sua própria disponibilidade (nunca a de outro formador).
- Não é possível agendar uma aula num bloco marcado como bloqueado, nem em dois blocos já ocupados por outra aula (o campo `disponibilidadeId` da Aula é único).
- Não é possível agendar horas além da carga horária total da UC — se a UC tem, por exemplo, 50h e já estão as 50h agendadas, o pedido seguinte falha com um erro explícito (`CARGA_HORARIA_EXCEDIDA`), tal como a lógica de "T" vs "CT" do cronograma real da IEFP.
- Cancelar uma aula liberta logo o bloco de disponibilidade para voltar a ser agendado.

### Contratempo: nome do modelo `UC` no Prisma

Ao correr os testes pela primeira vez, todos falharam com `TypeError: Cannot read properties of undefined (reading 'deleteMany')` em `prisma.uc`. Causa: o Prisma só baixa a primeira letra do nome do modelo para gerar o nome do acessor no `PrismaClient` — o modelo `UC` (tudo maiúsculas) ficava acessível como `prisma.uC`, não `prisma.uc`. Corrigido renomeando o modelo para `Uc` no `schema.prisma` (a tabela na base de dados manteve-se `ucs`, por causa do `@@map` — não foi precisa nenhuma migração nova, só correr `npx prisma generate` outra vez). Nota para o relatório: nomes de modelos Prisma com abreviaturas todas em maiúsculas (siglas) merecem atenção redobrada por esta razão.

**Resultado final:** suite de testes completa a passar — **56 testes, 9 suites, todos verdes** (foram acrescentados 17 testes novos: `uc.test.js`, `disponibilidade.test.js`, `aula.test.js`).

### Frontend (mesma sessão, 2026-09-04)

Construído logo a seguir ao backend, seguindo o mesmo padrão visual das restantes páginas (`section-card`, `status-table`, `modal`, `badge`):

- **`src/pages/agendaFormador.html` + `src/js/agendaFormador.js`** (nova página, só formador) — grelha semanal visual (Dom-Sáb × 08:00-21:00, com navegação semana anterior/seguinte e botão "Hoje"). Cada célula alterna com um clique: por definir → Livre → Bloqueado (pede motivo opcional, ex. "Almoço") → por definir outra vez. Células com aula já agendada pela coordenação aparecem a azul e não são editáveis aqui. Link "A Minha Agenda" acrescentado ao menu lateral do formador (`dashboardFormador.html`).
- **`src/pages/agenda.html` + `src/js/agenda.js`** (coordenação, substituiu o placeholder) — escolher uma turma, ver as suas UCs numa tabela (com horas dadas/em falta calculadas pelo backend), criar/editar/apagar UCs (modal com abreviatura, nome, carga horária, formador). Botão "Agendar" por UC abre um painel com a mesma grelha semanal, mas em modo de seleção: só os blocos verdes (livres) do formador responsável são clicáveis; ao clicar, escolhe-se a modalidade (Presencial/Online) e confirma-se, criando a Aula. Lista de aulas já agendadas nessa UC, com botão de cancelar.
- **`src/pages/turmas.html` + `src/js/turmas.js`** (atualizado) — o modal de criar/editar turma ganhou os campos "ID de Curso IEFP" (texto livre) e "Mediador Responsável" (select com os formadores existentes).
- **`src/js/calendarioSemana.js`** (novo, partilhado) — funções de datas usadas pelas duas grelhas (início da semana, formatação, etc.), para não duplicar essa lógica.
- CSS novo em `src/css/style.css` (secção 14) para a grelha semanal (`.agenda-grid`, `.agenda-celula` e os estados livre/bloqueado/agendado/indisponível).

### Por testar (próximo passo com a Sara)

- Ciclo completo no browser: coordenação cria turma com mediador → cria UC → formador marca disponibilidade em `agendaFormador.html` → coordenação agenda aula em `agenda.html` → confirmar que as horas dadas/em falta atualizam e que o bloco fica marcado como "Aula" na grelha do formador.

### Novo documento: `COMO_TESTAR.md` (2026-09-04)

A Sara pediu os comandos de terminal para arrancar o projeto e testar a Agenda no Visual Studio Code, e que ficassem guardados num documento próprio (em vez de só na conversa), com a decisão também registada aqui. Criado `COMO_TESTAR.md` na raiz do projeto, com os comandos exatos de `npm run dev` (backend) e `npx serve src -l 5500` (frontend, confirmados a partir do `README.md`), o passo a passo para testar a Agenda com dois papéis em simultâneo (duas janelas do browser), o comando `npm test`, e uma secção de comandos extra (Prisma Studio, `migrate dev`/`generate`) com nota sobre o erro `EPERM` já conhecido. Critério para decidir se algo fica na conversa ou vira documento: comandos e passos que a Sara vai repetir em sessões futuras (arrancar o projeto, testar) ficam em ficheiro; decisões e histórico de uma sessão específica continuam só aqui no `PLANEAMENTO.md`.

### Correção visual: cartão "Turma" na Agenda (2026-09-04)

A Sara testou a página `agenda.html` no browser e reportou que "o painel da agenda está horrível", com prints do topo da página mostrando o cartão "Turma" (título + seletor de turma) com um aspeto desequilibrado/inacabado. Pedi um print para perceber o problema e, ao inspecionar o HTML/CSS diretamente (não há como abrir o browser da Sara a partir daqui), identifiquei a causa raiz:

- A classe `.input-group` (label + campo) foi originalmente pensada para a página de login/registo, com fundo escuro (`background: #0f172a`) — por isso `.input-group label` tem `color: #cbd5e1` (cinza-azulado claro) e não existia nenhum estilo para `<select>`.
- Essa classe já era reutilizada dentro de modais (`turmas.html`, `formadores.html`), mas aí existe uma regra `.modal .input-group input, .modal select` que repõe cores claras (fundo branco/cinza claro, texto escuro) — por isso nos modais nunca se notou o problema.
- O cartão "Turma" da Agenda usa `.input-group` diretamente dentro de um `.section-card` (fundo branco), fora de qualquer modal — por isso a label ficava quase invisível (cinza claro sobre branco) e o `<select>` ficava sem qualquer estilo (aparência nativa do browser), dando o aspeto "vazio"/inacabado que a Sara viu. O mesmo problema afetava o seletor de "Modalidade" no painel de confirmação de agendamento, mais abaixo na mesma página.
- Correção aplicada em `src/css/style.css` (secção antes da "14. AGENDA"): novas regras `.section-card .input-group label`, `.section-card .input-group select/input` e respetivo `:focus`, repondo cores claras sempre que `.input-group` for usado fora de um modal — cobre a Agenda e qualquer página futura que reutilize o mesmo padrão.
- Aproveitei para compactar o cartão "Turma" em `src/pages/agenda.html`: label e seletor passam a ficar lado a lado (`display:flex; align-items:center`) em vez de empilhados a ocupar largura desnecessária, reduzindo o espaço em branco à volta do único campo do cartão.

Ficheiros alterados: `src/css/style.css`, `src/pages/agenda.html`. Não fica nenhuma alteração pendente do lado do backend nem de base de dados — é só CSS/HTML. Próximo passo: a Sara volta a testar no browser (`Ctrl+F5` para garantir que o CSS novo é recarregado) e confirma se o cartão já não parece "cortado"/vazio.

### Refactor: UCs passam a catálogo reutilizável, associado a turmas (2026-09-04)

A Sara reviu o modelo da Agenda depois de testar e pediu uma correção de fundo: "as ucs devem ser administradas por fora, ou seja varios cursos podem ter varias ucs associadas e varios formadores". Discussão e decisões, confirmadas por três perguntas diretas:

1. **Onde vive a gestão do catálogo de UCs?** A Sara escolheu uma opção híbrida: o catálogo existe como conceito próprio (não pertence a uma única turma), mas a gestão (criar UC, associá-la a uma turma, escolher o formador) faz-se a partir de "cursos ou turmas" — ou seja, dentro de `turmas.html`/Gestão Turmas, não dentro da página Agenda. A Agenda passa a ser só para agendar aulas (calendário), não para gerir UCs.
2. **O formador pode variar por turma?** Sim — a mesma UC (ex: mesmo código/abreviatura) pode ser lecionada por formadores diferentes consoante a turma onde é dada.
3. **A carga horária é fixa ou varia por turma?** Fixa no catálogo — reflete o referencial de formação e não muda consoante a turma.

**Alterações ao modelo de dados** (`backend/prisma/schema.prisma`):
- `Uc` deixa de ter `turmaId`/`formadorId` — passa a ser só o catálogo: `abreviatura` (única), `nome`, `cargaHoraria`.
- Nova entidade `TurmaUc` — a associação entre uma turma e uma UC do catálogo, com o `formadorId` que a leciona nessa turma especificamente. `@@unique([turmaId, ucId])` — uma turma não pode ter a mesma UC associada duas vezes.
- `Aula.ucId` passa a `Aula.turmaUcId` — uma aula agora aponta para a associação Turma+UC (não diretamente para a UC do catálogo), porque é aí que está definido o formador responsável e a carga horária dessa instância da UC nessa turma.
- Nova migração necessária (a criar/aplicar pela Sara, ainda por fazer): `npx prisma migrate dev --name uc-catalogo-turma-uc`.

**Backend (mesma sessão):**
- `uc.service/controller/routes.js` reescritos — CRUD do catálogo (`GET/POST /api/v1/ucs`, `PATCH/DELETE /api/v1/ucs/:id`), sem turma/formador.
- Novos `turmaUc.service/controller/routes.js` — CRUD da associação (`GET /api/v1/turma-ucs/turma/:turmaId`, `POST /api/v1/turma-ucs`, `PATCH/DELETE /api/v1/turma-ucs/:id`), com `horasDadas`/`horasEmFalta` calculadas por associação (não por UC global) — a mesma UC usada em duas turmas tem progresso independente em cada uma.
- `aula.service/controller/routes.js` atualizados para `turmaUcId` (rota `GET /api/v1/aulas/turma-uc/:turmaUcId`); a validação de "bloco pertence ao formador certo" passa a comparar com `turmaUc.formadorId`.
- `disponibilidade.service.js` e `app.js` ajustados para os novos nomes/rotas. `swagger.js` com schemas `UC` e `TurmaUC` separados.
- Testes (`uc.test.js`, `aula.test.js`, novo `turmaUc.test.js`, `helpers.js`) — por terminar de atualizar nesta mesma sessão.

**Trabalho concluído nesta sessão** (a seguir ao registo acima):
- Testes automatizados atualizados: `uc.test.js` (catálogo, 6 testes), novo `turmaUc.test.js` (associação Turma+UC+Formador, 6 testes), `aula.test.js` (atualizado para `turmaUcId`, 6 testes) — mantém-se por confirmar com `npm test` no PC da Sara (contagem esperada: **10 suites / 62 testes**, a confirmar).
- Frontend: gestão de UCs movida de `agenda.html` para `turmas.html` — novo botão "Gerir UCs" (ícone de livros) em cada linha da tabela de turmas, abre modal com: lista de UCs associadas (com formador editável inline e opção de remover), formulário para associar uma UC do catálogo já existente, e formulário para criar UC nova no catálogo. `agenda.js`/`agenda.html` simplificados — já não criam/editam UCs, só listam as UCs associadas à turma escolhida (via `GET /turma-ucs/turma/:turmaId`) e agendam aulas (`turmaUcId` em vez de `ucId`). `COMO_TESTAR.md` atualizado com o novo fluxo de teste (secção 4).
- `.env.test.example` criado (não existia nenhum template para a base de dados de testes). `COMO_TESTAR.md` ganhou uma secção 7 com o comando para gerar um ficheiro `.sql` de criação da base de dados a partir do `schema.prisma` (`npx prisma migrate diff --from-empty ...`), a correr pela Sara quando precisar dele para o relatório.

**Por fazer a seguir (mão da Sara, no VS Code)**:
1. `cd backend && npx prisma migrate dev --name uc-catalogo-turma-uc` — cria e aplica a migração à base de dados de desenvolvimento. **Atenção**: como a tabela `ucs` perde as colunas `turmaId`/`formadorId` e a `aulas` muda de `ucId` para `turmaUcId`, o Prisma vai avisar de perda de dados nas UCs/aulas de teste já criadas nesta sessão — é esperado e seguro aceitar (são só dados de teste).
2. `npx prisma generate` (repetir se der o erro `EPERM` já conhecido).
3. Repetir os passos 1-2 na base de dados de testes (trocar `.env`/`.env.test` como das outras vezes) e depois `npm test` para confirmar os 62 testes.
4. Testar o fluxo completo no browser seguindo `COMO_TESTAR.md`, secção 4 (agora passa por Gestão Turmas).
5. Quando fizer sentido para o relatório: gerar o `database_schema.sql` (comando em `COMO_TESTAR.md`, secção 7).

### Confirmado: migração aplicada e 62/62 testes a passar (2026-09-04)

A Sara aplicou a migração `uc-catalogo-turma-uc` à base de dados de desenvolvimento sem incidentes (só o já conhecido `EPERM` no `generate`, resolvido fechando processos Node). Na base de dados de testes apareceu um problema novo: ao trocar `.env`/`.env.test` para lá aplicar a mesma migração, descobriu-se que os ficheiros já estavam trocados há semanas (um resto de uma troca antiga de 30/07, nunca reposta — `.env` tinha ficado com as credenciais de teste e `.env.dev.bak` com as de desenvolvimento, sem nenhum `.env.test`). O `npx prisma migrate deploy` correu contra a base de testes certa mas disse "No pending migrations to apply" apesar de faltar a tabela `turma_ucs` — o histórico de migrações dessa base tinha ficado dessincronizado da estrutura real.

Resolvido com `npx prisma migrate reset` (com o `.env` a apontar para a base de testes, confirmado pelo nome antes de confirmar) — recriou a base de testes do zero a partir das 4 migrações e corrigiu a dessincronização. Depois disso, `ren .env .env.test` + `ren .env.dev.bak .env` repuseram os nomes corretos. Resultado: **Test Suites: 10 passed, Tests: 62 passed** — confirma os números previstos no registo acima.

**Nota para o futuro**: se voltar a aparecer confusão com `.env`/`.env.test` (ficheiros trocados, `.env.dev.bak` a aparecer), o mais seguro é sempre confirmar com `dir .env*` (nomes e tamanhos) antes de qualquer `ren`, e nunca assumir que os nomes estão como esperado — já aconteceu duas vezes ficarem trocados sem se dar por isso.

**Por fazer a seguir**: testar o fluxo completo no browser (`COMO_TESTAR.md`, secção 4 — Gestão Turmas → criar UC + associar → Agenda → agendar aula).

### Efeito secundário da correção do cartão "Turma" (2026-09-04)

Ao testar, a Sara reparou que o `<select>` "Estado Inicial" no modal de Editar Turma (`#new-estado`) deixou de mostrar texto nenhum. Causa: a regra `.section-card .input-group select` criada mais cedo (correção do cartão "Turma" da Agenda) aplicava `padding: 10px 12px` a **todos** os selects dentro de `.section-card .input-group` — incluindo o `#new-estado`, que já tinha o seu próprio estilo dedicado (`class="badge yellow"`, caixa de 26px de altura). O padding extra dentro de uma caixa tão baixa esmagava o texto até ficar invisível (não era um problema de dados nem de cor). Corrigido excluindo selects `.badge` da regra (`select:not(.badge)`), para não voltar a acontecer com outros selects "badge" (`#filtro-turmas`, etc.).

### Botões "Associar UC" / "Nova UC no catálogo" empilhados (2026-09-04)

No modal "UCs da turma", os dois botões apareciam um em cima do outro em vez de lado a lado. Causa: `.btn-login` é sempre `display: block` (ocupa a linha toda) — o `style="width: auto"` que lhes tinha posto não chega para os pôr lado a lado, porque `display:block` força sempre quebra de linha independentemente da largura. Corrigido: os dois botões passaram a estar dentro de um `<div style="display:flex">`, e o `.btn-login` ganhou `display: inline-block` inline. O mesmo ajuste foi feito ao botão "Criar UC no catálogo" (sub-formulário), para não ficar esticado à largura toda sem motivo.

### Novo `CHANGELOG.md` (2026-09-04)

A Sara pediu um changelog do projeto, para ir incrementando com as alterações. Criado `CHANGELOG.md` na raiz do projeto — registo cronológico e resumido (datas + o que mudou), da mais recente para a mais antiga, populado retroativamente com o histórico já conhecido (Fase 0-4, Fase 8/8b, relatório/apresentação, Fase 6 — Agenda, e as alterações de hoje). Diferença em relação ao `PLANEAMENTO.md`: o `PLANEAMENTO.md` guarda a discussão, as decisões e os "porquês"; o `CHANGELOG.md` é só a lista resumida do "o que mudou e quando", para consulta rápida (e para citar no relatório, se fizer sentido). A partir de agora, vou manter os dois atualizados em paralelo sempre que houver alterações relevantes.

### Modais esticados até ao fundo do ecrã, com espaço em branco (2026-09-04)

A Sara reparou que o modal "UCs da turma" tinha muito espaço em branco por baixo do conteúdo e pediu para a janela ser um pouco maior. Ao investigar o "muito espaço em branco", encontrei a causa raiz: `.modal-content` partilha a classe `.section-card`, que tem `height: 100%` (pensada para os cartões da Visão Global ficarem todos com a mesma altura dentro de uma grelha) — essa regra estava a esticar **todos** os modais da aplicação até 100% da altura do ecrã, não só este. Corrigido na base (`.modal-content` ganhou `height: auto; max-height: 90vh; overflow-y: auto;`), o que beneficia todos os modais existentes, não só o novo. Também aumentei a largura deste modal em particular de 720px para 860px, como pedido.

### "UCs da turma" passa de modal a página dedicada (2026-09-04)

Depois de ver o modal já corrigido (largura e altura), a Sara pediu para isto ser antes uma página própria, não um modal. Criada `src/pages/turmaUcs.html` + `src/js/turmaUcs.js` — página completa (sidebar/top-bar iguais às outras, "Gestão Turmas" marcado como ativo), identificada pela turma via query string (`turmaUcs.html?turmaId=123`). Como não existe `GET /turmas/:id` no backend, a página carrega a lista completa (`GET /turmas`) e filtra pelo id no browser — mesmo padrão já usado noutros sítios do frontend, evita ter de criar uma rota nova só para isto. Removido o modal `#modal-turma-ucs` de `turmas.html` e toda a lógica correspondente de `turmas.js`; o botão "Gerir UCs" de cada turma passa a navegar para a nova página (`window.location.href`) em vez de abrir um modal.

### Novo `GUIA_RAPIDO.md` (2026-09-04)

A Sara pediu também um ficheiro-guia curto na raiz do projeto (`GUIA_RAPIDO.md`) para quem trabalhe aqui. Ao contrário do `PLANEAMENTO.md`/`CONTEXTO.md` (extensos, para consulta detalhada), é propositadamente curto: aponta para os outros documentos, lista as convenções obrigatórias (escrever em PT-PT, documentar decisões, comandos de arranque) e regista as armadilhas já conhecidas (bug do `EPERM`, troca de `.env`/`.env.test`, nomes de modelos Prisma em maiúsculas, `prisma generate`/`npm install` corridos sempre pela Sara no terminal dela) — para não se perder tempo a redescobri-las mais tarde.

## Visão futura — papel Formando e funcionalidades avançadas

> Ideias trazidas por Sara em 2026-09-01, para explorar na disciplina de Trabalho de Projeto (com a formadora responsável). Âmbito maior que as Fases 5-7 e ainda sem sessões estimadas — decompor em fases concretas quando entrarmos em cada bloco.

### Formando (papel já existe no enum `Role` desde a Fase 8b; dashboard próprio desde 2026-09-09 — ver PLANEAMENTO.md, "Dashboard do Formando", mais abaixo)

- ~~Consulta da turma: horário, formador, UC atual~~ — feito em 2026-09-09 (`dashboardFormando.html`). Falta a lista de colegas de turma (fica para quando houver necessidade real disto).
- Consulta de notas por UC.
- Submissão de justificações de falta (com anexo, associada a um dia/aula).
- Comunicação: formulário dirigido à coordenação, ao formador ou à assistente social.

### Formador (funcionalidades novas)

- Submissão de notas por formando/UC.
- Atribuição de trabalhos, com área de submissão própria (reaproveita o padrão de upload já usado em Entregas).
- Comunicação com o coordenador.
- Alocação de disponibilidade na agenda: o formador marca blocos de 1h como livres; o coordenador só pode agendar aulas dentro desses blocos (liga-se à entidade `Disponibilidade` já prevista na Fase 6).
- Consulta da própria assiduidade e do estado de cada UC que leciona.

### Coordenador (funcionalidades novas)

- Atribuição de uma UC/disciplina a um curso: carga horária (26h ou 50h), descritivo e formador responsável.
- Agendamento de aulas restrito aos blocos livres marcados pelos formadores (valida contra `Disponibilidade`).

### Outras ideias a considerar (sugestões a validar com a formadora)

- Notificações (in-app e/ou email) para novos prazos, notas lançadas ou respostas a uma comunicação.
- Exportação de pautas e relatórios em PDF.
- Histórico de alterações a notas — auditoria simples, alinhada com o checklist RGPD.
- Painel de assiduidade agregado por turma (visão do formador) e individual (visão do formando).
- Validação de sobreposição de horários ao agendar aulas.
- Reenvio de trabalhos até ao prazo (versões da submissão, não só o último ficheiro).

### Impacto previsível no modelo de dados (a confirmar em desenho técnico)

- ~~Novo valor no enum `Role`: `FORMANDO`~~ — feito na Fase 8b (2026-09-02). ~~Ligação a uma Turma~~ — feito em 2026-09-09 (`User.turmaId`, ver "Dashboard do Formando" mais abaixo). Ainda não existe uma entidade `Formando` própria com dados específicos além disso (notas, assiduidade, etc. — para quando esses pontos forem desenhados).
- Novas entidades prováveis: `Nota`, `Justificacao`, `Trabalho` + `SubmissaoTrabalho`, `Mensagem`/`Comunicacao` (com um campo de destinatário: coordenação, formador ou assistente social).
- `Curso` como entidade separada de `Turma`, com várias UCs associadas (carga horária + formador por UC).
- `Disponibilidade` (já prevista na Fase 6) passa a ser também a restrição usada no agendamento de aulas pelo coordenador.

### Notas soltas da Sara — por explorar (2026-09-04)

Lista de ideias trazidas pela Sara nesta sessão, ainda sem desenho técnico — a validar e detalhar antes de implementar:

- ~~**Notas dos formadores: flag em vez de eliminar registos.**~~ — feito em 2026-09-04, ver "Implementado: 'flag em vez de eliminar' (soft delete)" mais abaixo. Âmbito confirmado com a Sara nessa altura: aplica-se a User, Turma, Uc, TurmaUc e Entrega (mais Disponibilidade, por ter o mesmo problema).
- ~~**Bloquear um dia inteiro na Agenda.**~~ — feito em 2026-09-08, botão "Bloquear dia" em `agendaFormador.html`. Ver `CHANGELOG.md`.
- ~~**Pedidos de Acesso via um perfil de Recursos Humanos.**~~ — feito em 2026-09-10, ver "Implementado: Pedidos de Acesso via RH" mais abaixo. Das duas variantes aqui descritas, a Sara escolheu a (b) — sem novo papel na aplicação.
- ~~**Email a informar alterações feitas.**~~ — feito em 2026-09-09, âmbito reduzido a atribuições concretas (ver "Implementado: Notificações por email" mais abaixo).
- ~~**Alterações de UCs também devem notificar por email**~~ — feito em 2026-09-09, ver mesma entrada.
- ~~**Rever o tratamento de erros.**~~ — feito em 2026-09-09, ver "Auditoria e correção: consistência dos códigos de erro" mais abaixo.
- ~~**Estudar as rotas e verificar permissões.**~~ — feito em 2026-09-09, ver "Auditoria de rotas e permissões" e "Corrigido: gaps de permissões encontrados na auditoria" mais abaixo.

Nenhum destes pontos foi ainda desenhado tecnicamente nem tem sessão estimada — ficam aqui registados para não se perderem, e para se discutir com a Sara qual atacar primeiro.

### Critério de "feito" por fase

Cada fase termina com: testes automatizados a passar (`npm test` no `backend/`) + teste manual do fluxo completo no browser + commit com mensagem descritiva. Não avançar de fase com testes ou consola com erros.

### 2026-09-04 — Implementado: "flag em vez de eliminar" (soft delete)

Retoma o primeiro ponto das "Notas soltas da Sara" acima. Discussão com a Sara sobre o âmbito (pergunta feita, respondida "todas as entidades acima"): aplica-se a **Formadores (utilizadores), Turmas, UCs do catálogo, associação Turma+UC, e Entregas**, mais **Disponibilidade** (blocos de agenda) por ter o mesmo problema.

**Ficou de fora: Aula (cancelamento de aulas).** `aula.service.js#cancelar` continua a fazer `DELETE` definitivo. Motivo: `Aula.disponibilidadeId` é `@unique` na base de dados — é essa restrição que garante que nunca há duas aulas no mesmo bloco (a regra "não deixa agendar duas aulas no mesmo bloco"). Passar `Aula` a soft-delete implicava ou (a) remover essa restrição e passar a garantir "no máximo uma aula *ativa* por bloco" só a nível de aplicação (viável, é o mesmo padrão já usado nas outras regras de negócio deste projeto, mas é uma mudança de risco mais alto ao contrato de agendamento), ou (b) mudar a relação `Disponibilidade.aula` de 1:1 para 1:N no Prisma, o que obriga a rever `aula.service.js`, `disponibilidade.service.js` e o frontend que consome `disponibilidade.aula`. Ficou registado aqui como trabalho futuro, a atacar isoladamente.

**O que mudou (backend):**

- Novo campo `ativo Boolean @default(true)` em `User`, `Turma`, `Uc`, `TurmaUc`, `Entrega`, `Disponibilidade` (schema.prisma).
- Em cada um destes serviços, `apagar`/`remover` deixou de fazer `prisma.X.delete()` e passou a fazer `prisma.X.update({ data: { ativo: false } })`. `listar()`/`listarPor*()` passaram a filtrar `ativo: true` por omissão, com um parâmetro novo `?incluirInativos=true` para ver tudo (usado pela UI para o filtro "Mostrar desativados").
- Novo endpoint `PATCH /:id/reativar` (marca `ativo: true`) em formadores, turmas, ucs e turma-ucs — protegido pelas mesmas regras de acesso que já existiam no `DELETE` de cada um (nota: `turmas` e `formadores` continuam sem `requireRole`, ou seja qualquer utilizador autenticado pode apagar/reativar — isto já era assim antes desta alteração, não é uma regressão; fica para a auditoria de permissões pendente, ver "Notas soltas" acima). `Disponibilidade` não tem `reativar` próprio — redefinir o bloco (o mesmo `upsert` que já existia) volta a marcá-lo `ativo: true`, por isso não precisa de um endpoint novo.
- **As guardas antigas que bloqueavam o `DELETE` foram removidas** (deixaram de fazer sentido, já que nada é destruído): `UC_ASSOCIADA_A_TURMAS` (uc.service) e `TURMA_UC_COM_AULAS` (turmaUc.service) já não existem. Em ambos os casos, essas guardas existiam só para evitar que o `DELETE` falhasse com um erro de chave estrangeira (o que já acontecia silenciosamente noutros pontos, ver bug abaixo) — com soft delete deixam de ser precisas.
- **Bug real corrigido de caminho:** apagar um Formador ou uma Turma que já tivesse histórico associado (entregas, UCs lecionadas, disponibilidades) **falhava** antes desta alteração — o `DELETE` definitivo era recusado pela base de dados (chave estrangeira) e o pedido rebentava com um erro. Não havia proteção nenhuma como a da UC/TurmaUc, porque ninguém tinha reparado neste caso. Com soft delete isto passa a funcionar sempre.
- **Regras novas de "não usar o que está inativo":** associar uma UC do catálogo a uma turma, ou atribuir um formador a uma UC/turma, ou definir um mediador de turma, passou a verificar que a Turma/UC/Formador em causa está `ativo` (novos erros `TURMA_INATIVA`, `UC_INATIVA`, `FORMADOR_INATIVO`, `MEDIADOR_INATIVO`). Agendar uma aula numa associação Turma+UC desativada também passou a ser recusado (`TURMA_UC_INATIVA`).
- **Login e sessões:** fazer login com uma conta desativada passa a ser recusado (`403 CONTA_INATIVA`). Além disso, o middleware `requireAuth` passou a confirmar `ativo` na base de dados a cada pedido (antes só validava o JWT) — por isso, se uma conta for desativada enquanto o utilizador tem sessão iniciada, o acesso é cortado no pedido seguinte, sem ter de esperar o token expirar (7 dias). Isto tem um custo: cada pedido autenticado passou a fazer uma consulta extra à base de dados; para a escala deste projeto não é relevante, mas fica registado.
- **Reaproveitar identificadores únicos:** `email` (User), `codigo` (Turma) e `abreviatura` (Uc) continuam `@unique` na base de dados — mesmo inativo, um registo continua a "ocupar" o seu identificador. Criar um novo registo com o mesmo identificador de um que está inativo **reativa esse registo antigo** (atualizando os seus dados) em vez de dar erro de duplicado ou criar uma linha nova — isto evita perder o histórico ligado ao id antigo (ex.: recriar um formador com o mesmo email volta a ligar-lhe as entregas que já tinha). É um comportamento deliberado, não uma limitação, mas convém que a Sara saiba que "criar" com um identificador repetido pode na verdade estar a reativar algo antigo. **Nota:** isto só foi feito em `formadores.service.js#criar` (o botão "Novo Formador" em Gestão de Formadores). O fluxo de aprovar um Pedido de Acesso (`pedidosAcesso.service.js#aprovar`) continua a recusar com `EMAIL_IN_USE` se o email já existir, mesmo que a conta esteja inativa — não foi alterado porque usa uma `$transaction` de array (para criar o utilizador e marcar o pedido como aprovado atomicamente) que precisava de passar a `$transaction` interativa para poder ramificar entre criar/reativar; fica por fazer, é um caso raro (só acontece se se aprovar um pedido com o mesmo email de um formador previamente desativado).

**O que mudou (frontend):** em Formadores, Gestão de Turmas, e na página de UCs de uma turma (`turmaUcs.html`), o botão de apagar passou a chamar-se "Desativar" no texto de confirmação, e cada uma destas três páginas ganhou uma checkbox "Mostrar desativados/as" que, quando marcada, mostra também as linhas inativas (a cinzento, com uma badge "DESATIVADO/A") com um botão de reativar. Nas Entregas (`dashboardCoord.js`) e na Agenda do formador (`agendaFormador.js`) só o texto de confirmação foi atualizado — não têm ainda uma vista de "mostrar desativados"; fica como possível melhoria futura, não é urgente porque Entregas não tem muito histórico a recuperar e Disponibilidade já se auto-reativa ao voltar a marcar o bloco.

**Testes:** os testes que validavam as guardas antigas (`UC_ASSOCIADA_A_TURMAS`, `TURMA_UC_COM_AULAS`) foram reescritos para confirmar o novo comportamento (já não bloqueiam, o registo fica só inativo). Foram acrescentados testes novos para: listagens a filtrar por omissão e com `?incluirInativos=true`, `reativar` em formadores/turmas/ucs/turma-ucs/entregas, login e `requireAuth` a cortar acesso a conta desativada, reaproveitar identificador único ao recriar, e a nova regra `TURMA_UC_INATIVA` ao tentar agendar aulas.

**Falta fazer (a própria Sara tem de correr no terminal dela, como sempre — ver `GUIA_RAPIDO.md`):**

1. `cd backend`
2. `npx prisma migrate dev --name flag_em_vez_de_eliminar` (gera e aplica a migração à base de dados de desenvolvimento; se aparecer o erro EPERM conhecido, fechar processos Node e repetir).
3. Aplicar a mesma migração à base de testes (troca temporária de `.env`/`.env.test`, como das outras vezes — ver `COMO_TESTAR.md` e a armadilha já documentada no `GUIA_RAPIDO.md`) e depois `npm test` — a lista de testes cresceu bastante, por isso convém correr e confirmar que fica tudo verde antes de continuar a usar a plataforma.

**Confirmado (2026-09-08):** a Sara aplicou a migração `20260904153719_flag_em_vez_de_eliminar` à base de testes e correu `npm test` — **10 suites / 75 testes, tudo a passar**. Os ficheiros `.env`/`.env.test` ficaram bem trocados de volta no fim (confirmado). Esta funcionalidade está concluída e verificada de ponta a ponta.

### 2026-09-08 — Correção visual: select "Formador" a aparecer azul sólido em `turmaUcs.html`

A Sara reportou (com screenshot) que a página de UCs de uma turma "não parece estar muito bem" — em concreto, o select "Formador" de cada linha aparecia com fundo azul sólido e texto branco, ao contrário do select "UC do catálogo" ao lado, que aparece corretamente com o estilo claro do resto da aplicação.

Investigação: não é uma classe `.badge` (essas têm um azul claro, `#eff6ff`, não o azul sólido do screenshot), nem há nenhuma regra CSS a apontar especificamente a este select, nem há nenhum JS a injetar uma classe diferente. A causa mais provável é uma particularidade do Windows com tema escuro do sistema: o Chrome/Edge pode pintar um `<select>` fechado com a cor de destaque nativa do SO (azul) em vez do estilo CSS definido, tipicamente no select que tem o foco inicial da página — a não ser que o CSS declare explicitamente `color-scheme: light` nesse elemento.

**Correção aplicada:** acrescentado `color-scheme: light;` à regra `.section-card .input-group select:not(.badge), .section-card .input-group input` em `src/css/style.css`, com um comentário a explicar o motivo. Esta regra já era a que definia o estilo claro (fundo `#f8fafc`, texto escuro) para estes selects fora dos modais — por isso aplica-se automaticamente a todas as páginas que já usavam este padrão, não só `turmaUcs.html`.

**Por confirmar pela Sara:** fazer hard-refresh (Ctrl+F5) na página e verificar se o select "Formador" passa a aparecer com o estilo claro correto.

**Ainda por esclarecer:** a Sara também mencionou que a tabela "UCs associadas a esta turma" não parecia bem — revi o código de `carregarTurmaUcs()` em `turmaUcs.js` e da rota/serviço correspondentes no backend (`listarPorTurma`) e não encontrei nenhum bug óbvio que explicasse uma área em branco sem a mensagem "Ainda não há UCs associadas a esta turma." — o código parece correto de ponta a ponta. Fica pendente confirmação da Sara com mais detalhe (ou um novo screenshot) sobre o que exatamente parece errado nessa tabela.

### 2026-09-08 — Correção: perder o `turmaId` do endereço ao criar UC no catálogo em `turmaUcs.html`

Seguindo a investigação da entrada anterior: a Sara confirmou o percurso — "gerir turma" (entra bem, com `?turmaId=...` no endereço) e depois "adicionar uc ao catálogo" (o formulário "Nova UC no catálogo") — e mandou um screenshot a mostrar o ecrã "Turma não encontrada" a seguir a isso, com a tabela e os selects todos vazios.

**Causa:** nenhum dos `<form>` desta página tinha o atributo `action` definido. O JavaScript intercepta sempre o `submit` com `e.preventDefault()`, por isso em condições normais nunca chega a acontecer um envio nativo do formulário — mas se por alguma razão (ex.: o clique acontecer antes do script `defer` acabar de correr, numa ligação/máquina mais lenta) o evento não for interceptado a tempo, o browser faz um envio nativo GET ao endereço atual, o que **substitui a query string existente** (`?turmaId=7`) pelos campos do formulário (`?catalogo-abreviatura=...&catalogo-nome=...`). Sem `turmaId` no endereço, a página cai na proteção "Turma não encontrada" — o que também explica por que motivo a tabela ficava em branco sem a mensagem "Ainda não há UCs associadas a esta turma.": o `iniciar()` nunca chega a ser chamado sem `turmaId`, por isso `carregarTurmaUcs()` nunca corre.

**Correção aplicada:** acrescentado `action="javascript:void(0);"` aos dois formulários desta página (`form-associar-uc` e `form-nova-uc-catalogo`) — mesmo que o envio nativo aconteça por alguma razão, deixa de haver navegação nenhuma, em vez de apagar o `turmaId` do endereço.

**Nota para o futuro:** confirmei que nenhum formulário do projeto tem `action` definido (é o mesmo padrão em `formadores.html`, `turmas.html`, `login.html`, etc.) — normalmente é inofensivo porque o JS intercepta sempre o submit, mas `turmaUcs.html` é a única página cujo funcionamento depende de um parâmetro no endereço, por isso foi a única onde este problema teórico se manifestou de forma visível. Pode valer a pena aplicar o mesmo `action="javascript:void(0);"` de forma preventiva aos restantes formulários — fica como sugestão, não feito ainda (a confirmar com a Sara se quer isso).

**Por confirmar pela Sara:** repetir o mesmo percurso (Gerir UCs → Nova UC no catálogo → Criar UC no catálogo) e confirmar que o endereço mantém o `turmaId` no fim.

**Atualização (mesmo dia):** a Sara pediu para aplicar a mesma correção preventivamente ao resto da aplicação. Acrescentado `action="javascript:void(0);"` a todos os outros formulários do projeto: `dashboardCoord.html` (form-novo-aviso), `dashboardFormador.html` (form-submeter-documento, form-excecao), `formadores.html` (form-novo-formador), `forms.html` (form-pedido), `login.html` (form-login), `pedidosAcesso.html` (form-aprovar), `perfil.html` (form-perfil), `turmas.html` (form-nova-turma). Todos os formulários do projeto (`grep -rn '<form' src/pages/*.html`) têm agora este atributo.

### 2026-09-08 — Implementado: "Bloquear dia inteiro" na Agenda do formador

Retoma o primeiro ponto das "Notas soltas da Sara": até agora, bloquear um dia inteiro na Agenda obrigava a clicar bloco a bloco (14 blocos de 1h, das 8h às 21h — duas vezes cada, por definir → livre → bloqueado). Escolhido pela Sara como próximo ponto a atacar.

**O que mudou:** cada coluna de dia da grelha da Agenda (`agendaFormador.html`) ganhou um botão pequeno "Bloquear dia" no cabeçalho. Ao clicar: pergunta o motivo (opcional, partilhado por todos os blocos desse dia), pede confirmação a dizer quantos blocos vai bloquear, e depois marca como `BLOQUEADO` todos os blocos desse dia que ainda estejam "por definir" ou "livre" — sem tocar nos que já têm uma aula agendada nem nos que já estavam bloqueados (para não sobrescrever um motivo já definido à mão).

**Decisão técnica:** não foi criado nenhum endpoint novo no backend — o botão limita-se a chamar o `POST /disponibilidade` já existente uma vez por bloco a bloquear (`Promise.allSettled`, em paralelo), o mesmo pedido que cada clique individual já fazia. Não é atomico (se uma das chamadas falhar a meio, as outras já podem ter sido aplicadas), mas para este projeto (uso pessoal do formador, no máximo 14 pedidos de cada vez) não se justificou complicar com uma transação no backend só para isto — fica anotado caso um dia se torne relevante. O toast final avisa se alguma chamada falhou, e a grelha é sempre recarregada a seguir para refletir o estado real.

**Por confirmar pela Sara:** testar na Agenda do formador — abrir um dia com alguns blocos já definidos (livre/bloqueado/aula) e outros por definir, clicar "Bloquear dia", e confirmar que só os blocos "por definir"/"livre" mudam, com o motivo indicado.

### 2026-09-08 — Corrigido: mensagem de erro genérica no login

Bug pequeno encontrado numa sessão anterior (ao testar o login pela minha parte, tinha ficado por corrigir): em `src/js/auth.js`, o `catch` do formulário de login mostrava sempre "As credenciais estão incorretas. Tenta novamente.", fosse qual fosse a causa real do erro — password errada, conta desativada (`CONTA_INATIVA`), ou até o backend estar em baixo. Isto escondia o problema real do utilizador (ex.: uma conta desativada parecia sempre "password errada").

**Correção:** `auth.js` passa agora a mostrar `error.message` (a mensagem real devolvida pela API, ex.: "As credenciais estão incorretas.", "Esta conta foi desativada."), com uma mensagem genérica só como último recurso.

**Aproveitado para melhorar também `api-client.js`:** o `fetch()` que todas as páginas usam não tinha nenhum tratamento para falhas de rede (backend em baixo, sem ligação) — nesses casos o erro que chegava ao ecrã era a mensagem em inglês do próprio browser (ex.: "Failed to fetch"). Agora esse caso é apanhado e mostra uma mensagem em português mais clara ("Não foi possível ligar ao servidor..."). Isto beneficia todas as páginas da aplicação, não só o login, já que todas usam a mesma função `api()`.

**Por confirmar pela Sara:** tentar login com password errada (deve continuar a mostrar "As credenciais estão incorretas."), e opcionalmente desligar o backend (`Ctrl+C` no terminal do `npm run dev`) e tentar login outra vez, para confirmar a nova mensagem de erro de ligação.

### 2026-09-09 — Auditoria de rotas e permissões

Retoma o último ponto das "Notas soltas da Sara". Revistos todos os ficheiros de rotas do backend (`backend/src/routes/*.routes.js`) um a um, a confirmar `requireAuth`/`requireRole` em cada endpoint e, onde relevante, se o controller/serviço faz alguma verificação extra (ex.: dono do recurso).

**CRÍTICO — `POST /auth/register` é público e deixa escolher o `role`.** Esta rota não tem `requireAuth` nenhum, e o corpo do pedido inclui `role: "COORDENADOR" | "FORMADOR"` à escolha de quem chama. Isto significa que, hoje, qualquer pessoa com acesso ao endereço da API (mesmo sem login nenhum) consegue criar-se a si própria uma conta de **coordenador** completa — o que ultrapassa por completo o fluxo de Pedidos de Acesso (Fase 3/8), cujo objetivo é precisamente obrigar a aprovação da coordenação antes de uma conta existir. Provavelmente um resto da Fase 0 (autenticação), de antes do fluxo de Pedidos de Acesso ter sido construído, nunca revisto depois.

**ALTO — `entregas.routes.js` não tem nenhum `requireRole`.** Qualquer utilizador autenticado, seja qual for o papel (incluindo FORMANDO), consegue: ver todas as entregas de todos os formadores (`GET /`); criar entregas atribuídas a qualquer formador/turma (`POST /`); editar qualquer entrega — incluindo o prazo e a quem pertence — sem ser o dono nem coordenador (`PATCH /:id`); desativar/reativar qualquer entrega (`DELETE /:id`, `PATCH /:id/reativar`); e marcar qualquer entrega como entregue pela coordenação sem entregar nada de facto (`PATCH /:id/marcar-entregue`). Só os endpoints `submeter` e `excecao` têm uma verificação própria (`garantirDonoOuCoordenador`) — todos os outros não têm nenhuma.

**ALTO — `formadores.routes.js` e `turmas.routes.js` não têm nenhum `requireRole`.** Já tinha ficado anotado como gap conhecido na entrada de "flag em vez de eliminar" (2026-09-04). Confirmado agora: qualquer utilizador autenticado (mesmo FORMANDO) consegue criar novas contas de formador (com password à escolha), editar dados de qualquer formador, desativar/reativar formadores, e o mesmo para turmas (criar/editar/desativar/reativar). O `role` não é escolhível ao criar um formador por aqui (fica sempre `FORMADOR`, fixo no serviço), por isso não dá para criar um coordenador por este caminho — mas continua a ser uma escalada de privilégio séria.

**BAIXO — algumas listagens sem restrição de papel.** `GET /aulas/turma-uc/:turmaUcId`, `GET /turma-ucs/turma/:turmaId` e `GET /ucs` podem ser vistas por qualquer utilizador autenticado, sem restrição de papel. Os dados em causa (horário de aulas, catálogo de UCs) são relativamente pouco sensíveis — fica registado, mas não é prioritário.

**Verificado como correto:** `pedidosAcesso.routes.js` (POST público é intencional — é o ponto de entrada do pedido; listar/aprovar/rejeitar exigem COORDENADOR), `disponibilidade.routes.js` (formador só mexe na própria disponibilidade, via `req.user.id`, nunca um id vindo do pedido; ver disponibilidade de outro formador exige COORDENADOR), `uc.routes.js` e `turmaUc.routes.js` (escrita exige COORDENADOR), `aula.routes.js` (criar/cancelar exige COORDENADOR), `middleware/auth.js#requireRole` (não tem nenhum bypass — `req.user.role` vem sempre do JWT assinado, nunca do pedido).

**Complicação para corrigir o `/auth/register`:** `tests/helpers.js#criarUtilizadorAutenticado` usa `POST /auth/register` diretamente (sem autenticação) para criar utilizadores de teste de qualquer papel — é assim que quase todos os testes de integração criam o seu coordenador/formador inicial. Fechar esta rota (como devia ser) obriga a mudar este helper para criar utilizadores de teste diretamente na base de dados via Prisma (`prisma.user.create`), em vez de passar pela API pública — mudança maior, mas mais correta (é o padrão normal em testes de integração: não depender de uma rota pública para bootstrap).

**Por decidir com a Sara:** que âmbito destas correções aplicar agora — fica pendente, ver a conversa.

### 2026-09-09 — Corrigido: gaps de permissões encontrados na auditoria

Segue-se da auditoria acima. A Sara pediu para corrigir tudo. O que mudou:

- **`POST /auth/register`** passou a exigir `requireAuth` + `requireRole("COORDENADOR")` — só um coordenador já autenticado pode agora criar novas contas por esta via. Deixou de ser possível a qualquer pessoa criar-se a si própria uma conta (de coordenador ou formador) sem estar autenticada.
- **Problema do "primeiro coordenador":** com a rota fechada, uma base de dados nova (sem nenhum coordenador ainda) ficava sem forma de criar o primeiro. Criado `backend/scripts/criar-coordenador.js` (`npm run criar-coordenador -- "Nome" email@... password`) que cria/reativa um coordenador diretamente na base de dados via Prisma, sem passar pela API. A Sara já tem a sua conta de coordenador criada há muito, por isso isto não lhe é necessário agora — é só para o caso de a base de dados ser recriada de raiz no futuro (ex.: para a apresentação/entrega final).
- **`entregas.routes.js`**: `GET /` (listar tudo), `POST /` (criar), `PATCH /:id` (editar), `DELETE /:id` (apagar), `PATCH /:id/reativar` e `PATCH /:id/marcar-entregue` passaram a exigir `requireRole("COORDENADOR")`. `GET /minhas`, `POST /:id/submeter` e `POST /:id/excecao` continuam abertos a qualquer formador autenticado (já tinham a verificação de dono própria).
- **`formadores.routes.js`**: `POST /` (criar), `PATCH /:id` (editar), `DELETE /:id` (apagar) e `PATCH /:id/reativar` passaram a exigir `requireRole("COORDENADOR")`. `GET /` (listar) manteve-se aberto — é leitura, baixa sensibilidade, e é usado por várias páginas.
- **`turmas.routes.js`**: mesma coisa — `POST /`, `PATCH /:id`, `DELETE /:id`, `PATCH /:id/reativar` passaram a exigir `requireRole("COORDENADOR")`; `GET /` manteve-se aberto.
- **Não mexido (fica como estava, baixa prioridade):** as listagens de leitura já identificadas como "baixo" na auditoria (`GET /aulas/turma-uc/:turmaUcId`, `GET /turma-ucs/turma/:turmaId`, `GET /ucs`).

**Testes:** todas as chamadas de escrita a estas três rotas nos testes já existentes usavam um token de coordenador — confirmado antes de mexer, por isso a mudança não devia partir nenhum teste existente. Foram acrescentados testes novos a confirmar que um formador recebe `403` em cada um destes endpoints agora protegidos (`auth.test.js`, `entregas.test.js`, `formadores.test.js`, `turmas.test.js`).

**`tests/helpers.js` reescrito:** já não pode usar `POST /auth/register` (deixou de ser público) para criar os utilizadores de teste — passou a criá-los diretamente na base de dados via Prisma (mesmo `bcrypt`/`SALT_ROUNDS` usado em produção), mantendo o login a passar pela API a sério.

**Sem alterações ao `schema.prisma`** — não é preciso correr nenhuma migração desta vez, só `npm test` no `backend/` para confirmar.

**Por confirmar pela Sara:** correr `npm test` no `backend/` e confirmar que continua tudo a passar (mais alguns testes novos).

### 2026-09-09 — Implementado: Dashboard do Formando

A Sara pediu para "fazer todos os dashboards para formador, formando, etc". Coordenador (`dashboardCoord.html`) e Formador (`dashboardFormador.html`) já existiam e estão completos — o que faltava mesmo era o Formando, que até agora era sempre enviado para `perfil.html` ao fazer login (ver "Ainda não existe dashboard para o papel Formando", 2026-09-04).

**Bloqueio encontrado:** não havia nenhuma ligação entre uma conta FORMANDO e uma Turma — a Turma só tem `numFormandos` (uma contagem), não uma lista de membros. Perguntei à Sara como modelar isto; escolheu a opção mais simples: um campo `turmaId` (opcional) no `User`, só usado quando `role = FORMANDO` — um formando está, no máximo, numa turma de cada vez. Segue o mesmo padrão já usado para `Turma.mediadorId` (só que ao contrário: aqui é o User a apontar para a Turma).

**Schema:** `User.turmaId` (opcional) + relação `Turma.formandos` (inversa). Nova migração necessária.

**Como se atribui a turma a um formando:** no momento de aprovar o Pedido de Acesso — `PATCH /pedidos-acesso/:id/aprovar` passou a aceitar um `turmaId` opcional (só usado quando `role: FORMANDO`; valida que a turma existe e está ativa). A página de Pedidos de Acesso (`pedidosAcesso.html`) ganhou um select de Turma no modal de aprovação, que só aparece quando o papel escolhido é "Formando(a)" — pode ficar em branco ("Sem turma por agora"), para o caso de a turma ainda não estar criada nessa altura.

~~**Não implementado (fica para o futuro, se vier a ser preciso):** uma forma de mudar a turma de um formando DEPOIS de a conta já existir (ex.: mudou de turma a meio do curso) — hoje só é possível definir a turma no momento da aprovação do pedido. Não há nenhuma "Gestão de Formandos" na aplicação ainda; fica pendente até haver necessidade real.~~ — feito em 2026-09-10, ver "Implementado: Gestão de Formandos" mais abaixo.

**Dashboard (`dashboardFormando.html` + `dashboardFormando.js`):**
- Vai buscar o próprio `turmaId` a `GET /auth/me`. Sem turma associada (ou turma entretanto desativada), mostra um aviso simples a pedir para contactar a coordenação, em vez de tabelas vazias.
- "As Minhas UCs": reaproveita `GET /turma-ucs/turma/:turmaId` (já existente, sem restrição de papel — decisão já tomada na auditoria de permissões) para mostrar abreviatura, nome, carga horária e formador de cada UC da turma.
- "Próximas Aulas": para cada UC da turma, vai buscar as aulas via `GET /aulas/turma-uc/:turmaUcId` (também já existente e sem restrição de papel) — como este endpoint só lista por UC, não por turma inteira, faz um pedido por UC em paralelo. Filtra só aulas de hoje em diante e ordena por data/hora. Não foi criado nenhum endpoint novo no backend para isto — só reaproveitou o que já existia.
- Sem alterações a `entregas` — essas continuam a ser uma responsabilidade do formador, não do formando.

**Correção relacionada — `perfil.html` tinha a barra lateral sempre fixa no menu de coordenação.** Reparei nisto ao construir o dashboard: a página de Perfil é partilhada pelos três papéis, mas a barra lateral e os links de "voltar ao início" no cabeçalho estavam sempre hardcoded para o menu de coordenador — um formador ou formando que lá chegasse via "O Meu Perfil" via um menu com opções que não lhe pertenciam (Gestão Turmas, Pedidos de Acesso, etc.). Corrigido: `perfil.js` agora ajusta a barra lateral, o "logo" e o texto do papel de acordo com o `role` real da conta autenticada.

**Redireccionamento pós-login (`auth.js`):** FORMANDO passa a ir para `dashboardFormando.html` em vez de `perfil.html`.

**Testes:** acrescentados dois testes novos a `pedidosAcesso.test.js` — aprovar um FORMANDO com `turmaId` válido associa mesmo a conta à turma (confirmado via login), e aprovar com um `turmaId` inexistente é recusado com `404 TURMA_NOT_FOUND`. Não foram precisos testes novos para os endpoints de leitura reaproveitados (já estavam cobertos).

**Falta fazer no terminal da Sara:**
1. `cd backend`
2. `npx prisma migrate dev --name formando-turma`
3. Aplicar a mesma migração à base de testes (troca de `.env`/`.env.test`, como das outras vezes) e correr `npm test`.

**Por confirmar pela Sara:** depois da migração, aprovar um pedido de acesso como Formando com uma turma associada, fazer login com essa conta, e confirmar que o dashboard mostra a turma, as UCs e as próximas aulas corretamente. Também confirmar que o `perfil.html` mostra a barra lateral certa para cada um dos três papéis.

### 2026-09-09 — Implementado: Notificações por email

Retoma os pontos "Email a informar alterações feitas" e "Alterações de UCs também devem notificar por email" das "Notas soltas da Sara" — ambos ficaram deliberadamente com o âmbito por confirmar ("a confirmar o âmbito exato"). Como a Sara não respondeu a essa parte em concreto, optei por um âmbito propositadamente restrito, para evitar o risco óbvio de spam de "notificar em qualquer alteração a qualquer coisa": só dois eventos discretos, ambos do tipo "foste atribuído a uma responsabilidade concreta":

- Um formador é associado (ou reassociado) a lecionar uma UC numa turma (`POST /turma-ucs` e `PATCH /turma-ucs/:id`, quando o `formadorId` muda mesmo).
- Um formador é designado mediador de uma turma (`POST /turmas` já com `mediadorId`, e `PATCH /turmas/:id`, quando o `mediadorId` muda mesmo).

**Não incluído neste âmbito** (fica por decidir com a Sara se fizer sentido mais tarde): notificar a coordenação de alterações; notificar sobre mudanças de carga horária, datas, ou outros campos que não sejam a atribuição de pessoa; notificar o formando quando a turma/UCs mudam.

**`backend/src/lib/mailer.js`**: duas novas funções, seguindo exatamente o padrão já usado em `enviarCredenciaisAcesso` (mesmo `getTransporter()`, mesmo mecanismo de `testOutbox` em modo de teste, mesmo log do link de pré-visualização Ethereal em desenvolvimento): `enviarNotificacaoUcAtribuida` e `enviarNotificacaoMediadorAtribuido`.

**`turmaUc.service.js` e `turmas.service.js`**: cada um ganhou uma função `notificarFormadorAtribuido`/`notificarMediadorAtribuido` chamada depois de gravar a associação/turma, sempre com `try/catch` interno (uma falha a enviar o email nunca deve impedir a operação em si — mesmo princípio já usado em `pedidosAcesso.service.js#aprovar`, incluindo o `await` antes de devolver a resposta, para os testes não terem de esperar por nada). Em `atualizar()`, só dispara se o `formadorId`/`mediadorId` realmente mudou (evita reenviar o mesmo email a cada edição não relacionada).

**Decisão de privacidade (importante):** o email do formador/mediador NÃO foi acrescentado aos `select` do Prisma já existentes (`INCLUDE_RELACOES` em `turmaUc.service.js`, `INCLUDE_MEDIADOR` em `turmas.service.js`) — esses `select`s alimentam respostas públicas (ex.: `GET /turma-ucs/turma/:turmaId`, hoje usado também pelo dashboard do Formando) e alargá-los exporia o email do formador a qualquer utilizador autenticado que consulte essas listas. Em vez disso, cada função de notificação faz uma consulta Prisma dedicada e mínima (`select: { nome, email }`) só no momento do envio.

**Testes:** `tests/integration/turmaUc.test.js` (3 testes novos: envia ao associar, envia só ao novo formador ao reatribuir, não envia se o formador não mudou) e `tests/integration/turmas.test.js` (3 testes novos: envia ao criar já com mediador, não envia sem mediador, envia ao atribuir depois e não repete se gravar o mesmo mediador outra vez) — todos a validar o conteúdo de `testOutbox`, como já se fazia em `pedidosAcesso.test.js`.

**Sem alterações a `schema.prisma`** — não é preciso nenhuma migração desta vez, só `npm test` no `backend/`.

**Por confirmar pela Sara:** correr `npm test` no `backend/`; e, em desenvolvimento (sem `SMTP_HOST` configurado), criar/mudar uma associação Turma+UC ou o mediador de uma turma e confirmar no terminal do backend o link de pré-visualização Ethereal do email gerado.

### 2026-09-09 — Auditoria e correção: consistência dos códigos de erro

Retoma o último ponto das "Notas soltas da Sara": rever se os códigos e mensagens de erro da API são consistentes em todos os endpoints. Levantados todos os `throw new AppError(...)` em `backend/src/services/*.js` e `backend/src/controllers/*.js` (43 no total), catalogados por código/estado HTTP.

**Verificado como já consistente (nada mexido):**
- Estados HTTP: `409` para "já existe / já está feito" (`EMAIL_IN_USE`, `CODIGO_EM_USO`, `ABREVIATURA_EM_USO`, `UC_JA_ASSOCIADA`, `PEDIDO_JA_TRATADO`, `BLOCO_OCUPADO`, `BLOCO_BLOQUEADO`, `CARGA_HORARIA_EXCEDIDA`); `422` para "referência ou estado inválido" (`*_INATIVO`, `*_INVALIDO`, `VALIDATION_ERROR`); `403` para acesso indevido (`FORBIDDEN`, `CONTA_INATIVA`); `401` para autenticação (`INVALID_CREDENTIALS`, `UNAUTHORIZED`).
- `CONTA_INATIVA` e `FORBIDDEN` são reutilizados tal e qual entre `middleware/auth.js` e os serviços que fazem a mesma verificação (login vs. pedido já autenticado) — mesmo código, mesma situação, como devia ser.
- Erros de validação do Zod (`middleware/errorHandler.js`) já tratados de forma centralizada com `VALIDATION_ERROR`/`422`, e erros verdadeiramente inesperados com `INTERNAL_ERROR`/`500` — nada a mudar aqui.

**Inconsistência real encontrada e corrigida:** várias funções `obterOuFalhar()` (o "buscar pelo id ou lançar 404") usavam o código genérico `NOT_FOUND` para a entidade principal do seu próprio serviço, enquanto a MESMA entidade, quando referenciada a partir de outro serviço (ex.: validar que uma turma existe antes de lhe associar uma UC), já usava um código específico. Ou seja, o código dependia de "por onde" o 404 era lançado, não da entidade em si — o que torna `error.code` pouco fiável para quem consome a API (o frontend, hoje, nunca lê `error.code`, só `error.message` — por isso isto nunca se notou visualmente; mas os testes e a documentação Swagger já assumem códigos específicos nalguns sítios). Corrigido para todas apontarem para o mesmo código específico:

| Entidade | Ficheiro (uso próprio, antes → agora) | Já usava este código noutro sítio |
|---|---|---|
| Turma | `turmas.service.js#obterOuFalhar`: `NOT_FOUND` → `TURMA_NOT_FOUND` | `turmaUc.service.js`, `pedidosAcesso.service.js` |
| UC (catálogo) | `uc.service.js#obterOuFalhar`: `NOT_FOUND` → `UC_NOT_FOUND` | `turmaUc.service.js` |
| Associação Turma/UC | `turmaUc.service.js#obterOuFalhar`: `NOT_FOUND` → `TURMA_UC_NOT_FOUND` | `aula.service.js` |
| Bloco de disponibilidade | `disponibilidade.service.js#obterOuFalhar`: `NOT_FOUND` → `BLOCO_NOT_FOUND` | `aula.service.js` |
| Formador | `formadores.service.js#obterOuFalhar`: `NOT_FOUND` → `FORMADOR_NOT_FOUND` | (novo, sem duplicação anterior) |
| Entrega | `entregas.service.js#obterOuFalhar`: `NOT_FOUND` → `ENTREGA_NOT_FOUND` | (novo) |
| Aula | `aula.service.js#obterOuFalhar`: `NOT_FOUND` → `AULA_NOT_FOUND` | (novo) |
| Pedido de Acesso | `pedidosAcesso.service.js#obterPendenteOuFalhar`: `NOT_FOUND` → `PEDIDO_NOT_FOUND` | (novo) |
| Utilizador (`/auth/me`) | `auth.service.js#getById`: `NOT_FOUND` → `UTILIZADOR_NOT_FOUND` | (novo; só ocorre na prática se a conta for apagada a meio da sessão — cenário raro) |

`NOT_FOUND` genérico mantém-se só num único sítio, de propósito: `middleware/errorHandler.js#notFoundHandler`, para "esta rota não existe" (`404` numa URL que não corresponde a nenhum endpoint) — é um conceito diferente de "esta entidade não existe", por isso faz sentido continuar distinto de todos os outros.

**Ponto revisto e mantido como está (decisão consciente, não é bug):** as validações de referências no corpo do pedido (`FORMADOR_INVALIDO`, `MEDIADOR_INVALIDO`) devolvem sempre `422`, mesmo quando o id simplesmente não existe (em vez de `404` para "não existe" + `422` só para "existe mas é inválido"). Ficou assim de propósito: é uma validação do valor recebido no corpo do pedido (mais parecido com "este id não é um formador válido"), não uma pesquisa por id na URL — e mudar isto implicava alterar o estado HTTP devolvido, com impacto nos testes já existentes (`turmaUc.test.js`, `uc.test.js`) e no contrato da API. Registado aqui para ficar visível, mas não alterado sem confirmar com a Sara.

**Testes:** todos os testes de integração existentes só verificavam o estado HTTP (`404`) nestes casos, nunca o código exato — confirmado por grep antes de mexer, por isso a mudança de código não partiu nenhum teste. Acrescentados 8 testes novos (um por entidade da tabela acima, exceto Utilizador) a confirmar o novo código específico em `formadores.test.js`, `entregas.test.js`, `aula.test.js`, `disponibilidade.test.js`, `uc.test.js`, `turmaUc.test.js`, e reforçados dois testes já existentes em `turmas.test.js` e `pedidosAcesso.test.js` que já testavam o `404` mas não verificavam o código.

**Sem alterações a `schema.prisma`** — só `npm test` no `backend/` para confirmar.

**Por confirmar pela Sara:** correr `npm test` no `backend/`.

### 2026-09-10 — Implementado: Pedidos de Acesso via RH

Retoma o último ponto das "Notas soltas da Sara": "Pedidos de Acesso via um perfil de Recursos Humanos". Havia duas variantes por esclarecer — perguntei à Sara (AskUserQuestion) e escolheu a variante (b): **os RH não têm acesso à plataforma; a coordenação continua a aprovar o pedido, mas deixa de criar a conta na hora — fica um estado intermédio "a aguardar RH", e é a própria coordenação que confirma na plataforma quando a conta já estiver mesmo criada** (tratada fora da plataforma pelos RH).

**Schema (`schema.prisma`):**
- `EstadoPedidoAcesso` ganhou o valor `A_AGUARDAR_RH`, entre `PENDENTE` e `APROVADO`.
- `PedidoAcesso` ganhou `roleDecidido` (`Role?`) e `turmaIdDecidido`/`turmaDecidida` (relação para `Turma`, opcional) — guardam a decisão tomada na aprovação, já que a criação da conta fica adiada para o passo seguinte.
- **Nova migração necessária** (`npx prisma migrate dev --name pedidos-acesso-rh`).

**Fluxo passou a ter dois passos em vez de um:**
1. `PATCH /pedidos-acesso/:id/aprovar` (mantém o nome, mas mudou o efeito): a coordenação escolhe o papel (e a turma, se for formando) — validações inalteradas (turma tem de existir e estar ativa). Já não cria a conta nem envia email; só grava a decisão e muda o estado para `A_AGUARDAR_RH`.
2. **Novo endpoint** `PATCH /pedidos-acesso/:id/confirmar-conta-criada` (só aceite a partir de `A_AGUARDAR_RH`): é aqui que a conta é mesmo criada (com o papel/turma decididos no passo 1) e as credenciais são enviadas por email — exatamente a mesma lógica que antes estava toda dentro de `aprovar()`. Revalida a turma (pode ter sido desativada entretanto) antes de criar a conta.

`rejeitar()` passou a aceitar tanto `PENDENTE` como `A_AGUARDAR_RH` (ex.: os RH acabam por não avançar, ou a coordenação muda de ideias antes de a conta estar criada) — só deixa de ser possível depois de `APROVADO` (conta já criada).

**Decisão de âmbito (por minha conta, não confirmada em detalhe com a Sara):** restringi quem pode chamar `confirmar-conta-criada` a `requireRole("COORDENADOR")`, igual a `aprovar`/`rejeitar` — a resposta da Sara mencionou "(ou outro papel)" para quem confirma, mas como os RH não têm conta na plataforma nesta variante, não havia um papel óbvio a usar sem inventar um novo `Role` (o que a variante escolhida evita de propósito). Fica registado para reconsiderar se a Sara quiser um papel diferente aqui.

**Frontend (`pedidosAcesso.html` + `pedidosAcesso.js`):**
- Nova badge `A AGUARDAR RH` (azul) na listagem.
- Ações por linha passaram a depender do estado: `PENDENTE` → Aprovar/Rejeitar (como antes); `A_AGUARDAR_RH` → novo botão "Confirmar conta criada" (chama o novo endpoint e mostra o mesmo modal de "Conta Criada" que já existia) + Rejeitar; `APROVADO`/`REJEITADO` → sem ações, como antes.
- Modal de aprovação atualizado: já não diz "a conta é criada de imediato" — explica que o pedido fica a aguardar RH e que a confirmação é feita depois, na listagem. Botão passou de "Aprovar e Criar Conta" para "Aprovar (aguarda criação da conta pelos RH)".

**Testes:** `pedidosAcesso.test.js` reescrito — o antigo describe de `/aprovar` deixou de testar criação de conta (agora testa só a transição para `A_AGUARDAR_RH` e os dados guardados); novo describe para `/confirmar-conta-criada` cobre o ciclo completo (criação da conta, email, login), tentar confirmar sem ter sido aprovado antes, confirmar duas vezes, turma desativada entre a aprovação e a confirmação, e permissões; `/rejeitar` ganhou testes para rejeitar a partir de `A_AGUARDAR_RH` e para já não deixar rejeitar depois de `APROVADO`.

**Documentação da API (`swagger.js` + docs inline nas rotas):** schema `PedidoAcesso` atualizado com o novo estado e os campos `roleDecidido`/`turmaIdDecidido`/`turmaDecidida`; documentado o novo endpoint e reescritas as descrições de `/aprovar` e `/rejeitar` para refletir o novo fluxo.

**Falta fazer no terminal da Sara:**
1. `cd backend`
2. `npx prisma migrate dev --name pedidos-acesso-rh`
3. Aplicar a mesma migração à base de testes (troca de `.env`/`.env.test`, como das outras vezes) e correr `npm test`.

**Por confirmar pela Sara:** depois da migração, aprovar um pedido de acesso na app e confirmar que fica com a badge "A AGUARDAR RH" sem conta criada; confirmar a criação da conta pelo novo botão e verificar que chega o email de credenciais (ou o link de pré-visualização Ethereal, em desenvolvimento); e decidir se o âmbito de quem pode "confirmar conta criada" (só coordenação, por agora) está correto.

### 2026-09-10 — Implementado: Gestão de Formandos

Fecha a lacuna deixada em aberto no "Dashboard do Formando" (2026-09-09): já era possível atribuir uma turma a um formando no momento de aprovar o Pedido de Acesso, mas não havia nenhuma forma de mudar essa turma depois — nem de ver, num único sítio, a lista de todos os formandos e a turma de cada um. Nova página "Gestão Formandos", acessível só à coordenação.

**Não foi preciso alterar o schema** — reutiliza o `User.turmaId` já criado no dashboard do Formando. Sem migração nova.

**Backend (`formandos.service.js` + `formandos.controller.js` + `formandos.routes.js`, todos novos):**
- `GET /formandos` — lista utilizadores com `role: FORMANDO`, com a turma incluída (`{ id, codigo, designacao }` ou `null`). Por omissão só mostra contas ativas; `?incluirInativos=true` mostra todas, tal como em `/formadores`.
- `PATCH /formandos/:id/turma` — muda (ou remove, com `turmaId: null`) a turma do formando. `turmaId` é obrigatório no corpo (mesmo que `null`), de propósito — obriga a decidir explicitamente entre atribuir ou remover, em vez de um PATCH parcial ambíguo em que a ausência do campo poderia significar "não mudar nada". Valida que a turma existe (`404 TURMA_NOT_FOUND`) e está ativa (`422 TURMA_INATIVA`), à semelhança da validação já feita em `pedidosAcesso.service.js#aprovar`.
- Ambas as rotas restritas a `COORDENADOR` (`requireRole`) — decisão minha: ao contrário de `/formadores` (leitura aberta a todos os papéis autenticados), a lista de formandos é informação mais sensível (nomes e emails de todos os formandos) e não há hoje nenhum outro papel que precise de a consultar. Fica registado para reconsiderar se surgir essa necessidade.
- Sem criação de contas nesta página — um formando só é criado via Pedidos de Acesso (fluxo já existente); esta página assume que a conta já existe e só gere a associação à turma.

**Frontend (`formandos.html` + `formandos.js`, novos):**
- Tabela: Nome, Email, Turma Atual (ou "— Sem turma —"), Estado (badge ATIVO/DESATIVADO), Ações.
- Pesquisa por texto (reaproveita o padrão já usado em `formadores.html`/`turmas.html`) e checkbox "Mostrar desativados" (chama `?incluirInativos=true`).
- Ação "Mudar turma" por linha abre um modal com um select de turmas ativas (reaproveita o padrão de `pedidosAcesso.js#carregarTurmasParaAprovar`), pré-selecionado com a turma atual; grava com `PATCH /formandos/:id/turma`.
- Novo item "Gestão Formandos" na barra lateral de todas as páginas da coordenação (`dashboardCoord.html`, `turmas.html`, `formadores.html`, `agenda.html`, `pedidosAcesso.html`) e em `perfil.html` (via o já existente `data-role="COORDENADOR"` + `ajustarSidebarPorRole()` — não foi preciso tocar em `perfil.js`, a lógica já é genérica por `data-role`).

**Testes:** novo `backend/tests/integration/formandos.test.js` — autenticação e permissões (403 para FORMADOR/FORMANDO), listagem só mostra `role: FORMANDO` com a turma incluída, `incluirInativos`, atribuir e depois remover turma (ciclo completo), `404 FORMANDO_NOT_FOUND`, `404 TURMA_NOT_FOUND`, `422 TURMA_INATIVA` (turma desativada depois de atribuída), e `422 VALIDATION_ERROR` quando o corpo não inclui `turmaId`.

**Falta fazer no terminal da Sara:**
1. `cd backend`
2. `npm test` (sem migração nova desta vez).

### 2026-10-20 — Revisão de segurança e correções de coerência

Retomada a sessão depois de uma pausa (último registo era 2026-09-10). Antes de mexer em código, foi feito um ponto de situação completo: confirmado que as 4 migrações mais antigas (`add-role-formando`, `add-agenda-uc-disponibilidade-aula`, `uc-catalogo-turma-uc`, `flag_em_vez_de_eliminar`) estão mesmo aplicadas (dev+teste), mas **`formando-turma`** (2026-09-09) e **`pedidos-acesso-rh`** (2026-09-10) nunca chegaram a ser geradas — o `schema.prisma` já tem os campos (`User.turmaId`, `EstadoPedidoAcesso.A_AGUARDAR_RH`, `roleDecidido`, `turmaIdDecidido`), mas a base de dados não. **Continuam por fazer** (ver "Falta fazer" das entradas de 2026-09-09 e 2026-09-10 acima) — nada do trabalho desde 9 de setembro correu ainda uma única vez contra uma BD real.

A Sara confirmou que há uma entrega académica prevista para o fim de outubro de 2026 (data não oficial, "mais ou menos") — por isso a prioridade combinada para esta sessão foi deixar a plataforma coerente/funcional/segura primeiro, e só depois atualizar o relatório/PowerPoint (que cobrem só até 2026-09-03).

**Revisão feita por partes:** o diff por commitar (89 ficheiros) foi dividido em 4 partes (Pedidos-Acesso-RH+Formandos+mailer; Agenda; Auditoria de permissões; Frontend) por ser demasiado extenso para uma só revisão. Cada ponto reportado foi verificado a olho no código antes de se agir — a tabela completa com o veredito de cada um (real/falso positivo/âmbito a confirmar) não ficou registada aqui, por ser muito extensa; resumo do que foi feito abaixo.

**Achado mais sério — XSS persistente, corrigido:** `nome`/`email`/`cargo`/`motivo` do formulário público de Pedido de Acesso (`forms.html`, sem autenticação) eram inseridos sem escape em `innerHTML` em `pedidosAcesso.js`. Como esses dados ficam gravados em `User.nome`/`User.email` quando a conta é criada, o mesmo problema reaparecia depois em `formandos.js`. Ao investigar, percebeu-se que `PATCH /auth/me` deixa qualquer utilizador autenticado (incluindo FORMADOR) mudar o próprio `nome` livremente — e esse `nome` também era inserido sem escape em `formadores.js` e em `dashboardCoord.js` (via `entrega.formador.nome`). Ou seja, não era só "visitante anónimo ataca a coordenação" — também era "um formador ataca a coordenação através do próprio nome de perfil". Corrigido com uma função partilhada nova, `src/js/sanitize.js` (`escapeHtml`), aplicada em: `pedidosAcesso.js`, `formandos.js`, `formadores.js`, `dashboardCoord.js`, `dashboardFormador.js`, `agenda.js`, `dashboardFormando.js`, `turmaUcs.js` (os dois últimos grupos são dados só de coordenação, risco bem mais baixo, corrigidos por coerência/consistência).

**Outras correções de integridade de dados (Agenda):**
- `aula.service.js#criar` — passou a recusar agendar num bloco de disponibilidade inativo (`BLOCO_INATIVO`, 422) — antes um bloco "apagado" (soft delete) mas ainda com `estado: LIVRE` podia receber uma aula se o id fosse conhecido. A verificação da carga horária e a criação da aula passaram para dentro da mesma transação Prisma, reduzindo (não eliminando — seria desproporcionado para a escala deste projeto) a janela de corrida entre dois pedidos simultâneos.
- `disponibilidade.service.js#definirBloco` — passou a recusar mudar o estado de um bloco que já tem aula agendada (ex.: marcar como Bloqueado) — o `apagar()` já tinha esta proteção, o `definirBloco()` (usado para marcar Livre/Bloqueado) não.
- `uc.service.js#atualizar` — passou a recusar reduzir a `cargaHoraria` de uma UC do catálogo abaixo do que já está agendado em qualquer turma que a use (soma de `Aula.duracaoHoras` por `TurmaUc`).
- **`turmaUc.service.js#atualizar` — decisão tomada:** trocar o formador responsável por uma UC numa turma passou a ser recusado (`409 TURMA_UC_COM_AULAS_FUTURAS`) se já houver aulas futuras marcadas — antes a troca era aceite sem mais, deixando as aulas já marcadas ligadas à disponibilidade do formador antigo (agenda inconsistente: o novo formador aparece como responsável, mas o bloco ocupado continua no calendário do antigo). Decisão: bloquear em vez de mover/cancelar aulas automaticamente — a coordenação cancela as aulas futuras primeiro, se quiser mesmo trocar de formador. Avaliar com a Sara se faz mais sentido, no futuro, mover as aulas automaticamente em vez de bloquear.

**Correções de permissões/validação:**
- `entregas.controller.js` (`submeter`/`excecao`) — passou a recusar submissões numa entrega já desativada (`422 ENTREGA_INATIVA`) — antes era possível usando o id diretamente, mesmo a entrega já não aparecendo em nenhuma listagem.
- `turmas.controller.js` — `mediadorId` passou a aceitar `null` explícito (remover o mediador já atribuído) — antes `z.coerce.number()` rejeitava `null`, não havia forma de limpar o campo pela API.
- `backend/scripts/criar-coordenador.js` — a password deixou de ter de ir na linha de comandos (ficava no histórico da shell e visível no Gestor de Tarefas); por omissão é pedida de forma oculta no terminal (ainda aceita como argumento, para scripting, mas já não é o caminho recomendado no comentário do ficheiro).
- `agendaFormador.js` — cancelar o diálogo de motivo ao bloquear um bloco (Livre → Bloqueado) deixava de abortar a ação (`prompt(...) || ""` tratava Cancelar como motivo vazio em vez de parar) — corrigido para verificar explicitamente `=== null`.
- `turmaUcs.js` — um formador desativado associado a uma UC de turma deixou de ser substituído visualmente pelo primeiro formador da lista (o `<select>` não incluía inativos; agora inclui só o formador já associado, mesmo inativo, desabilitado para não ser reescolhido).

**Decisão registada, não implementada — fica para avaliar com a Sara:** reativar uma conta com password nova não invalida tokens JWT já emitidos (o `requireAuth` só confirma `ativo` na BD, nunca se a password mudou depois de o token ser emitido). Corrigir a sério implica um campo novo no `User` (ex.: `tokenVersion`) e mais uma migração — decidido não avançar sozinho, porque já há duas migrações por fazer e isto exigiria uma terceira. Risco prático considerado baixo (exige um token antigo já capturado + reativação da conta com password nova).

**Fase 5 e Fase 7 do plano (continuação do mesmo dia):**
- **Guarda de autenticação no frontend (Q1):** novo `src/js/guard.js`, ligado a todas as páginas internas. Sem token/utilizador no `localStorage` → volta ao login; cada `<body>` declara os papéis permitidos (`data-roles`), e uma conta com papel errado é redirecionada para o dashboard do próprio papel (ex.: um formando a abrir `turmas.html`). `api-client.js` passou também a limpar a sessão e ir para o login quando a API devolve 401 (token expirado) ou `CONTA_INATIVA` (conta desativada a meio da sessão) — exceto em `/auth/login`, onde 401 só quer dizer "credenciais erradas". A API continua a ser a verdadeira barreira; isto só evita mostrar páginas sem sentido.
- **"Terminar Sessão" (Q2):** os links `.logout` passaram a chamar `clearSession()` (via `guard.js`) antes de ir para o login — antes o token ficava no `localStorage`.
- **Rate limiting (Q4):** novo `backend/src/middleware/rateLimit.js`, em memória e sem dependências novas (o `npm install` é sempre corrido pela Sara — ver `GUIA_RAPIDO.md`). `POST /auth/login`: 10 tentativas por IP em 15 min (`429 LOGIN_RATE_LIMITED`); `POST /pedidos-acesso` (rota pública): 5 por IP por hora (`429 PEDIDOS_RATE_LIMITED`). Desligado em `NODE_ENV=test` (os testes fazem dezenas de logins do mesmo IP) — o próprio limitador tem um teste unitário (`tests/unit/rateLimit.test.js`) que o liga explicitamente. Limitação conhecida: em memória, não partilhado entre instâncias nem sobrevive a reinícios do servidor.
- **Uploads protegidos (Q5):** `app.use("/uploads", express.static(...))` removido. Novo `GET /api/v1/entregas/:id/ficheiro` (autenticado; só o formador dono da entrega ou a coordenação) serve o ficheiro; o caminho vem sempre da BD e só se usa o nome do ficheiro (`path.basename`), para não haver path traversal. Frontend: o ícone de clipe no dashboard da coordenação deixou de ser um `<a href>` direto e passou a descarregar com o token (`abrirFicheiroProtegido()` em `api-client.js`) e abrir o ficheiro num novo separador. O valor guardado em `submissaoFicheiroUrl` não mudou (continua `/uploads/entregas/{id}/{ficheiro}`), só deixou de ser um URL acessível.
- Encontrado de passagem e corrigido: a nota de exceção (`submissaoNota`, escrita pelo formador) ia sem escape para o atributo `title` em `dashboardCoord.js` — outro vetor de XSS formador→coordenação (agora com `escapeHtml`).
- **Testes escritos (por correr):** `tests/unit/rateLimit.test.js` (novo); em `entregas.test.js` — ficheiro só descarregável autenticado/dono/coordenação, 404 sem ficheiro, submeter em entrega desativada; em `aula.test.js` — bloco desativado, bloquear bloco com aula, reduzir carga horária da UC, trocar formador com aulas futuras (aula numa data de 2030 para continuar "futura"); em `turmas.test.js` — limpar mediador com `null`.

**Nada disto foi testado contra uma base de dados real** — fica tudo à espera das duas migrações pendentes (`formando-turma`, `pedidos-acesso-rh`) e de `npm test` (esperam-se mais 12 testes novos).

**Por confirmar pela Sara:** abrir "Gestão Formandos" na app, mudar a turma de um formando existente e confirmar que aparece corretamente no dashboard desse formando; confirmar que o link da barra lateral aparece certo em todas as páginas de coordenação e em "O Meu Perfil".


### 2026-10-20 — Implementado: notas, assiduidade, trabalhos e mensagens (Visão futura, papel Formando/Formador)

A Sara pediu para avançar com as funcionalidades em falta da secção "Visão futura" — e escolheu as quatro: **notas por UC**, **assiduidade e justificação de faltas**, **trabalhos e submissões**, **comunicação interna**. Desenhadas juntas, com **uma única migração**: as seis tabelas novas (`notas`, `presencas`, `justificacoes`, `trabalhos`, `submissoes_trabalho`, `mensagens`) entram no mesmo `schema.prisma` que já tinha por migrar `User.turmaId` e o fluxo RH. Como `prisma migrate dev` gera UMA migração com todas as diferenças em relação à última, basta correr **um** comando (ver "Falta fazer" abaixo) em vez de três — as duas migrações que tinham ficado por gerar (`formando-turma`, `pedidos-acesso-rh`) vão dentro da mesma.

**Modelo (`schema.prisma`, validado com `prisma validate`):**
- `Nota` — uma por formando/`TurmaUc` (`@@unique`), escala 0–20, `lancadaPorId`. Lançar outra vez atualiza.
- `Presenca` — por aula/formando (`PRESENTE`/`AUSENTE`). "Falta justificada" NÃO é um estado: é `AUSENTE` + `Justificacao` `ACEITE` (evita ter dois sítios a manter sincronizados).
- `Justificacao` — por aula/formando; motivo, anexo opcional, estado `PENDENTE`/`ACEITE`/`REJEITADA`, quem decidiu e quando. Uma rejeitada pode ser submetida outra vez (volta a pendente).
- `Trabalho` (por `TurmaUc`, com prazo, soft delete) e `SubmissaoTrabalho` (uma por formando; reenviar substitui o ficheiro e apaga a avaliação anterior, que já não se aplicaria; `updatedAt` = data do último envio).
- `Mensagem` — remetente, destino (`COORDENACAO`/`FORMADOR`/`ASSISTENTE_SOCIAL`), assunto, corpo, lida, resposta. **A assistente social não é um papel da plataforma** (não houve decisão de criar um): as mensagens com esse destino são lidas e respondidas pela coordenação, e aparecem com uma etiqueta própria.

**Regras de acesso** (centralizadas em `backend/src/lib/acesso.js`):
- Notas, presenças e trabalhos: só o **formador responsável pela UC nessa turma** (`TurmaUc.formadorId`) ou a coordenação; um formador de outra UC recebe 403. O formando só vê o que é seu (`/minhas`).
- O formando de um lançamento/presença/submissão tem de pertencer à turma (`422 FORMANDO_INVALIDO` / `403`).
- Presenças só se registam depois de a aula acontecer (`422 AULA_FUTURA`). Só se justificam faltas já registadas (`422 SEM_FALTA`).
- Submissões de trabalho: o prazo termina no fim do dia da `dataLimite` (`409 PRAZO_ULTRAPASSADO`).
- Mensagens: formando → coordenação, assistente social, ou um formador **da sua turma**; formador → coordenação; coordenação → qualquer formador ativo (`403 DESTINO_NAO_PERMITIDO` nos restantes casos).
- Ficheiros (anexos de justificações, submissões de trabalhos): como as entregas, **nunca públicos** — só por endpoints autenticados (`GET /assiduidade/justificacoes/:id/anexo`, `GET /trabalhos/submissoes/:id/ficheiro`), permitidos ao dono, ao formador responsável e à coordenação. Nestes uploads, ao contrário das entregas do formador, só se aceitam extensões de documento/imagem (pdf, doc, docx, png, jpg, txt, zip — `422 TIPO_FICHEIRO_INVALIDO`), porque quem os envia é um formando e quem os abre é um formador/coordenação. O caminho do ficheiro vem sempre da BD (`path.basename`), e se a submissão falha depois do upload o ficheiro é apagado (não ficam órfãos). Erros do multer (ex.: ficheiro > 10 MB) passam a devolver `422 UPLOAD_INVALIDO` em vez de `500`.

**API nova** (todas com anotações OpenAPI, ver `/api-docs`): `/notas` (`/minhas`, `/turma-uc/:id`, `PUT /turma-uc/:id/formando/:id`, `/pauta/turma/:id`), `/assiduidade` (`/minhas`, `/aula/:id` GET+PUT, `/justificacoes` POST+GET, `/justificacoes/:id/decidir`, `/justificacoes/:id/anexo`, `/turma/:id/resumo`), `/trabalhos` (`/minhas`, `/turma-uc/:id`, CRUD, `/:id/submissao`, `/:id/submissoes`, `/submissoes/:id/avaliar`, `/submissoes/:id/ficheiro`), `/mensagens` (`/destinatarios`, `/recebidas`, `/enviadas`, `POST`, `/:id/lida`, `/:id/responder`) e `GET /turma-ucs/minhas` (as UCs que o formador leciona — usado nos seletores das páginas).

**Frontend** — cinco páginas novas, todas role-aware (a mesma página mostra a vista do papel de quem a abre): `notas.html` (formador lança, formando consulta), `assiduidade.html` (formador regista presenças e decide justificações; formando vê o resumo e justifica; coordenação vê só as justificações), `trabalhos.html`, `mensagens.html`, `pautas.html` (coordenação: pauta formandos × UCs com média, exportação CSV, e resumo de assiduidade por turma). O CSV usa `;` e BOM (Excel PT) e neutraliza células que começam por `= + - @` (os nomes vêm de fora). **Menu lateral:** novo `src/js/menu.js` + `guard.js` — o guard acrescenta os itens novos ao menu de TODAS as páginas internas (não foi preciso editar as 13 existentes), e as páginas novas montam o menu inteiro (`<nav data-auto>`).

**Verificação feita:** `node --check` em todo o backend e módulos ES do frontend; e a interface das 5 páginas foi testada no browser contra uma **API simulada** (sem base de dados) nos três papéis — menu por papel, redirecionamento por papel (um formando a abrir `turmas.html` vai para o seu dashboard), tabelas, modais, e nomes com HTML a aparecerem como texto (sem executar). Isto apanhou 3 problemas, já corrigidos: item ativo do menu não marcado (o `npx serve` serve `/pages/notas` sem `.html`), `<textarea>` escura nos modais, e cartões esticados em `pautas.html`/`mensagens.html` (`.section-card` tem `height: 100%`; passam a estar dentro de um contentor). **Não foi testado contra o backend real** (precisa da migração).

**Testes escritos (por correr):** `notas.test.js` (7), `assiduidade.test.js` (7), `trabalhos.test.js` (6), `mensagens.test.js` (5) — mais um helper comum `prepararCenarioAcademico` em `tests/helpers.js` — a cobrir permissões (formador de outra UC, formando de outra turma, anónimo), regras de negócio (escala, aula futura, prazo, tipo de ficheiro, resposta única) e o ciclo completo de cada funcionalidade.

**Decisões / limitações a rever com a Sara:**
- Uma nota final por formando/UC (não várias avaliações parciais). Se fizer falta, é mudar o `@@unique` e acrescentar um tipo/descrição à `Nota`.
- Escala 0–20 fixa (a do ensino/formação em Portugal); a IEFP também usa 1–5 em alguns cursos — não coberto.
- Assistente social = coordenação (ver acima). Se vier a ser um papel próprio, é um valor novo em `Role` + um filtro em `mensagens.service.js`.
- Mensagens não têm fio de conversa: uma mensagem, uma resposta. Não há notificação por email (o `mailer.js` já existe e dava para reaproveitar).
- Formandos inativos deixam de aparecer nas listas de notas/presenças (mas as notas já lançadas mantêm-se).
- A página de notas do formador só lista as UCs que ele leciona; a coordenação consulta tudo pela pauta (não lança notas por essa página — pode fazê-lo pela API).

**Falta fazer no terminal da Sara (uma só migração, cobre as três pendentes):**
1. `cd backend`
2. `npx prisma migrate dev --name funcionalidades-formando-formador` — como a BD de desenvolvimento ainda não tem `User.turmaId` nem os campos do fluxo RH, esta migração inclui também essas alterações (as duas que estavam por gerar). Se aparecer o erro `EPERM` conhecido, fechar o backend/Prisma Studio e repetir; depois `npx prisma generate`.
3. Aplicar à base de testes (troca de `.env`/`.env.test` — confirmar com `dir .env*` antes — ou `npx prisma migrate reset` com o `.env` a apontar para a de testes) e correr `npm test`. Esperam-se **cerca de 25 testes novos** (mais os das correções de segurança do início do dia).


### 2026-10-20 — Segunda revisão às funcionalidades novas (4 achados, 3 corrigidos)

Segunda revisão (árvore de trabalho completa). Cada ponto foi verificado no código antes de agir:

- **[P1] "Falta a migração no repositório" — real, mas é o passo já combinado.** O `schema.prisma` já tem tudo (`User.turmaId`, fluxo RH, as seis tabelas novas e `SubmissaoTrabalho.enviadaEm`), mas a migração tem de ser gerada pela Sara com `prisma migrate dev` (ver "Falta fazer" da entrada anterior e `GUIA_RAPIDO.md`). Até lá, uma BD só com as migrações existentes falha — inclusive o login, porque o Prisma Client já pede `users.turmaId`. **Nenhuma BD que não tenha corrido a migração consegue arrancar este código**; convém não esquecer ao preparar a base de dados da apresentação (`COMO_TESTAR.md`, secção 7, gera um `.sql` completo se for preciso criar a BD de raiz).
- **[P2] Duas aulas ao mesmo tempo para a mesma turma — real, corrigido.** Os blocos de disponibilidade são por formador, por isso dois formadores livres à mesma hora passavam todas as verificações. `aula.service.js#criar` passou a recusar (`409 TURMA_OCUPADA`) se a turma já tiver uma aula nessa data e hora (dentro da mesma transação da verificação da carga horária). Era a lacuna "âmbito a confirmar" que tinha ficado na primeira revisão (2026-10-20) — assumida agora como regra: os formandos não estão em dois sítios ao mesmo tempo.
- **[P2] Reativar uma associação com outro formador contornava a proteção das aulas futuras — real, corrigido.** `turmaUc.service.js#associar` (que reativa a associação desativada) não tinha a verificação que `atualizar` já tinha. Passou a haver um helper partilhado, `garantirSemAulasFuturas()`, usado nos dois sítios; reativar com o MESMO formador continua permitido.
- **[P2] `enviadaEm` mostrava a data da avaliação — real, corrigido.** O frontend/API devolviam `updatedAt` como data de envio, mas esse campo muda também quando o formador avalia (podia parecer que o trabalho foi entregue depois do prazo). Novo campo `SubmissaoTrabalho.enviadaEm`, definido só no envio/reenvio. Como a migração ainda nem tinha sido gerada, isto não acrescenta nenhum passo à Sara.

Testes novos (por correr): `aula.test.js` (turma ocupada; reativar com outro formador vs. mesmo formador) e `trabalhos.test.js` (avaliar não altera `enviadaEm`).


### Confirmado: migração aplicada e 152/152 testes a passar (2026-10-20)

A Sara correu `npx prisma migrate dev --name funcionalidades-formando-formador` (migração `20261020195349_funcionalidades_formando_formador`, aplicada à BD de desenvolvimento) e depois a mesma migração à base de testes com `migrate deploy` — desta vez **sem trocar os nomes de `.env`/`.env.test`**: definiu `DATABASE_URL` só na sessão do PowerShell a partir do `.env.test` (o Prisma não sobrepõe uma variável de ambiente já definida ao ler o `.env`) e confirmou pelo nome da base (`plataforma_pedagogica_test`) antes de aplicar. Evita por completo a armadilha da troca de ficheiros — usar este método da próxima vez. Resultado de `npm test`: **16 suites, 152 testes, todos a passar** (antes: 10 suites / 75 testes em 2026-09-08). Isto fecha as três migrações que estavam pendentes (`formando-turma`, `pedidos-acesso-rh` e as tabelas novas), o dashboard do Formando, a Gestão de Formandos, o fluxo RH e as funcionalidades de notas/assiduidade/trabalhos/mensagens, que até hoje nunca tinham corrido contra uma BD real. Por testar ainda: o fluxo no browser contra o backend real (a interface só foi vista contra uma API simulada).


### 2026-10-20 — Implementado: notificações por email das funcionalidades novas

Retoma "Notificações (in-app e/ou email) para novos prazos, notas lançadas ou respostas a uma comunicação" da "Visão futura". **Sem migração** — reaproveita o `mailer.js` (mesmos três modos: teste em memória / SMTP real / Ethereal em desenvolvimento) com uma função genérica nova, `enviarNotificacao`, e um helper `backend/src/lib/notificacoes.js`.

**Eventos (só acontecimentos discretos, para não haver spam):**
- Nota lançada ou atualizada → o formando.
- Justificação de falta submetida → o formador responsável pela UC; decidida (aceite/rejeitada) → o formando.
- Trabalho novo → todos os formandos ativos da turma; trabalho avaliado (só se houver nota ou feedback) → o formando.
- Mensagem nova → o formador destinatário, ou **todos os coordenadores ativos** quando o destino é a coordenação/assistente social; mensagem respondida → o remetente.

**Decisões:**
- **Os emails dizem o que aconteceu, nunca o conteúdo** — sem a nota, o motivo da falta, a nota de decisão, o feedback ou o texto das mensagens; mandam consultar a plataforma. Razão: RGPD (dados de avaliação e possivelmente de saúde) e o email não ser um canal seguro. Há testes a garantir isto.
- **Nunca fazem falhar a operação** que os originou (mesmo princípio dos emails de atribuição de UC/mediador): erros só ficam no log do servidor.
- **Só contas ativas** recebem emails.
- Não foram acrescentadas preferências de notificação (todos recebem tudo); se a coordenação achar ruidoso o aviso por cada mensagem, o sítio a mexer é `mensagens.service.js`.

**Verificação:** `notificacoes.test.js` (5 testes: conteúdo/destinatários/privacidade/contas inativas) e suite completa corrida contra a BD de testes — **17 suites / 157 testes, todos a passar** (a base de testes é descartável e os testes só usam o `.env.test`; correr `npx jest` a partir de `backend` é seguro, ao contrário de `prisma generate`/`npm install`, que continuam reservados à Sara).


### 2026-10-20 — Implementado: painéis de resumo nos dashboards

Retoma da "Visão futura": "Consulta da própria assiduidade e do estado de cada UC que leciona" (formador), "Painel de assiduidade" e alertas (coordenação), aproveitamento do formando. **Sem migração** — só agrega dados que as outras funcionalidades já guardam.

**Backend:** `GET /api/v1/painel/resumo` (`painel.service.js`), um endpoint que devolve um resumo diferente consoante o papel do token:
- **Formador:** por cada UC que leciona — horas dadas/total, nº de formandos, notas lançadas (n/formandos), trabalhos ativos — mais justificações por decidir, submissões de trabalhos por avaliar (sem nota nem feedback) e as próximas 5 aulas.
- **Formando:** média das notas, faltas (e quantas **injustificadas**, ou seja, sem justificação aceite), justificações pendentes, trabalhos por entregar / em atraso e o próximo prazo. Sem turma → `semTurma: true`.
- **Coordenação:** pedidos de acesso por tratar (`PENDENTE` + `A_AGUARDAR_RH`), justificações pendentes, mensagens por ler (coordenação + assistente social) e a lista (máx. 10) de **formandos em risco**: a partir de **3 faltas injustificadas** (`FALTAS_INJUSTIFICADAS_ALERTA` em `painel.service.js` — o número é uma escolha minha, a Sara pode querer outro).

**Frontend:** novo `src/js/painel.js`, incluído nos três dashboards (`dashboardCoord`, `dashboardFormador`, `dashboardFormando`); insere-se por baixo do cabeçalho com cartões clicáveis que levam à página onde se trata de cada coisa, e é só um extra: se o pedido falhar, o dashboard funciona na mesma. Verificado no browser com uma API simulada nos três papéis (incluindo texto malicioso escapado). Nota de layout: `.table-container-clean` tem `height: 450px` fixo em todo o projeto, por isso as tabelas do painel usam altura automática (`max-height: 320px`) para não ficarem com um buraco em branco.

**Testes:** `painel.test.js` (5 testes): autenticação, formador (horas, notas, justificações, trabalhos, só vê as suas UCs), formando (sem turma, média, faltas injustificadas a baixar quando uma justificação é aceite, trabalhos por entregar/em atraso) e coordenação (alertas e formandos em risco só a partir do limite, a sair da lista quando uma falta é justificada). Suite completa corrida contra a BD de testes.


### 2026-10-21 — Implementado: exportação da pauta em PDF

Retoma "Exportação de pautas e relatórios em PDF" da "Visão futura". **Sem migração e sem `npm install`** — em vez de gerar o PDF no servidor (exigiria uma biblioteca nova, e `npm install` é reservado à Sara), usa-se a impressão do browser: `pautas.js#imprimirPauta` preenche um cabeçalho só-de-impressão (`#cabecalho-impressao`: turma, designação, data) e chama `window.print()`; a secção 15 de `style.css` (`@media print`) esconde o menu, o topo, o seletor de turma e os botões, e liberta a altura fixa das tabelas. A pessoa escolhe "Guardar como PDF" no diálogo. Limitação: o aspeto final depende do diálogo de impressão do browser (margens, cabeçalhos/rodapés do próprio browser). Por testar no browser com dados reais. Continuam por fazer na "Visão futura": histórico de alterações a notas (auditoria — exige tabela nova, logo migração) e versões das submissões de trabalhos.


### 2026-10-21 — Implementado: histórico de alterações às notas (auditoria)

Pedido da Sara, retomando "Histórico de alterações a notas — auditoria simples, alinhada com o checklist RGPD" da "Visão futura". Contexto dado pela Sara no mesmo dia: a plataforma deve ser **um pouco como um Moodle/portal para coordenadores, mediadores, etc.** — o histórico de notas vai nessa linha (rasto de quem mexeu em quê).

**Modelo:** nova tabela `NotaHistorico` (`notas_historico`): `turmaUcId`, `formandoId`, `valorAnterior` (null no primeiro lançamento), `valorNovo`, observações anteriores/novas, `alteradaPorId`, `createdAt`. **Exige migração** (a correr pela Sara; ver abaixo).

**Regras:** `notas.service.js#lancar` passou a correr numa transação que lê a nota anterior, faz o upsert e só escreve no histórico se o valor ou as observações mudaram (reenviar igual não polui a auditoria). `GET /api/v1/notas/turma-uc/:turmaUcId/formando/:formandoId/historico` — só o formador responsável pela UC ou a coordenação; o formando **não** o vê (403). Decisão a rever: se a transparência RGPD pedir que o formando veja o histórico da própria nota, é abrir uma rota `/minhas/historico`.

**Frontend:** em `notas.html` (vista do formador) cada linha ganhou um botão de relógio que mostra/esconde, por baixo, a lista de alterações (data, quem, valor anterior → novo; texto com `escapeHtml`).

**Testes (por correr):** 2 em `notas.test.js` — regista alterações e ignora reenvios iguais; formando e formador de outra UC recebem 403. `prisma validate` e `node --check` OK; mais nada foi corrido (sem BD).

**Falta fazer no terminal da Sara:** `cd backend` → `npx prisma migrate dev --name nota-historico` (fechar backend/Prisma Studio se der `EPERM`; depois `npx prisma generate`); aplicar à BD de testes pelo método de `DATABASE_URL` na sessão (ver `COMO_TESTAR.md`) e `npm test`.


### 2026-10-21 — Implementado: horário da turma (coordenação)

Pedido da Sara: só funcionalidades de gestão — o formador define o horário livre (já existia: `agendaFormador.html`), e a coordenação vê o horário de uma turma e define UC e formador (UCs/formador já em `turmaUcs.html`, agendamento em `agenda.html`). A lacuna era **ver o horário completo de uma turma**: antes só se via a grelha do formador responsável por uma UC de cada vez. Agora `agenda.html` mostra, ao escolher a turma, uma grelha semanal só de leitura com as aulas de todas as UCs (UC + primeiro nome do formador; nome completo e modalidade no tooltip), atualizada ao agendar/cancelar. Backend: `GET /api/v1/aulas/turma/:turmaId?de=&ate=` (só coordenação; 404 se a turma não existir). Sem migração. Testes: 16/16 em `aula.test.js` (2 novos). Por ver no browser. Possível passo seguinte: a mesma vista para o formando (a sua turma) e para o formador (as suas aulas).


### 2026-10-21 — Implementado: "O Meu Horário" (formador e formando)

Continuação do horário da turma (pedido da Sara: só funcionalidades de gestão). Nova página `horario.html` + `horario.js`, role-aware, com a mesma grelha semanal só de leitura: o **formador** vê as aulas que dá (UC + código da turma), o **formando** as aulas da sua turma (UC + primeiro nome do formador); tooltip com nome completo da UC, formador e modalidade. Backend: `GET /api/v1/aulas/minhas?de=&ate=` (só FORMADOR/FORMANDO; coordenação recebe 403 — tem o horário por turma em `agenda.html`; formando sem turma recebe lista vazia). Link "O Meu Horário" acrescentado ao menu de formador e formando em `menu.js`. Sem migração; `aula.test.js` 18/18. Por ver no browser. Nota: a disponibilidade livre/bloqueada do formador continua só em `agendaFormador.html`; este horário mostra apenas aulas já marcadas.


### 2026-10-21 — Implementado: ocupação do formador (coordenação)

Pedido da Sara: a coordenação ver a ocupação de um formador. Novo cartão "Ocupação do formador" em `agenda.html`: select de formador (ativos) → grelha semanal só de leitura com o que o formador marcou (Livre / Bloqueado + motivo) e as aulas já agendadas (UC e código da turma), mais uma linha de resumo ("Nesta semana: Xh com aulas, Yh livres, Zh bloqueadas") e navegação por semana. Reutiliza `GET /disponibilidade/formador/:id` (já só para coordenação), cujo `include` da aula passou a trazer `turmaUc.uc` e `turmaUc.turma` (alteração aditiva, não quebra o agendamento). Sem migração; `disponibilidade.test.js` 8/8. Por ver no browser. Limitação: só mostra o que o formador marcou — horas sem bloco aparecem como "indisponível", não como "livre".


### 2026-10-21 — Implementado: reagendar aulas (coordenação)

Pedido da Sara: mais funcionalidades de gestão. Até aqui, mudar uma aula de hora obrigava a cancelá-la e agendar outra (arriscando perder o bloco entretanto). Agora cada aula da UC, em `agenda.html`, tem "Reagendar": entra-se num modo em que o botão de confirmar passa a "Confirmar novo horário", escolhe-se na grelha de disponibilidade do formador um bloco livre e a aula é movida. Backend: `PATCH /api/v1/aulas/:id/reagendar` (`{ disponibilidadeId, modalidade? }`), numa transação, com as mesmas regras do agendamento (bloco ativo, do formador da UC, livre, sem outra aula; turma não ocupada nessa hora — ignorando a própria aula) e uma regra nova: **só aulas que ainda não aconteceram** (`422 AULA_PASSADA`), porque as presenças e justificações ficam ligadas à aula. A carga horária não é revalidada (a aula continua a ser a mesma hora). Sem migração; `aula.test.js` 21/21. Por ver no browser.


### 2026-10-21 — Implementado: relatório de horas por formador

Pedido da Sara. Nova página `relatorioHoras.html` (só coordenação; menu "Horas por Formador"): tabela com, por formador ativo, **horas dadas** (aulas com data anterior a hoje), **por dar** (hoje e futuras), total, e blocos de disponibilidade livres/bloqueados; filtro opcional por datas (de/até); a seta de cada linha expande o detalhe por turma/UC; exportação CSV (`;` + BOM, com neutralização de células tipo fórmula, como a pauta). Backend: `GET /api/v1/aulas/relatorio-formadores?de=&ate=` (`aula.service.js#relatorioHorasPorFormador`); só conta aulas de associações Turma/UC ativas e blocos ativos. Decisão: "bloco livre" = marcado LIVRE **e sem aula** (um bloco com aula continua LIVRE na BD, mas já não está disponível). "Dadas" = aula já passada, não "lecionada de facto" (não há confirmação de presença do formador). Sem migração; `aula.test.js` 23/23. Por ver no browser.


### 2026-10-21 — Implementado: copiar UCs de uma turma para outra

Pedido da Sara. Ao abrir uma turma nova, a coordenação tinha de associar as UCs uma a uma; agora, em `turmaUcs.html` (da turma de destino), o cartão "Copiar UCs de outra turma" associa de uma vez as UCs ativas de outra turma, com os mesmos formadores. Backend: `POST /api/v1/turma-ucs/copiar` (`{ origemTurmaId, destinoTurmaId }`) → `{ copiadas: [...], ignoradas: [{ uc, motivo }] }`. Decisões: (1) **copia só a estrutura** — nunca aulas, notas, trabalhos nem presenças (a carga horária já vem do catálogo); (2) o que não pode ser copiado é **ignorado com explicação**, em vez de falhar tudo: UC já associada ao destino (mesmo desativada — a associação é única por turma/UC; para a repor usa-se "reativar"), UC desativada no catálogo, formador inativo; (3) cada formador é notificado por email como numa associação normal (se uma pessoa der 6 UCs ao mesmo formador, recebe 6 emails — se for ruidoso, agrupar é a melhoria óbvia); (4) turmas iguais → `422 TURMAS_IGUAIS`, destino inativo → `422`. Sem migração; `turmaUc.test.js` 15/15. Por ver no browser.


### 2026-10-22 — Implementado: avisos de mudança de aula

Retomado o desenvolvimento. Primeiro, suite completa a confirmar que o trabalho de 21/10 (horário, ocupação, reagendar, relatório de horas, copiar UCs) não partiu nada: **18 suites / 176 testes a passar**. Depois, uma lacuna das novas funcionalidades: reagendar e cancelar uma aula não avisavam ninguém. Agora `aula.service.js` usa `notificar()` (o mesmo helper dos restantes avisos): ao **reagendar** (data/hora antiga → nova) ou **cancelar** uma aula **futura**, o formador e os formandos ativos da turma recebem um email só com a UC e a data/hora. Decisões: agendar uma aula nova **não** avisa (agendam-se muitas de cada vez — ruído); cancelar uma aula já passada (limpeza de registos) **não** avisa; os emails seguem a regra dos outros (nada sensível; nunca fazem falhar a operação; só contas ativas). Sem migração; `aula.test.js` 25/25. Por ver no browser (em desenvolvimento os emails vão para o Ethereal — link no terminal do backend).


### 2026-10-22 — Implementado: agendar várias aulas de uma vez

Agendar uma UC de 50h obrigava a 50 cliques + 50 confirmações. Agora, no painel de agendamento de `agenda.html`, clicar em vários blocos livres (da mesma ou de várias semanas — a seleção mantém-se ao mudar de semana) seleciona-os, e o botão passa a "Agendar N aulas". Backend: `POST /api/v1/aulas/lote` (`{ turmaUcId, disponibilidadeIds[1..60], modalidade }`) → `{ criadas, falhadas: [{ disponibilidadeId, codigo, motivo }] }`. Decisões: (1) **não é tudo-ou-nada** — cada bloco passa por `criar()` (mesmas regras: formador certo, bloco livre, turma não ocupada, carga horária) e os que falham são reportados sem impedir os restantes; a UI mostra quantas foram agendadas e o motivo da primeira falha; (2) os blocos são processados por ordem cronológica, por isso, se a carga horária acabar a meio, ficam agendadas as primeiras; (3) **não envia emails** (como no agendamento simples); (4) reagendar mantém-se de um bloco só (a seleção limpa-se se se escolher outro). Sem migração; `aula.test.js` 27/27. Por ver no browser.


### 2026-10-22 — Implementado: pendências de gestão no painel da coordenação

Com tanta gestão feita (UCs, formadores, agenda), faltava um sítio que dissesse **o que está por resolver**. O painel da coordenação (já com pedidos, justificações, mensagens e formandos em risco) ganhou `gestao` em `painel.service.js#pendenciasDeGestao`: (1) **turmas sem mediador** responsável; (2) **UCs com formador inativo** (nenhum formador pode dar as aulas — vem do soft delete de formadores); (3) **UCs com horas por agendar e nenhuma aula futura** (agendadas < carga horária e sem aula com data ≥ hoje). Só entram turmas ativas e não concluídas, e associações ativas. Cada pendência mostra a turma/UC, o problema e uma ligação (Gestão Turmas, UCs da turma ou Agenda); máx. 10 por lista, com os totais nos cartões. Decisão a rever: (3) não olha à data de início/fim da turma (não existe data de fim), por isso uma turma que ainda só começa daqui a meses também aparece até ter aulas marcadas — se for ruidoso, filtrar por turmas EM_CURSO. Sem migração; `painel.test.js` 7/7. Por ver no browser.


### 2026-10-22 — Implementado: horário geral (coordenação)

Pedido da Sara. Até aqui o horário via-se por turma (`agenda.html`) ou por formador (ocupação); faltava a **visão global**. Nova página `horarioGeral.html` (só coordenação): grelha semanal com todas as aulas, cada célula uma lista (turmas diferentes à mesma hora aparecem empilhadas: UC + código da turma + primeiro nome do formador; nome completo, UC e modalidade no tooltip), filtros por turma e formador, navegação por semana e contagem de aulas. Backend: `GET /api/v1/aulas?de=&ate=&turmaId=&formadorId=` (`aula.service.js#listarGeral`), só aulas de associações Turma/UC ativas. O link foi para `extras` do menu da coordenação em `menu.js` (o `guard.js` acrescenta-o a todas as páginas, incluindo as antigas com menu fixo). Sem migração; `aula.test.js` 28/28. Por ver no browser; com muitas turmas à mesma hora a célula cresce (altura mínima 40px) — se ficar apertado, o passo seguinte é filtrar por turma ou mostrar só um contador.


### 2026-10-22 — Implementado: substituir formador passando as aulas (resolve a decisão pendente de 2026-10-20)

Em 2026-10-20 ficou registado: trocar o formador de uma UC com aulas futuras é **bloqueado** (`409 TURMA_UC_COM_AULAS_FUTURAS`) — "avaliar com a Sara se faz mais sentido mover as aulas automaticamente". Para o caso real (formador de baixa) bloquear obrigava a cancelar tudo à mão, por isso foi acrescentada uma ação explícita, **sem tirar a proteção** do PATCH normal: `PATCH /api/v1/turma-ucs/:id/substituir-formador`. Regras: (1) as aulas **futuras** (hoje em diante) passam para blocos **livres, ativos e sem aula** do novo formador **na mesma data e hora**; as passadas ficam intactas (histórico, presenças); (2) se faltar bloco para alguma, **nada muda** e devolve `409 SEM_BLOCOS_LIVRES` com as primeiras datas em falta — o formador novo tem de marcar essas horas como livres; (3) com `cancelarSemBloco: true` as que não têm bloco são **canceladas** e as outras movidas (a coordenação volta a agendar as canceladas); (4) tudo numa transação; novo formador recebe o email habitual de atribuição; o antigo não é avisado (se for preciso, é um passo seguinte). Interface: ao mudar o formador no select de `turmaUcs.html` e a API responder `TURMA_UC_COM_AULAS_FUTURAS`, perguntam-se (confirm) os dois passos acima. Para isso `api-client.js` passou a expor `erro.codigo`. Os formandos **não** são avisados (data/hora não mudam, só o formador). Sem migração; `turmaUc.test.js` 18/18. Por ver no browser.


### 2026-10-22 — Implementado: vista do mediador

A Sara descreveu a plataforma como um portal "para coordenadores, mediadores, etc." — mas o mediador só existia como um campo (`Turma.mediadorId`, recebia um email ao ser atribuído) e não tinha nada para ver. Antes de avançar, suite completa: **18 suites / 186 testes a passar** (todas as funcionalidades de gestão de 21-22/10). Decisão: **o mediador não é um papel novo** — é um formador que é `mediadorId` de uma turma (como já estava definido na Agenda), por isso não há migração nem novo valor em `Role`. Nova página `mediacao.html` (só FORMADOR, entrada "Mediação" no menu; quem não medeia nada vê uma mensagem a explicar) com, para cada turma que medeia: UCs (formador, horas dadas/total com barra, em falta) e a assiduidade de cada formando (presenças, faltas, injustificadas; vermelho a partir de 3, o mesmo limite do painel da coordenação). **Só leitura**: agendar, trocar formadores ou decidir justificações continua da coordenação. Backend: `GET /api/v1/turmas/mediacao` → `mediacao.service.js`, que reaproveita `turmaUc.service#listarPorTurma` e `assiduidade.service#resumoDaTurma` (sem duplicar regras). Possíveis passos seguintes: dar ao mediador a lista de formandos com contactos, as notas/pauta da turma, ou permitir-lhe decidir justificações das suas turmas. Sem migração; `turmas.test.js` 13/13. Por ver no browser.


### 2026-10-22 — Implementado: exportar horário para calendário (.ics)

Na Fase 6 a Sara pediu ligação a Google/Outlook Calendar e, depois de pesar a complexidade do OAuth, optou por uma simulação interna; as duas abordagens apresentadas na altura eram `.ics` ou API real. Esta é a ponte pequena e sem risco entre as duas: **exportação `.ics`**, que já dá o efeito visível ("o meu horário aparece no meu telemóvel/Outlook") sem contas de developer, tokens de terceiros nem backend novo. `src/js/ics.js` gera o ficheiro no browser (RFC 5545: `VEVENT` por aula, `UID` estável `aula-{id}@…` — reimportar atualiza em vez de duplicar na maioria dos clientes —, texto escapado, hora flutuante) a partir de `/aulas/minhas` (formador/formando) e `/aulas/turma/:id` (coordenação), intervalo de hoje a +6 meses. **Limitações:** é uma fotografia — alterações posteriores (reagendar/cancelar) não chegam ao calendário até se exportar outra vez; não há subscrição por URL (isso exigiria um endpoint com token não autenticado por sessão e é o passo seguinte natural, e a integração OAuth real continua como evolução futura). Só verificado o gerador com um exemplo (escape de `;` e `,` correto); a descarga e a importação num calendário real estão por ver. Sem migração nem backend novo.


### 2026-10-22 — Implementado: link de subscrição de calendário

Segue a exportação `.ics` (que é uma fotografia): para o calendário se manter atualizado é preciso um **URL**, e os clientes de calendário não enviam cabeçalhos de autenticação — daí o token no endereço. Desenho: `POST /api/v1/calendario/link` (com sessão) devolve `…/api/v1/calendario/feed.ics?t=<token>`; o feed é público mas só serve o horário do dono do token. **Token = JWT assinado com `JWT_SECRET:` + o hash da password do utilizador**, sem expiração: (1) **mudar a password invalida o link**; (2) conta desativada → 404; (3) um token de sessão normal não serve (tem de ter `tipo: "calendario"` e a assinatura certa); (4) **sem migração** (a alternativa, um token guardado em tabela, permitiria revogar sem mudar a password — fica como melhoria se vier a ser preciso). Todos os erros dão o mesmo 404 (não revela se a conta existe). `backend/src/lib/ics.js` é a versão servidor do gerador (UID estável `aula-{id}@…`, `REFRESH-INTERVAL`/`X-PUBLISHED-TTL` de 6h); formador/formando recebem `listarMinhas`, a coordenação `listarGeral`, janela de -30 dias a +12 meses. Limitador próprio (`limitadorCalendario`, 120/h/IP) contra tentativas de adivinhar tokens. **RGPD/segurança:** quem tiver o link vê o horário (nomes de UC, turma e formador) — a interface avisa para o tratar como privado; para a coordenação o link mostra todas as aulas. Por ver no browser com um calendário real (o servidor só aceita URLs `http(s)` acessíveis: em `localhost` o Google Calendar não consegue lá chegar, só funcionará depois de haver deploy; o Outlook/Apple desktop conseguem subscrever `localhost`). Testes: 3 em `calendario.test.js`.


### 2026-10-22 — Implementado: pesquisa global (coordenação)

Com a plataforma a crescer (turmas, formadores, formandos, UCs), encontrar uma pessoa ou turma obrigava a abrir cada lista de gestão. Nova página `pesquisa.html` (só coordenação): uma caixa com pesquisa a cada 300 ms (ignora respostas antigas se se escrever depressa) e resultados agrupados — **turmas** (código, designação, ID de curso IEFP), **formadores** (nome, sigla, email), **formandos** (nome, email, com a turma ou "sem turma") e **UCs do catálogo** (abreviatura, nome) — cada resultado liga à página onde se gere (as turmas vão direto às suas UCs). Backend: `GET /api/v1/pesquisa?q=` (`pesquisa.service.js`): mínimo 2 letras (`422 PESQUISA_CURTA`), só registos **ativos** (desativados não aparecem, coerente com o soft delete), máx. 8 por tipo, só campos necessários (nunca `passwordHash`). A comparação é `contains` do MySQL, por isso a sensibilidade a maiúsculas/acentos depende da collation da BD (a por omissão é insensível a ambos). Limitação: os resultados ligam à página da lista, não ao registo concreto (as páginas de gestão não aceitam um filtro no URL); se se quiser, o passo seguinte é essas listas lerem `?q=`. Sem migração; testes: `pesquisa.test.js` (2) e suite completa antes — **19 suites / 191 testes** a passar. Por ver no browser.


### 2026-10-22 — Implementado: aulas de hoje e próximos dias no painel da coordenação

O painel dizia o que estava **por resolver** (pendências, pedidos, faltas) mas não o que **está a acontecer**. Acrescentadas duas tabelas em `dashboardCoord.html`, a partir de `painel.service.js#proximasAulasDaCoordenacao`: **Aulas de hoje** (por hora) e **Próximos 7 dias** (máx. 10 listadas, com o total no título), de todas as turmas com a associação UC/turma ativa. Decisão: "hoje" e a janela usam datas **UTC** (as aulas guardam só a data, sem hora/fuso); em Portugal isto só difere perto da meia-noite e não tem impacto prático. Sem migração; `painel.test.js` 8/8. Por ver no browser.


### 2026-10-22 — Implementado: repetir uma semana de aulas

Juntando o agendamento em lote com o horário da turma, faltava o caso mais comum numa formação: o horário é **igual todas as semanas**. Em `agenda.html`, no "Horário da turma", o botão "Repetir esta semana…" pergunta quantas semanas (1–16) e repete as aulas da semana visível (segunda a domingo). Backend: `POST /api/v1/aulas/repetir-semana` (`{ turmaId, semanaDe, numSemanas }`) → `{ aulasNaSemana, criadas, falhadas: [{ quando, codigo, motivo }] }`. Regras: (1) cada repetição precisa que o **formador da UC tenha marcado um bloco** nessa data/hora (`SEM_BLOCO` se não) — a repetição **não cria disponibilidade por ele**, de propósito: a disponibilidade é decisão do formador; (2) depois passa por `criar()` (bloco livre, turma não ocupada, carga horária), por isso falhas parciais não param o resto; (3) mantém UC, formador e modalidade; (4) não envia emails (como o agendamento normal); (5) `SEMANA_SEM_AULAS` (422) se a semana escolhida não tem aulas. A pergunta do número de semanas usa `prompt()` do browser (simples, a trocar por um modal se se quiser mais cuidado). Sem migração; `aula.test.js` 30/30. Por ver no browser.


### 2026-10-22 — Implementado: avisar formadores para marcarem disponibilidade

Fecha o ciclo da "repetição de semana": as falhas `SEM_BLOCO` eram só informação — a coordenação tinha de ir avisar cada formador por outra via. Agora, ao terminar a repetição, se houver falhas desse tipo, a interface pergunta se quer avisar os formadores e envia, por formador, **um email** com as datas/horas em falta (`POST /api/v1/disponibilidade/pedir-marcacao`, `{ formadorId, quando: ["AAAA-MM-DD HH:00"…] }`, máx. 100). Decisões: (1) usa o `notificar()` existente — só datas/horas e a indicação de abrir "A Minha Agenda", nada sensível, nunca falha o pedido por causa do email; (2) agrupa por formador (se faltam 8 horas, recebe 1 email, não 8); (3) o email lista até 20 horas e resume o resto; (4) só formadores ativos (404 caso contrário); (5) **não há registo** de que o pedido foi feito nem lembrete automático (precisaria de tabela → migração). Sem migração; testes: 40/40 em `disponibilidade.test.js` + `aula.test.js`. Por ver no browser.


### 2026-10-22 — Verificação de alinhamento com o que a Sara se propôs

A pedido da Sara, o estado do projeto foi confrontado com (1) o **estudo de caso original** (`Docs/estudo-de-caso.docx`), (2) o **guia de matéria** (checklist "Projeto Final", secção 6) e (3) o objetivo "portal tipo Moodle para coordenadores, mediadores, etc.". Suite no momento da verificação: **20 suites / 198 testes a passar**; 77 caminhos na documentação OpenAPI.

**O que está alinhado:** autenticação por papéis com redirecionamento (Coordenador/Formador/Formando); semáforo de entregas no painel da coordenação; formador define disponibilidade (livre/bloqueado) e a coordenação agenda dentro dela; UCs por turma com carga horária, notas, assiduidade/justificações, trabalhos, mensagens, pedidos de acesso via RH; testes automatizados, OpenAPI, RGPD.md, README; frontend responsivo na base.

**Lacunas face ao estudo de caso (ordenadas por importância):**
1. **Sumários** — o estudo de caso dá-lhes um papel central (o formador preenche; o mediador valida; o formando consulta). **Não existem** (nem no schema nem no código). Exige migração.
2. **Mediador** — no estudo de caso é um papel com poderes (agendar reuniões nos horários livres dos formadores, comunicar com a turma, validar sumários). Hoje é só `Turma.mediadorId` + uma página de leitura (21/10). Sem sumários e reuniões, o papel fica vazio.
3. **Repositório de documentos por UC** — "ao clicar na UC abre a área de upload", ficheiro **renomeado de forma padronizada** (ex.: `IDCurso_Modulo_Data.pdf`) e **histórico de uploads** como prova. Hoje há upload por "aviso" (`Entrega`), ficheiro guardado como `timestamp-nomeOriginal`, e uma nova submissão substitui a anterior (sem histórico).
4. **Dashboard de conformidade automático** — o estudo de caso pede "se o módulo acabou e o ficheiro não foi entregue → vermelho" **sem intervenção**; hoje a coordenação cria cada aviso à mão.
5. **Recursos para o formando** ("acesso a recursos, sumários") — não existe área de materiais por UC (é o que mais aproxima de um Moodle).
6. **Login:** "Esqueci a palavra-passe" é um link morto (`href="#"`), não há ícone de ver/ocultar password, e os logótipos IEFP/cofinanciamento são texto (`logos-placeholder`). O estudo de caso pede estes elementos explicitamente.

**Lacunas face ao guia (checklist final):** sem **seeds** de teste (`prisma/seed`), sem **Dockerfile**/preparação de deploy, sem **documento de arquitetura** formal (requisitos, entidades, endpoints) fora do README/CONTEXTO, `RGPD.md` por rever depois das funcionalidades novas, e **nada das funcionalidades de 21-22/10 foi ainda visto no browser**. Higiene: `tmp-check2.js` (raiz do projeto, contém hash+password de teste) continua por apagar.

**Juízo:** as últimas ~15 funcionalidades (horário geral, relatório de horas, copiar UCs, reagendar, repetir semana, pesquisa, .ics…) são de **gestão da agenda** — úteis, mas **periféricas** ao núcleo que a Sara descreveu. O núcleo em falta (sumários, mediador com poderes reais, repositório por UC com histórico, conformidade automática, recursos) é o que torna o projeto "o portal" e o que mais pesa na avaliação das três UCs. **Prioridade proposta:** (1) sumários + validação pelo mediador; (2) repositório por UC com nome padronizado e histórico; (3) conformidade automática; (4) recuperação de palavra-passe e polimento do login; (5) seeds + Dockerfile + documento de arquitetura; (6) teste completo no browser. As migrações destas funcionalidades devem ser agrupadas numa só (como em 20/10).


### 2026-10-22 — Implementado: sumários com validação pelo mediador (prioridade 1 da verificação de alinhamento)

O estudo de caso dá aos sumários um papel central ("o formador preenche, o mediador valida, o formando consulta") e não existiam. Desenho:
- **Modelo:** `Sumario` (1:1 com `Aula`, `aulaId` único): `texto`, `estado` (`SUBMETIDO` / `VALIDADO` / `REJEITADO`), `escritoPorId`, `validadoPorId`/`validadoEm`, `notaValidacao`. **Exige migração** (tabela `sumarios`). O mediador continua a ser `Turma.mediadorId` — sem papel novo.
- **Regras:** só o formador responsável pela UC nessa turma (ou a coordenação) escreve; só **a partir do dia da aula** (`422 AULA_FUTURA`); texto 10–5000 caracteres; **validado → imutável** (`409 SUMARIO_VALIDADO`); rejeitado → o formador corrige e volta a `SUBMETIDO` (a nota de rejeição limpa-se). Valida o **mediador da turma ou a coordenação** — nunca o próprio autor nem outro formador (`403`); rejeitar exige motivo (`422 NOTA_OBRIGATORIA`); só se decide um sumário `SUBMETIDO` (`409 SUMARIO_JA_DECIDIDO`). O formando só vê os **validados** da sua turma (`409 SEM_TURMA` sem turma).
- **Avisos por email** (`notificar`, sem o conteúdo do sumário): submissão → mediador (ou coordenação se a turma não tem mediador); decisão → formador autor.
- **API:** `GET /sumarios/por-escrever` e `/meus` (formador), `/por-validar` (coordenação: todos; formador: só das turmas que medeia), `/turma` (formando), `GET|PUT /sumarios/aula/:aulaId`, `PATCH /sumarios/:id/decidir`.
- **Interface:** `sumarios.html` (menu dos 3 papéis): o formador vê "Por escrever" (com o motivo da rejeição e botão "Corrigir"), "Os meus sumários" e — se for mediador — "Por validar"; a coordenação valida; o formando consulta. A rejeição pede o motivo com `prompt()`.
- **Isto dá ao mediador um poder real** (validar sumários) — resolve metade da lacuna 2 da verificação. Falta o outro: agendar reuniões nos horários livres dos formadores e comunicar com a turma.
- **Por fazer:** integrar na conformidade automática (sumário em falta → vermelho no dashboard), no painel (contadores) e no relatório de horas (horas "dadas" só com sumário validado, se se quiser).
- **Estado:** `prisma validate` e `node --check` OK; interface por ver; **`sumarios.test.js` (10 testes) por correr** — e atenção: `tests/helpers.js` já limpa `prisma.sumario`, por isso **toda a suite falha até a migração e o `prisma generate` serem aplicados**.

**Falta fazer no terminal da Sara:** `cd backend` → `npx prisma migrate dev --name sumarios` (fechar backend/Prisma Studio se der `EPERM`; depois `npx prisma generate`); aplicar à BD de testes pelo método de `COMO_TESTAR.md` (`DATABASE_URL` na sessão); depois `npm test`.


### 2026-10-22 — Implementado: repositório de documentos por UC (prioridade 2 da verificação de alinhamento)

O estudo de caso pede para substituir os CDs por um repositório de upload, com nomes padronizados (`IDCurso_Modulo_Data.pdf`) e histórico. Decisões:
- **Modelo `DocumentoUc`** (tabela `documentos_uc`), ligado à `TurmaUc` (UC numa turma) e não à `Uc` do catálogo, porque cada turma tem o seu formador e os seus materiais. Campos: `categoria` (MATERIAL/PLANO/AVALIACAO/OUTRO), `nomePadrao`, `nomeOriginal`, `ficheiro` (nome interno em disco), `tamanho`, `enviadoPorId`, `ativo`/`removidoEm`. **Exige migração.**
- **Nome oficial:** `IDCurso_UC_AAAA-MM-DD.ext`, com `Turma.idCursoIEFP` (que já existia) e, na falta dele, o código da turma. Caracteres fora de `[A-Za-z0-9-]` viram `-`. Se já houver um envio com o mesmo prefixo, ganha `_v2`, `_v3`… (conta inclui os removidos, para o nome nunca se repetir). O ficheiro em disco tem nome interno (`Date.now()-userId-nome`); ao descarregar, o nome sugerido é o oficial.
- **Histórico:** nunca se substitui nem se apaga um ficheiro. Remover = `ativo=false` (soft delete, como no resto do projeto). O histórico (`?historico=1`) só o vê o responsável da UC e a coordenação; o formando nunca vê removidos nem consegue descarregá-los (404).
- **Quem pode:** enviar/remover — formador responsável da UC ou coordenação (`403` para os restantes). Ler/descarregar — esses, o **mediador da turma** e os formandos da turma (`403` a estranhos; `409 SEM_TURMA` para formando sem turma). Os ficheiros continuam sem `express.static`: só saem por rota autenticada.
- **Tipos aceites:** os dos formandos + ppt/pptx/xls/xlsx, 10 MB (`criarUploadRestrito` passou a aceitar a lista de extensões como parâmetro).
- **Avisos:** cada envio avisa por email os formandos da turma (`DOCUMENTO_NOVO`, sem nome nem conteúdo do ficheiro).
- **Interface:** `documentos.html` (menu dos 3 papéis): coordenação escolhe turma e UC, formador escolhe uma das suas UCs, ambos enviam e vêem a tabela com histórico; o formando vê os documentos de todas as UCs da turma.
- **Por fazer:** ligar à conformidade automática (UC sem documentos → vermelho) — prioridade 3.
- **Estado:** `prisma validate` e `node --check` OK; `documentos.test.js` (7 testes) **por correr**. Atenção: `tests/helpers.js` já limpa `prisma.documentoUc`, por isso **toda a suite falha até a migração ser aplicada**.

**Falta fazer no terminal da Sara:** `cd backend` → `npx prisma migrate dev --name documentos_uc` (fechar backend/Prisma Studio se der `EPERM`; depois `npx prisma generate`); aplicar à BD de testes pelo método de `COMO_TESTAR.md`.


### 2026-10-22 — Implementado: conformidade automática com semáforos (prioridade 3 da verificação de alinhamento)

O estudo de caso pede um dashboard de conformidade com semáforos (a coordenação vê quem cumpriu e quem não). Agora que existem sumários e documentos, o cálculo é automático e **não precisa de tabelas novas** — só lê aulas, sumários e documentos.
- **Regras (por UC de cada turma ativa e não concluída):**
  - *Sumários:* aula já dada (data ≤ hoje) sem sumário ou com sumário rejeitado = "em falta". Há mais de `DIAS_TOLERANCIA_SUMARIO = 2` dias → **vermelho**; mais recente → amarelo. Sumário submetido por validar → amarelo. Tudo validado → verde.
  - *Documentos:* UC com pelo menos uma aula dada e **nenhum documento ativo** → vermelho. UC que ainda não começou não é penalizada.
  - *Horário:* horas da carga horária por agendar e nenhuma aula futura → amarelo (reaproveita a regra das pendências de gestão).
  - Estado da UC = o pior dos três. A tolerância de 2 dias é uma escolha minha (dá tempo ao formador para escrever o sumário depois da aula) — fácil de mudar numa constante.
- **API:** `GET /painel/conformidade` (COORDENADOR: todas; FORMADOR: só as suas UCs; formando `403`) devolve totais por cor e a lista de UCs, pior primeiro, com o detalhe de cada critério. `/painel/resumo` da coordenação ganhou `conformidade` (contagens + 5 piores).
- **Interface:** `conformidade.html` (tabela com semáforos e detalhe, no menu da coordenação e do formador) e cartões no painel da coordenação.
- **Não feito (de propósito):** não há avisos automáticos por email aos formadores em falta — seria um passo seguinte (job periódico), a decidir.
- **Estado:** testes automáticos (`conformidade.test.js`, 7 testes; `painel.test.js` continua verde); interface por ver no browser.


### 2026-10-22 — Implementado: recuperação de palavra-passe + olho no login (prioridade 4 da verificação de alinhamento)

O estudo de caso pede um "esqueci-me" e a opção de mostrar/ocultar a palavra-passe no login. O link "Esqueci a palavra-passe" apontava para `#`.
- **Sem tabela nova:** o token de recuperação é um JWT com `{id, finalidade: "recuperar-password"}`, assinado com `JWT_SECRET + ":" + passwordHash` e validade de 1 hora. Como o hash muda quando a palavra-passe muda, o token **fica inválido à primeira utilização** (e também se a palavra-passe for alterada por outra via) — sem guardar nada na base de dados. Alternativa descartada: tabela de tokens (exigia migração e limpeza periódica).
- **Não revela contas:** `POST /auth/esqueci-password` responde 200 com a mesma mensagem para emails existentes, inexistentes ou de contas inativas; só envia email se a conta existir e estiver ativa; falhas de envio só vão para o log. Email inválido continua a dar 422 (validação de formato).
- **Abuso:** limitador novo `limitadorRecuperacao` (5 pedidos/hora/IP) nas duas rotas. `POST /auth/redefinir-password` devolve `400 TOKEN_INVALIDO` para qualquer token inválido, expirado, de outra finalidade ou de conta inativa (mensagem única).
- **Token no fragmento (`#token=`), não em `?token=`:** descoberto ao testar no browser — o `serve` redireciona `redefinir-password.html` para `/redefinir-password` e **perde o query string**. O fragmento sobrevive ao redirecionamento e nunca é enviado ao servidor (nem fica nos logs). O endereço base da ligação vem de `FRONTEND_URL` (opcional) ou, na falta, de `CORS_ORIGIN`.
- **Interface:** `esqueci-password.html`, `redefinir-password.html` (repetir a palavra-passe, mínimo 6 como no registo) e `mostrarPassword.js` (olho SVG em todos os campos de palavra-passe). Verificado no browser: olho alterna entre `password`/`text`, pedido de recuperação mostra a mensagem genérica.
- **Por fazer no login:** logos do PESSOAS 2030 / Portugal 2030 continuam como texto — não há ficheiros de imagem no projeto; quando a Sara os tiver, substituem-se no `login.html`.
- **Estado:** testes automáticos verdes (`recuperacaoPassword.test.js`, 5 testes). O envio real do email depende da configuração SMTP do `.env`; em desenvolvimento sem SMTP o mailer imprime a pré-visualização no log do backend.


### 2026-10-22 — Implementado: pacote de entrega (prioridade 5 da verificação de alinhamento)

Itens que a UC de Integração/Deploy pede e faltavam: dados de exemplo, containerização, documento de arquitetura e RGPD atualizado.
- **Seed (`backend/scripts/seed-demo.js`, `npm run seed`):** a lógica está numa função `semear(db)` exportada (o CLI só corre com `require.main === module`) para poder ser testada sem tocar na BD de desenvolvimento — `seed.test.js` corre-a na BD de testes. Datas relativas a "hoje" (aulas a -10/-6/+3/+7 dias), para os semáforos fazerem sentido em qualquer dia. O cenário é desenhado para mostrar tudo: Frontend verde; Backend vermelho (sumário em falta e sem documentos); Integração vermelho (sumário rejeitado); um formando em risco (3 faltas injustificadas); uma justificação pendente. Todas as contas partilham `Demo1234!` (dados fictícios). Proteções: recusa `NODE_ENV=production` e só corre sem utilizadores (ou com `--forcar`). Cria um ficheiro real em `uploads/` para os documentos de demo descarregarem.
- **Docker:** `backend/Dockerfile` (node 20 slim + OpenSSL, `npm ci`, `prisma generate`, arranca com `prisma migrate deploy && node src/server.js`) e `docker-compose.yml` na raiz (MySQL 8.4 com healthcheck, API, nginx a servir `src/`). `JWT_SECRET` é obrigatório (o compose recusa arrancar sem ele). O frontend continua a falar com `localhost:4000` (fixo em `api-client.js`), por isso as portas 4000/5500 são publicadas no anfitrião. Para correr o seed dentro do contentor é preciso `-e NODE_ENV=development` (a imagem define `production`). **Não testado a correr** — o Docker Desktop estava desligado; só `docker compose config` validou a sintaxe. A Sara deve fazer `docker compose up --build` uma vez antes de apresentar.
- **Arquitetura (`Docs/ARQUITETURA.md`):** visão geral (diagrama mermaid), papéis, modelo de dados, módulos, segurança, testes, deploy e limitações conhecidas.
- **RGPD:** acrescentadas as tabelas `sumarios`/`documentos_uc`, a recuperação de palavra-passe, o acesso aos documentos e o aviso sobre os dados de demo.
- **Por fazer (fora do pacote):** teste manual no browser de todas as funcionalidades novas (sumários, documentos, conformidade, mediação, horários…); atualizar o relatório/PPT (continuam desatualizados); apagar `tmp-check2.js` da raiz (contém um hash e uma password de teste — a Sara decide).


### 2026-10-22 — Teste completo no browser (coordenação, formador/mediadora, formando)

Método: semeei a **base de dados de testes** (`seed-demo.js` com `DATABASE_URL` só na sessão), arranquei o backend contra ela (configuração de arranque `backend-teste-bd`, para nunca tocar na BD de desenvolvimento) e o frontend em `localhost:5500`; entrei com as contas demo e percorri todas as páginas de cada papel (carregamento sem erros de consola nem avisos de erro) mais as ações principais.
- **Coordenação (15 páginas):** painel com cartões de conformidade e formando em risco; conformidade; documentos (upload pela interface → nome `_v2`; remover; histórico; descarregar); pesquisa; relatório de horas; pautas (notas + assiduidade) — tudo com os valores esperados do seed. `mediacao.html` redireciona a coordenação (é de formador, como desenhado).
- **Formador/mediadora (12 páginas):** sumários (escrever pela interface, validar o de outro formador), mediação, conformidade, documentos — OK.
- **Formando (9 páginas):** vê só os 2 sumários validados e os documentos da turma; horário com as aulas na grelha semanal — OK.
- **Problemas encontrados e corrigidos:** (1) **bug real:** mediador que também é o formador da UC conseguia validar o próprio sumário — corrigido no backend e testado; (2) etiquetas "Horas dadas" que na verdade são horas agendadas; (3) descarregamento de documentos sem o nome oficial; (4) etiquetas de conformidade a partir em duas linhas.
- **Lição de processo:** correr `jest` limpa a BD de testes — se o browser estiver ligado à mesma BD, as sessões caem (401 → login). Não correr os testes durante uma sessão de browser sobre a BD de testes; semear de novo depois.
- **Não coberto:** fluxo de rejeição de sumário (`window.prompt`) e submissão de trabalhos/justificações com anexo pela interface; envio real de emails (SMTP); Docker.


### 2026-10-22 — Relatório e PPT de outubro atualizados (terceiro ponto de situação)

O relatório e o PPT estavam desatualizados desde 3 de setembro. Em vez de sobrescrever, criaram-se **novas versões** (`..._Outubro2026`) ao lado das de setembro, para manter o histórico.
- **Relatório (.docx, 21 páginas + PDF):** reconstruído sobre o ficheiro original (mesmos estilos, capa, índice com números de página reais lidos do Word, anexos A/B/C, bibliografia com 4 referências novas). Estrutura: resumo, introdução, enquadramento, trabalho realizado (inclui a comparação com o estudo de caso e as três lacunas), caso de estudo com **novo diagrama de casos de uso** (todos implementados; já não há casos "planeados"), atores e painéis com capturas novas, modelo de dados (4 → 17 entidades), **novo diagrama ER** (Graphviz), qualidade/segurança/entrega, dificuldades (com os erros do teste em browser), próximos passos e conclusão.
- **PPT:** o deck original foi editado pelo PowerPoint (mantém o design e os logótipos IEFP): 4 slides novos (agenda, sumários/mediação, documentos, conformidade) + slide de formador/formando; contadores de rodapé renumerados (n/14); estatísticas novas (231 testes, 17 tabelas, 107 rotas).
- **Capturas:** feitas com a BD de testes semeada (`seed-demo.js`) e o backend ligado a ela (config de arranque `backend-teste-bd`).
- **Bug encontrado durante as capturas:** cartões da Agenda com ~1900 px de altura em ecrãs largos → regra CSS `.content-standard > .section-card { height: auto }`.
- **Conteúdo a confirmar pela Sara:** a frase de que o problema de permissões do MySQL "foi resolvido" (deduzida de as 9 migrações estarem aplicadas); as referências bibliográficas novas (Docker, Jest, OpenAPI) — confirmar se quer mantê-las; a data da entrega (aproximada, fim de outubro).


### 2026-10-22 — Avisos de conformidade por email (pendência do relatório)

Pendência listada no relatório: "avisos de conformidade só se veem no painel". Decisão: **ação manual da coordenação**, não tarefa periódica — um botão na página Conformidade (com confirmação) que envia um email por formador com todas as suas UCs a vermelho. Motivos: sem migração nem processo em segundo plano para manter; a coordenação decide quando avisar (evita spam diário); o texto lista só UC/turma e motivo (sem nomes de formandos). Fica fácil de automatizar mais tarde reutilizando `avisarFormadoresEmFalha()`. Só avisa as UCs a **vermelho**, não as amarelas. `calcular()` passou a devolver `formadorId` por UC. 2 testes novos (aviso enviado ao formador certo com o conteúdo esperado; nada enviado sem UCs a vermelho; só coordenação pode pedir).


### 2026-10-22 — Implementado: comunicados do mediador à turma (lacuna 2 do alinhamento com o estudo de caso)

O estudo de caso dá ao mediador a comunicação com a turma; faltava (já tinha a validação de sumários e a vista de mediação).
- **Modelo `Comunicado`** (turma, autor, assunto, corpo, ativo, createdAt). **Exige migração.** Escolhi tabela própria em vez de reutilizar `Mensagem` (que é 1-para-1 e tem destinos fixos): um comunicado é **um registo para toda a turma**, sem duplicar uma linha por formando.
- **Regras:** envia a coordenação (qualquer turma ativa) ou o **mediador dessa turma** — nem o formador da UC, nem outro formador (`403`); assunto 3–150 e mensagem 5–5000 caracteres; turma inexistente/inativa `404`. Os formandos só leem os da **sua turma** (`409 SEM_TURMA` sem turma). Remover = desativar (autor, mediador da turma ou coordenação).
- **Aviso por email** a cada formando da turma (`COMUNICADO_TURMA`), sem o conteúdo (a leitura é na plataforma).
- **Interface:** `comunicados.html` — formulário (turmas a que pode enviar) + lista de enviados para mediador/coordenação; lista de recebidos para o formando. Se o formador não for mediador de nenhuma turma, vê só a explicação.
- **Reuniões:** não implementadas — o comunicado cobre o aviso; marcar reuniões nos horários livres dos formadores fica como possível evolução.
- **Estado:** `prisma validate` e `node --check` OK; **testes por correr** (tests/helpers.js já limpa `prisma.comunicado`, por isso a suite inteira falha até a migração ser aplicada).

**Falta fazer no terminal da Sara:** `cd backend` → `npx prisma migrate dev --name comunicados` (fechar backend/Prisma Studio se der `EPERM`; depois `npx prisma generate`); aplicar à BD de testes pelo método de `COMO_TESTAR.md`.


### 2026-10-26 — Relatório e PPT regenerados depois dos comunicados

Os documentos de 22/10 não incluíam os avisos de conformidade por email nem os comunicados do mediador. Regenerados (mesmos scripts, scratchpad da sessão) com os números finais: 18 tabelas, 113 rotas, 239 testes, 10 migrações. Texto novo: avisos de conformidade (secção 3.2 e 5.2), comunicados (3.2, 5.3, 6 e anexos A/C), diagramas atualizados. O relatório passou a 22 páginas. **Limitação:** a página `comunicados.html` não aparece nas capturas — o painel do browser recusou abrir `localhost:5500` nessa sessão, por isso não foi verificada visualmente.


### 2026-10-26 — Implementado: reuniões do mediador (última peça do papel de mediador no estudo de caso)

O estudo de caso pede que o mediador possa "agendar reuniões nos horários livres dos formadores". Decisões:
- **Modelo `Reuniao`** (bloco `@unique`, turma, mediador, formador, assunto). **Exige migração.** O formador convidado vem do dono do bloco.
- **Marcar bloqueia o bloco** (`estado BLOQUEADO`, `motivo "Reunião: …"`) em vez de acrescentar um terceiro estado de ocupação. Vantagem: nenhuma alteração à agenda, à grelha, ao relatório de horas nem à marcação de aulas — todos já tratam blocos bloqueados como indisponíveis. Preço: duas proteções novas em `disponibilidade.service` (o formador não pode redefinir nem apagar um bloco com reunião: `409 BLOCO_COM_REUNIAO`).
- **Cancelar apaga a reunião** (sem histórico — é uma marcação, não um registo pedagógico) e devolve o bloco a `LIVRE`; quem cancela pode ser o autor, o formador convidado (recusa) ou a coordenação; a outra parte é avisada.
- **Regras:** só o mediador da turma ou a coordenação marcam (`403`); o formador tem de lecionar uma UC ativa dessa turma (`422 FORMADOR_FORA_DA_TURMA`); bloco ativo, livre, sem aula nem reunião (`409 BLOCO_INDISPONIVEL`), não passado (`422 BLOCO_NO_PASSADO`); não se marca consigo próprio (`422 REUNIAO_CONSIGO`; o mediador não aparece na lista de formadores).
- **Interface:** `reunioes.html` — turma → formador → bloco livre → assunto; lista de reuniões com cancelar. Reutiliza `GET /comunicados/turmas` para as turmas de que se é mediador.
- **Estado:** `prisma validate` e `node --check` OK; **testes por correr** (a suite inteira falha até a migração, porque `helpers.js` limpa `prisma.reuniao`).

**Falta fazer no terminal da Sara (dentro de `backend`):** `npx prisma migrate dev --name reunioes` → `npx prisma generate`; aplicar à BD de testes pelo método de `COMO_TESTAR.md`.



### 2026-10-27 — Reuniões do mediador RETIRADAS da entrega (decisão de consistência)

A funcionalidade (secção de 26/10 acima) estava escrita, mas a migração `reunioes` não chegou a ser aplicada à BD de desenvolvimento e a Sara ia entregar o projeto entretanto. Com o esquema à frente das migrações, a suite de testes falharia toda e o Docker criaria uma BD sem a tabela. **Decisão:** retirar a funcionalidade (modelo `Reuniao`, serviço, controlador, rotas, teste, página `reunioes.html`/`reunioes.js`, entrada de menu, proteções em `disponibilidade.service`, linha em `tests/helpers.js`), deixando o projeto no último estado verde: **18 tabelas, 10 migrações, 239 testes**. O relatório e o PPT já descreviam as reuniões como evolução, por isso não precisaram de alteração. O código foi guardado fora do projeto (pasta temporária da sessão de trabalho) e pode ser reposto: aplicar de novo as alterações e correr `npx prisma migrate dev --name reunioes` + `npx prisma generate` em `backend`.


### 2026-10-27 — Docker removido do projeto

A Sara perguntou para que servia o Docker e pediu para o remover. Era só uma conveniência de entrega (nunca chegou a ser testado a correr). Apagados `backend/Dockerfile`, `backend/.dockerignore` e `docker-compose.yml`; retiradas a secção de Docker do `README.md` e a referência em `Docs/ARQUITETURA.md` (secção Deploy). O arranque normal (MySQL local, `npm run dev`, `npx serve src -l 5500`) não mudou. O relatório e o PPT de outubro ainda citam Docker nos "próximos passos"; regenerar se se quiser limpar isso.


### 2026-10-27 — Estrutura do relatório e diagramas de classes

A Sara trouxe o guia "Estrutura de um Trabalho de Projeto" (capa, índice, introdução, objetivos, metodologia, desenvolvimento, resultados, conclusão, bibliografia, anexos) e perguntou se os diagramas de casos de uso e de classes eram necessários. O guia só pede diagramas "se for possível, para enriquecer"; mesmo assim, como o relatório já tinha casos de uso e ER mas não classes, foram acrescentados **quatro diagramas de classes UML** (utilizadores e turmas; UCs, agenda e sumários; assiduidade e avaliação; comunicação), gerados a partir do `schema.prisma`, com hierarquia Utilizador → Coordenador/Formador/Formando, Mediador como papel do Formador, e multiplicidades. Novo capítulo 6.1 no relatório (agora 27 páginas); Docker retirado do texto do relatório e do PPT (pendência passou a ser o envio real de emails). Os PNG dos diagramas ficaram em `Docs/diagramas/`. **Ainda não feito:** reorganizar o relatório nos 10 capítulos do guia (objetivos, metodologia e resultados como secções próprias; capa com júri, data e local) — aguarda confirmação e dados da Sara (curso, grupo, júri).


### 2026-10-27 — Relatório reorganizado como Trabalho de Projeto

A Sara confirmou que o trabalho é só dela e entregou o horário do curso (PDF do IEFP): curso **25.0422 — Téc. Especialista Tecnologias e Programação de Sistemas de Informação**, Centro de Emprego e Formação Profissional de Santa Maria da Feira. O Trabalho de Projeto (TPJ) está marcado para 11, 13 e 16 de novembro de 2026, com três formadores — **Ana Tavares, João David e Alexandra Almeida** —, que foram usados como júri na capa (deduzido a partir do horário: confirmar com a Sara). Criado `Trabalho_de_Projeto_PlataformaGestaoPedagogica.docx/.pdf` (30 páginas) com a estrutura do guia: capa (entidade, curso, título, formando, júri, data e local), índice, 1 Introdução, 2 Objetivos, 3 Metodologia, 4 Desenvolvimento, 5 Resultados, 6 Conclusão, bibliografia e anexos. O conteúdo do relatório de outubro foi reaproveitado no capítulo 4; objetivos, metodologia, resultados (tabela de números e comparação objetivo a objetivo, com as reuniões do mediador como não cumpridas) e limitações são novos. Os ficheiros `Ponto_Situacao_..._Outubro2026` ficam como estavam. **Por preencher:** data da apresentação na capa; o PPT ainda segue a estrutura antiga.


### 2026-10-27 — PPT alinhado com os capítulos do Trabalho de Projeto

Criado `Trabalho_de_Projeto_PlataformaGestaoPedagogica.pptx` (21 slides) a partir do PPT de outubro, com a ordem do documento: capa (curso, júri), introdução, objetivos (novo), metodologia (etapas e ferramentas), desenvolvimento (casos de uso e dois slides de diagramas de classes novos, depois os ecrãs, a base de dados e a qualidade), resultados (novo: 7 cumpridos, 1 em parte, 1 não cumprido) e conclusão com limitações e próximos passos. Rodapés renumerados (k/19). Falta, na capa, a data da apresentação.


### 2026-10-27 — Data da apresentação

A Sara indicou que a apresentação é a **11 de novembro de 2026** ("pelo menos" — pode haver mais dias). Preenchida na capa do documento (Word e PDF) e no slide 1 do PPT do Trabalho de Projeto; se a data mudar, corrigir nos três.


### 2026-10-27 — Capturas em anexo, pé-de-galinha e modelo de domínio

A Sara pediu (1) que os prints estejam em anexo, (2) que o diagrama de classes use notação pé-de-galinha (crow's foot) e (3) que exista um modelo de domínio. Feito no Trabalho de Projeto (33 páginas): as 15 capturas de ecrã passaram para o **Anexo D**, agrupadas por ator; os diagramas de classes passaram a usar pé-de-galinha nas associações (hierarquia mantida em UML); novo **modelo de domínio** (conceitos e relações, sem atributos) na secção 4.9, antes dos diagramas de classes. Os PNG atualizados estão em `Docs/diagramas/`. O PPT ganhou o slide do modelo de domínio (22 slides); as capturas no PPT ficam nos slides do desenvolvimento.


### 2026-10-27 — Documentos: arrastar e largar

O estudo de caso pedia um formulário "drag-and-drop" para o upload e o repositório só tinha o botão de escolher ficheiro. Acrescentada uma zona de arrastar e largar em `documentos.html`/`documentos.js` (estilo `.dropzone` em `style.css`): o `<input type="file">` continua a ser o campo real (clicar também funciona), a zona realça ao arrastar, mostra o nome e o tamanho do ficheiro escolhido, avisa se tiver mais de 10 MB ou se forem largados vários ficheiros (usa o primeiro) e volta ao estado inicial depois do envio. Sem alterações no backend nem migração. Verificado no browser com a base de testes (seed de demonstração, formador Bruno): largar um ficheiro, enviar e ver o documento listado com o nome oficial IDCurso_UC_Data. Não se arrastou um ficheiro real do explorador (o browser de teste simulou o evento), por isso convém a Sara experimentar uma vez.


### 2026-10-27 — Revisão de código geral, correções e validação

**Pedido da Sara:** analisar todo o projeto, ver o que falta, corrigir e validar. **Método:** revisão de código só de leitura, em 6 partes (backend: segurança/middleware, agenda/UCs, módulos pedagógicos; frontend: 2 partes) sobre `backend/src`, `schema.prisma` e `src/js`, sem `.env`, uploads nem dados pessoais; cada achado foi depois verificado no código antes de agir. Análise estática própria (ligações das páginas, imports, menu, rotas registadas vs. chamadas do frontend, restos de depuração): sem ligações partidas nem rotas em falta.

**Corrigido (e coberto por testes novos em `tests/integration/revisao.test.js`, 10 testes):**
- `GET /aulas/turma-uc/:id` e `GET /turma-ucs/turma/:turmaId` estavam abertos a qualquer utilizador autenticado (um formando lia aulas, UCs e formadores de outras turmas). Passam a exigir ser coordenação, formador responsável, mediador da turma ou formando da própria turma (`lib/acesso.js`: `garantirAcessoLeituraTurmaUc` / `garantirAcessoLeituraTurma`); `incluirInativos` só para a coordenação. UC inexistente passa a dar 404.
- **Sessões:** o JWT leva agora uma impressão da palavra-passe (`ph`, `lib/sessao.js`) e `requireAuth` compara-a a cada pedido: redefinir a palavra-passe invalida as sessões antigas (sem migração). Tokens emitidos antes desta alteração deixam de valer — os utilizadores voltam a entrar. O frontend já tratava qualquer 401 a limpar a sessão e a ir para o login.
- **Email em produção:** sem `SMTP_HOST` e com `NODE_ENV=production`, o transporte falha em vez de usar o serviço de teste (Ethereal) — antes enviaria palavras-passe temporárias e ligações de recuperação para fora. `getTransporter` passou a ser exportado (para o teste).
- **XSS em atributos:** `formadores.js` e `turmas.js` escapam agora os valores dos atributos `data-*` (o nome de um formador pode vir de um pedido de acesso público).
- **Mediador:** não era possível remover o mediador de uma turma ("Sem mediador" enviava `undefined`); passa a enviar `null`.
- Token de calendário com `id` não inteiro dava 500; passa a 404.
- Reagendar uma aula para um bloco de um dia que já passou passa a dar 422 `DATA_PASSADA`.
- Nota: `null`, texto vazio e booleanos deixam de virar 0/1.
- Frontend: respostas fora de ordem em `assiduidade.js`, `notas.js` e `pautas.js` (escolher rapidamente a UC A e depois a B podia gravar na UC errada) — a tabela esconde-se enquanto carrega e ignora respostas atrasadas; `abrirFicheiroProtegido` abre o separador durante o clique (bloqueadores de pop-ups).
- `src/js/script.js`: removido o código morto do protótipo (dados fictícios, `alert()`, prazos — as funções nunca eram chamadas); ficaram só as mensagens de validação em português e os contadores/filtros das tabelas. **Correção de uma dedução minha:** tinha dado como risco um `alert` no perfil, mas esse código nunca chegou a ser executado.

**Verificado e descartado:** a falha de uma notificação a apagar o ficheiro de um documento (`notificar` apanha os erros e nunca lança); o papel só vir do JWT (não existe nenhuma rota que altere o papel de uma conta); `T240000` no calendário (as aulas não chegam à meia-noite).

**Aceite como limitação conhecida (não corrigido):** concorrência extrema (dois pedidos no mesmo instante ao agendar, validar um sumário, recuperar a palavra-passe ou bloquear blocos); regras de data/hora que comparam só o dia e usam UTC em vez do fuso de Lisboa (presenças, prazos de trabalhos, aulas "já dadas" no próprio dia); substituir o formador reatribui o histórico no relatório de horas; reativar associações/UCs sem revalidar as entidades inativas; mediador inativo no seletor de edição de turma.

**Validação:** `npm test` — **27 suites / 249 testes, todos a passar** (eram 26 / 239). Browser (BD de testes semeada; backend na porta 4001 e uma cópia do frontend com a API apontada a essa porta, porque a 4000 estava ocupada pelo servidor de desenvolvimento da Sara): todas as páginas dos três papéis carregam sem erros de rede nem de consola; comunicados (mediadora envia → formando vê), botão "Avisar formadores" (200, "2 formador(es) avisado(s)"), arrastar e largar documentos, remover mediador, nome malicioso de formador sem executar código e com o `data-nome` intacto, perfil sem alertas, acessos entre turmas (403/200/404 como esperado), seleção rápida nas notas, abertura de ficheiro. **Lição de processo:** duas execuções do `jest` em paralelo sobre a mesma BD de testes apagam os dados uma à outra — correr uma de cada vez e não com o browser ligado a essa BD.


### 2026-10-27 — Captura dos documentos atualizada

A captura da página de Documentos (Anexo D do Trabalho de Projeto e slide do repositório de documentos no PPT) mostrava ainda o botão antigo de escolher ficheiro. Foi tirada uma nova, com a zona de arrastar e largar e um ficheiro escolhido (BD de testes semeada, UC00604), e trocada no Word, no PDF e no PPT. A legenda passou a referir a zona de arrastar e largar.


### 2026-10-27 — Segunda passagem de revisão: HTML, CSS, migrações, scripts e testes

**Pedido da Sara:** rever as partes que a revisão de código geral não tinha coberto. **Método:** verificações próprias (HTML, CSS, rotas sem teste, documentação OpenAPI, deriva entre migrações e schema) e revisão de código só de leitura em 8 partes (HTML em 2, CSS, migrações + schema, script de criar coordenador, testes em 3); cada achado verificado no código antes de agir. Os dados enviados eram só código e fixtures de teste fictícias (`@teste.pt`, `Teste123!`).

**Verificado sem problemas:**
- **Migrações vs. schema:** `prisma migrate diff` contra a BD de testes → *No difference detected*; `migrate status` → *up to date* (10 migrações).
- **OpenAPI:** as **113 rotas** do Express estão todas documentadas (113 operações no Swagger, nenhuma documentada que não exista). A contagem anterior de "93 blocos para 113 rotas" era um artefacto — um bloco documenta várias operações; a conclusão "20 rotas sem documentação" que dei antes estava **errada**.
- **Testes:** 112 das 113 rotas têm teste (a heurística apontou 8, mas 7 estavam cobertas com caminhos construídos por `${}`); só `GET /sumarios/meus` não tinha — passou a ter. Sem `.skip`/`.only` esquecidos. O `jest.config.js` já corre os ficheiros em série (`maxWorkers: 1`).
- HTML: sem ids duplicados, todas as páginas com `lang`, `title` e `viewport`; sem `alert()` nem `console.log` de depuração (só no mailer, de propósito).

**Corrigido:**
- **Biblioteca de ícones (25 páginas):** `unpkg.com/@phosphor-icons/web` sem versão e sem integridade passou a `@2.1.2` com `integrity` (SRI) e `crossorigin` — um pacote externo comprometido já não corre em todas as páginas.
- **Acessibilidade:** 16 botões de fechar só com ícone ganharam `aria-label="Fechar"`; pesquisas e filtros (formadores, formandos, turmas, prazos), o email das credenciais, a fotografia e as turmas do perfil ganharam nome acessível; `autocomplete` nos campos de email e palavra-passe (login, redefinir, esqueci, nova conta de formador); indicador de foco por teclado visível (`:focus-visible`).
- **HTML:** um `</button>` a mais em `formadores.html`; `rel="noopener noreferrer"` num link `target="_blank"`.
- **Pedido de acesso (`forms.html`):** o `pattern` do email só aceitava minúsculas; passou a aceitar maiúsculas (continua a exigir domínio `.pt`, regra original — decisão de negócio a confirmar: emails como `gmail.com` ficam de fora).
- **CSS:** a barra lateral móvel ficava no topo (faltava `top: auto`); os modais e os avisos ficavam *por baixo* da barra móvel (`z-index` 1000 vs 9999) — passaram para cima.
- **Palavra-passe:** o bcrypt só usa os primeiros 72 bytes; `src/lib/validacao.js` recusa mais de 72 bytes ao registar, redefinir e criar formadores (antes aceitava e truncava em silêncio).
- **`criar-coordenador.js`:** a máscara da palavra-passe via `readline` voltava a escrevê-la ao apagar uma letra; passou a ler tecla a tecla em modo *raw* (só escreve `*`). Valida nome e email (sem espaços/malformado) e o limite de 72 bytes; sai com `process.exitCode` em vez de `process.exit(1)`.
- **Testes — segurança do ambiente:** `tests/setupEnv.js` passou a usar `override: true` e **recusa arrancar** se a base de dados não tiver "test" no nome — uma `DATABASE_URL` herdada do terminal a apontar para a BD de desenvolvimento já não pode ser apagada por engano.
- **Testes novos** (`revisao.test.js`, agora 15): descarregar documento (formando da turma 200; outra turma/outro formador 403; sem token 401), responder a mensagem só pelo destinatário, notas 0 e 20 válidas (20,01 recusado), `GET /sumarios/meus`, palavra-passe de 73 bytes recusada. O teste de SMTP em produção já não pode passar em silêncio.

**Não corrigido, com razão:**
- **Migração `20260904134342_uc_catalogo_turma_uc`:** apaga colunas (`aulas.ucId`, `ucs.formadorId/turmaId`) antes de copiar os dados para `turma_ucs`. É uma migração já aplicada em desenvolvimento e em testes; alterá-la quebraria o histórico. Numa base nova (seed, instalação limpa) funciona; **numa base com dados antigos perderia associações** — não usar com dados reais anteriores a esta migração. Fica como limitação conhecida.
- **Modais sem `role="dialog"`/`aria-modal` e sem gestão de foco** (muitas páginas): fica como limitação de acessibilidade.
- **CSS:** início de sessão com altura baixa/zoom, e regras repetidas (6 seletores) — sem impacto funcional.
- **Testes dependentes da data real** (aulas de 2030 como "futuras", `2026-09-10` como "passada"): continuam válidos até 2030; fixar o relógio fica como melhoria. Falta ainda testar a expiração da janela do limitador e os limites da janela de 30 dias/12 meses do calendário.
- Pontos dos testes já cobertos de outra forma (ex.: respostas a mensagens e acesso a documentos de outra turma, que a revisão achava por testar) ou sem risco (`idCursoIEFP` é da turma).


### 2026-10-27 — Secção "Implementações futuras" no Trabalho de Projeto

A Sara pediu uma secção com implementações futuras. Acrescentada a **6.4 Implementações futuras** (capítulo da Conclusão), com uma tabela de 13 itens por prioridade — curta (reuniões do mediador, avisos periódicos de conformidade, teste com email real, ativação de conta por ligação), antes de produção (HTTPS e RGPD, armazenamento externo de ficheiros, concorrência, fuso de Lisboa), média (mover aulas ao substituir formador, testes do frontend, frontend modular e acessível, importar o horário do curso) e longa (notificações na plataforma e PWA). Os itens vêm das limitações e decisões já registadas aqui, de `backend/RGPD.md` e da revisão de código; "importar o horário" e "notificações/PWA" são ideias novas, não compromissos. O capítulo 6.3 passou a chamar-se "Limitações" e foi atualizado: já não diz que a página de comunicados e o botão de avisar formadores não foram vistos no browser (foram, a 2026-10-27), e passou a referir a concorrência, o fuso horário, a migração de 4 de setembro e a acessibilidade dos modais. O documento passou a ter 35 páginas.


### 2026-10-27 — Slide "Implementações futuras" no PPT

Acrescentado ao PPT do Trabalho de Projeto o slide 22 ("Implementações futuras", a seguir à Conclusão): cinco itens para fechar e pôr em produção (reuniões do mediador, avisos periódicos, email real e ativação por ligação, HTTPS e RGPD, concorrência e fuso de Lisboa) e três evoluções (frontend modular e testado, mover aulas ao trocar de formador, importar o horário e app instalável). O PPT passou a 23 slides e os rodapés foram renumerados (k/21). O slide de Conclusão manteve os três "próximos passos" com estimativas de sessões que já lá estavam — convém rever se se quer manter as duas listas.


### 2026-10-27 — Conclusão do PPT sem a lista de próximos passos

A Sara pediu para tirar a lista de "próximos passos" do slide de Conclusão (as estimativas de sessões eram minhas e agora havia duas listas parecidas). O slide 21 passou a chamar-se "Conclusão e limitações" e mantém só as cinco limitações, numa faixa de largura total em duas colunas; os próximos passos ficam só no slide "Implementações futuras".


### 2026-10-27 — Verificação do SMTP

A frase "sem SMTP configurado" do PPT tinha vindo de um slide anterior sem ter sido confirmada. Verificado: `backend/.env` não tem nenhuma chave `SMTP_*` (nem comentada), `.env.test` também não, e não há variáveis `SMTP_*` no ambiente; só o `.env.example` as traz, comentadas. Logo não há servidor SMTP real configurado: nos testes o `mailer` usa `jsonTransport` (simulação em memória) e, em desenvolvimento, a conta de teste Ethereal (não envia emails reais). **Não verificado:** se o Ethereal chegou a funcionar (precisa de internet; as falhas só aparecem na consola do backend). Frase do slide de Conclusão corrigida para "testado em simulação; nenhum servidor SMTP real configurado". O texto do Word já dizia "testado em simulação e não com um servidor de email real".


### 2026-10-27 — Script de teste de email (`scripts/testar-email.js`)

A Sara pediu para testar o envio com um servidor SMTP real. Não há credenciais SMTP no projeto (verificado) e a palavra-passe tem de ficar só no `.env` dela, por isso foi criado `backend/scripts/testar-email.js`: lê o `.env`, mostra o modo (sem a palavra-passe), faz `verify()` à ligação e ao login e envia um único email de teste ao endereço indicado. **Testado:** em modo Ethereal (ligação e login OK, email aceite, pré-visualização devolvida — o código de envio por SMTP, TLS e autenticação funciona), com um servidor inexistente (`ECONNREFUSED`, saída com código 1) e com destinatário inválido (mensagem de uso). **Por testar:** o envio real, à espera de a Sara preencher `SMTP_*` no `.env`. Instruções em `COMO_TESTAR.md`.


### 2026-10-28 — Preparação da entrega (documento, relatório e PPT)

Auditoria final dos ficheiros de entrega: texto do Word (420 parágrafos, ~7 600 palavras) e dos 23 slides pesquisados por números e frases desatualizadas (239/249 testes, Docker, "ponto de situação", marcas de rascunho): sem resíduos, salvo o título da secção 4.1 (passou de "Evolução desde o ponto de situação de setembro" a "Evolução do projeto") e a frase do slide 5 (o frontend usa CDNs de ícones e tipos de letra, por isso passou a "sem serviços de backend geridos por terceiros"). Metadados: autor Sara Londreira e título nos três ficheiros (antes "Un-named" e "PptxGenJS"). Criada a pasta `Entrega/` (ao lado do projeto) só com `Trabalho_de_Projeto_PlataformaGestaoPedagogica` em `.docx`, `.pdf` (35 páginas) e `.pptx` (23 slides). **Por confirmar com a Sara:** o júri na capa (dedução a partir do horário do TPJ); o teste de envio com SMTP real (interrompido, falta indicar o destinatário).


### 2026-10-28 — Teste de email: decisão do domínio .pt e primeira tentativa

**Decisão confirmada pela Sara:** o pedido de acesso (`forms.html`) aceitar só emails com domínio `.pt` é **intencional** (apenas maiúsculas/minúsculas foram corrigidas a 2026-10-27).

**Teste de envio com SMTP real — não concluído:** `node scripts/testar-email.js saralondreira@gmail.com` correu em modo Ethereal ("SMTP_HOST não definido") — o `backend/.env` tem só `DATABASE_URL`, `JWT_SECRET`, `PORT` e `CORS_ORIGIN` e não é modificado desde 2026-07-30, ou seja, as variáveis `SMTP_*` ainda não estão gravadas nesse ficheiro. Nenhum email chegou à caixa do Gmail (o "aceite" foi da caixa fictícia do Ethereal). A repetir depois de gravar `SMTP_*` no `.env`.


### 2026-10-28 — Verificação de congruência (código, documentos, relatório e PPT)

**Pedido da Sara:** "O projeto está congruente?". Verificação feita confrontando os números e as afirmações dos documentos com o código (18 modelos, 10 migrações, 113 rotas, 29 páginas, 27 suites) e o Anexo A do relatório com as rotas reais. **Incoerências encontradas e corrigidas:**
- **Aprovação de pedidos de acesso:** o relatório e o slide descreviam um só passo (aprovar cria a conta); o código faz dois (`PATCH /:id/aprovar` → `A_AGUARDAR_RH`; `PATCH /:id/confirmar-conta-criada` cria a conta e envia as credenciais). Texto e Anexo A corrigidos; também as rotas de horário geral e de relatório de horas (`GET /aulas`, `GET /aulas/relatorio-formadores`).
- **Capturas antigas:** as de turmas, formadores, pedidos de acesso e perfil eram de setembro (menu antigo). Refeitas com a interface atual, no Word (Anexo D) e nos slides 12 e 13.
- **Filtro por estado de turmas e formadores:** mostrava "TODOS (0)" e não filtrava, porque os contadores eram calculados com a tabela ainda vazia. Novo `src/js/filtroTabela.js` (contadores, filtro e pesquisa juntos); o valor `data-estado` das turmas passou a corresponder às opções (`em-curso`...) e as opções inexistentes (arquivadas, canceladas) saíram.
- **Formador criado pelo fluxo dos RH** ficava com `estadoFormador` nulo (badge "ATIVO" a vermelho): a conta passa a ser criada com `ATIVO` e o frontend não depende disso; teste novo.
- **Perfil:** o campo "Turmas (Atuais)" mostrava duas turmas fixas do protótipo; passou a vir da API conforme o papel.
- **Documentos do projeto:** `CONTEXTO.md` (estava a 20/10: dizia 152 testes, guarda e logout por fazer, relatório de setembro como o da entrega) e `README.md` (funcionalidades, estrutura e versão inglesa) reescritos; `ARQUITETURA.md` acrescenta sessões invalidadas e o email em produção.
- **PPT:** a substituição automática de números (239→249→254→255) tocou também em valores de atributos (cores, alturas); repostos a partir do original. Metadados e títulos conferidos.

**Estado:** 27 suites / **255 testes** a passar; Word 35 páginas, PPT 23 slides, pasta `Entrega/` atualizada.

### 2026-10-28 — Auditoria de código e correções

**Pedido da Sara:** auditoria completa e rigorosa; corrigir o que for real. A auditoria foi feita por áreas (autenticação, rotas, serviços, ficheiros, interface, testes, documentação) e cada achado foi confirmado no código antes de corrigir.
- **Falsos positivos / já resolvidos:** `.gitignore` do backend já ignorava `.env` e `uploads` (reforçado também na raiz); 27 ficheiros de teste e não 29; `/api/v1/health` existe; `notificar()` nunca lança erro.
- **Corrigido:** ver `CHANGELOG.md`, secção "auditoria de código (2026-10-28)".
- **Fica como limitação conhecida (documentada):** concorrência em agenda, notas, disponibilidade e substituição de formador; regras de hora sem fuso de Lisboa; migração `20260904134342` só segura numa base nova; modais sem semântica de diálogo; token em `localStorage` (opção de desenho); `API_ORIGIN` fixo em `localhost:4000`; palavra-passe com mínimo de 6 caracteres; anexo de justificação substituído não é apagado do disco.

**Estado:** 30 suites / **279 testes** a passar.
- **Formador por aula (2026-10-28):** a atribuição histórica ao formador atual deixou de ser limitação: o formador de cada aula é o dono do bloco de disponibilidade (`Aula.disponibilidade.formadorId`), por isso horários, relatório de horas e calendário já não mudam ao substituir o formador da UC.
- **Sessão em cookie httpOnly (2026-10-28):** o token em `localStorage` deixou de ser limitação: o JWT vai num cookie `httpOnly` com proteção CSRF (`lib/cookieSessao.js`); o frontend não vê o token. Fica por corrigir só a migração `20260904134342`.
