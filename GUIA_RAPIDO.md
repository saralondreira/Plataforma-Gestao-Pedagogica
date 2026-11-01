# Guia rápido do projeto

Guia rápido para quem trabalhe neste projeto. Este ficheiro é propositadamente curto — a documentação completa está nos ficheiros linkados abaixo. Lê-os antes de mexer em código.

## O que é este projeto

Plataforma de Gestão Pedagógica — projeto académico da Sara (UC00604/UC00605/UC00614), gerido nesta pasta. Stack: HTML/CSS/JS vanilla no frontend (`src/`), Node/Express + MySQL + Prisma + JWT/bcrypt no backend (`backend/`).

## Antes de mexer em qualquer coisa, lê

- **`CONTEXTO.md`** — visão geral atual: stack, modelo de dados, estado de cada papel (Coordenador/Formador/Formando).
- **`PLANEAMENTO.md`** — histórico completo de decisões, discussões e problemas resolvidos, por data. Pedido explícito da Sara: **regista aqui sempre que tomares uma decisão relevante** (com data, o que foi decidido, e a discussão que levou lá) — nunca apagar o que já lá está, só acrescentar.
- **`CHANGELOG.md`** — lista curta e cronológica do que mudou. Atualiza também sempre que fizeres uma alteração relevante ao código.
- **`COMO_TESTAR.md`** — comandos exatos de terminal para arrancar e testar o projeto no dia a dia.
- **`README.md`** — instruções de instalação inicial (primeira vez a clonar o projeto).

## Convenções obrigatórias

- Escreve sempre em português europeu (PT-PT) — nunca português do Brasil.
- Documenta decisões relevantes no `PLANEAMENTO.md` (com data) e resume-as no `CHANGELOG.md`.
- Backend: `cd backend && npm run dev` (porta 4000). Frontend: `npx serve src -l 5500` a partir da **raiz do projeto** (nunca de dentro de `backend` — isso serve o código do servidor, não as páginas). O backend só aceita pedidos de `http://localhost:5500` (CORS).
- Testes: `cd backend && npm test` — usa sempre `backend/.env.test`, nunca a base de dados de desenvolvimento.

## Armadilhas conhecidas (não percam tempo a redescobrir)

- **Nomes de modelos Prisma todo em maiúsculas** geram um acessor estranho no client (`UC` → `prisma.uC`, não `prisma.uc`). Usar `PascalCase` normal (`Uc`).
- **`EPERM: operation not permitted, rename ...query_engine-windows.dll.node...`** ao correr `npx prisma generate` / `migrate dev` no Windows: outro processo Node (o `npm run dev` do backend, ou o Prisma Studio) está a bloquear o ficheiro do engine. Fechar esse processo (ou `Stop-Process -Name node -Force`) e repetir resolve sempre.
- **`.env` vs `.env.test`**: o Prisma CLI lê sempre `.env`; os testes (`npm test`) leem sempre `.env.test` diretamente (via `tests/setupEnv.js`). Para aplicar uma migração à base de testes **não** se renomeiam ficheiros (já aconteceu ficarem trocados sem ninguém dar por isso durante semanas): usa-se o método de `COMO_TESTAR.md`.
- **Método a usar:** para aplicar uma migração à base de testes, definir `DATABASE_URL` só na sessão do PowerShell a partir do `.env.test` (método em `COMO_TESTAR.md`) — foi assim que se fez em 2026-10-20, sem incidentes.
- Se o histórico de migrações de uma base de dados ficar dessincronizado da estrutura real (ex.: "No pending migrations to apply" mas falta uma tabela), `npx prisma migrate reset` na base de **testes** resolve sempre (dados sempre descartáveis lá).
- `npx prisma generate` e `npm install` correm sempre no terminal da própria Sara — noutros ambientes arriscam corromper os binários nativos do Prisma de um `node_modules` preparado para Windows.

## Nunca fazer sem pedir

- Não apagar conteúdo do `PLANEAMENTO.md` — só acrescentar.
- Há repositório git configurado (branch `desenvolvimento`). O git é gerido pela Sara (decisão dela, 2026-10-20): não fazer commits nem pushes.
