# Contexto do Projeto — Plataforma de Gestão Pedagógica

> Criado a 30 de julho de 2026 · última atualização a 28 de outubro de 2026

## O que é

Projeto final que junta três Unidades de Competência: UC00604 (Programação Web — Frontend), UC00605 (Backend) e UC00614 (Integração de Sistemas). Uma plataforma web para centros de formação que substitui a entrega física de documentação (CDs, papel) por um sistema digital centralizado, com rastreio de entregas, prazos e gestão de turmas e formadores. Destinatários: coordenação, formadores (com o papel de mediador numa turma, se designados) e formandos. Contexto real: as contas não são de auto-registo — uma entidade externa (ex.: IEFP) atribui o email à pessoa, que pede acesso, e a coordenação decide; a conta só é criada quando os RH tratam do email.

## Stack

- **Frontend:** HTML5, CSS3 (variables, Flexbox, Grid, media queries), JavaScript vanilla (ES modules), servido como estático (`npx serve`).
- **Backend:** Node.js + Express (`backend/`), estrutura em camadas `routes/controllers/services/middleware`.
- **Base de dados:** MySQL + Prisma ORM (`backend/prisma/schema.prisma`).
- **Autenticação:** JWT + `bcrypt` para passwords. No browser o JWT vai num cookie `httpOnly` (`pedagogica_sessao`, `SameSite=Lax`, `Secure` em produção); os pedidos que alteram dados exigem o cabeçalho `X-Requested-With: pedagogica` e a origem da aplicação (CSRF); `POST /auth/logout` apaga o cookie. Clientes de API (testes, scripts) usam `Authorization: Bearer` (`backend/src/lib/cookieSessao.js`).
- **Uploads:** `multer`, disco local em `backend/uploads/`. **Nunca servidos como estáticos** — só saem por rotas autenticadas que verificam quem pode ver cada ficheiro.
- **Testes:** Jest (unitários) + Supertest (integração), base de dados de teste dedicada.
- **Documentação da API:** OpenAPI/Swagger em `/api-docs` (gerado via `swagger-jsdoc` a partir de anotações nas rotas).
- **Ícones:** Phosphor Icons (versão fixa, com SRI) · **Fonte:** Inter
- **Estado (2026-10-28):** 18 tabelas, 10 migrações, 114 rotas (todas no Swagger), 29 páginas, 30 suites / 279 testes a passar. Detalhe das alterações em `CHANGELOG.md` e `PLANEAMENTO.md`.

> O projeto usou inicialmente Firebase (Auth + Firestore + Storage) para a fase 2, mas foi totalmente substituído por esta stack própria — ver "Histórico resumido" abaixo. Não há Firebase em nenhuma parte do código atual.

## Estrutura

```
src/                            # Frontend estático
  css/style.css                 # ~1650 linhas — reset, layout, componentes, responsivo
  js/
    api-client.js               # Cliente fetch central: cookie de sessão (credentials: include), base da API (API_ORIGIN)
    guard.js, menu.js           # Guarda por papel (data-roles) e menu partilhado
    sanitize.js, filtroTabela.js, formatos.js, toast.js   # utilitários (escape de HTML, filtros de tabela, formatos, avisos)
    script.js                   # só as mensagens de validação de formulários em português
    uma página = um módulo      # dashboardCoord/Formador/Formando, turmas, formadores, formandos, agenda, agendaFormador,
                                # turmaUcs, pedidosAcesso, sumarios, documentos, conformidade, comunicados, notas, assiduidade,
                                # trabalhos, mensagens, pautas, horario, horarioGeral, relatorioHoras, pesquisa, perfil, login/recuperação
  pages/                        # 29 páginas HTML

backend/                        # API Node/Express + MySQL
  prisma/schema.prisma          # 18 modelos (User, Turma, Uc, TurmaUc, Disponibilidade, Aula, Sumario, DocumentoUc, Nota,
                                #   NotaHistorico, Presenca, Justificacao, Trabalho, SubmissaoTrabalho, Mensagem, Comunicado,
                                #   Entrega, PedidoAcesso)
  prisma/migrations/            # 10 migrações
  src/
    app.js, server.js           # Express (rotas, CORS, Swagger) e arranque
    routes/ controllers/ services/ middleware/ lib/   # camadas; lib/ = acesso, mailer, notificações, calendário .ics, sessão
    docs/swagger.js             # definição OpenAPI
  scripts/                      # seed-demo.js, criar-coordenador.js, testar-email.js
  tests/                        # unit/ e integration/ (Supertest contra uma BD de testes dedicada)
  RGPD.md, .env.example         # checklist de proteção de dados; variáveis de ambiente
Docs/                           # ARQUITETURA.md e diagramas (casos de uso, ER, domínio, classes)
```

## Modelo de dados (Prisma/MySQL)

- **User** — unifica autenticação, perfil e (quando `role=FORMADOR`) a ficha de formador (sigla, turmasQtd, ucsQtd, estadoFormador). Substitui as antigas coleções Firestore `perfis` + `formadores`. `role` é `COORDENADOR | FORMADOR | FORMANDO` (FORMANDO acrescentado na Fase 8b, 2026-09-02, migração aplicada com sucesso à BD real e de teste em 2026-09-04). Quando `role=FORMANDO`, o campo `turmaId` (opcional, 2026-09-09) liga a conta a uma Turma — um formando está, no máximo, numa turma de cada vez; é assim que o dashboard do formando sabe que UCs e aulas mostrar. A turma pode ser definida na aprovação do Pedido de Acesso, ou mudada depois em qualquer altura na página "Gestão Formandos" (`GET /formandos`, `PATCH /formandos/:id/turma` — só COORDENADOR — ver 2026-09-10 em `PLANEAMENTO.md`).
- **Turma** — código, designação, data de início, nº formandos, estado.
- **Notas, assiduidade, trabalhos e mensagens (2026-10-20):** `Nota` (uma por formando/`TurmaUc`, escala 0–20), `Presenca` (por aula/formando) e `Justificacao` (falta justificada = `AUSENTE` + justificação `ACEITE`), `Trabalho` + `SubmissaoTrabalho` (prazo, reenvio, avaliação), `Mensagem` (formando/formador/coordenação; "assistente social" não é um papel — a coordenação trata). Só o formador responsável pela UC nessa turma (ou a coordenação) mexe em notas/presenças/trabalhos; o formando só vê o que é seu. Ver `PLANEAMENTO.md`, entrada de 2026-10-20.
- **Entrega** — documento pendente/entregue, ligado por FK real a `User` (formador) e `Turma`. Campo `submissaoTipo` (FICHEIRO/EXCECAO/COORDENACAO) regista como foi concluída.
- **PedidoAcesso** — pedidos de acesso à plataforma antes de existir conta (rota pública). `estado` é `PENDENTE | A_AGUARDAR_RH | APROVADO | REJEITADO`. Desde 2026-09-10 (fluxo via RH — ver `PLANEAMENTO.md`), aprovar (`PATCH /:id/aprovar`, só COORDENADOR) já não cria a conta: só regista o papel/turma escolhidos (`roleDecidido`/`turmaIdDecidido`) e passa a `A_AGUARDAR_RH`. A conta só é criada (e o email de credenciais enviado — `backend/src/lib/mailer.js`, desde a Fase 8b nunca devolvida em claro) em `PATCH /:id/confirmar-conta-criada`, quando a coordenação confirma que os RH já a criaram fora da plataforma. `rejeitar` aceita PENDENTE ou A_AGUARDAR_RH.
- **Painéis de resumo (2026-10-20):** `GET /painel/resumo` + `src/js/painel.js` nos três dashboards (UCs e pendentes do formador, aproveitamento do formando, alertas e formandos em risco da coordenação). Ver `PLANEAMENTO.md`.
- **Notificações por email das funcionalidades novas (2026-10-20):** nota lançada, justificação submetida/decidida, trabalho novo/avaliado, mensagem nova/respondida — sem conteúdo sensível no email (`backend/src/lib/notificacoes.js`). Ver `PLANEAMENTO.md`.
- **Notificações por email (2026-09-09):** `backend/src/lib/mailer.js` também envia um email ao formador quando é (re)atribuído a lecionar uma UC numa turma (`turmaUc.service.js`), e ao formador designado mediador de uma turma (`turmas.service.js`). Ver `PLANEAMENTO.md` para o âmbito e a decisão de não expor o email do formador nos `select` públicos existentes.
- **Soft delete ("flag em vez de eliminar", 2026-09-04):** `User`, `Turma`, `Uc`, `TurmaUc`, `Entrega` e `Disponibilidade` têm agora um campo `ativo` (`Boolean @default(true)`). Apagar já não é destrutivo — marca `ativo: false`; listagens filtram `ativo: true` por omissão (`?incluirInativos=true` para ver tudo) e há `PATCH /:id/reativar` para desfazer. `Aula` fica de fora por agora (motivo técnico e detalhe completo em `PLANEAMENTO.md`, entrada de 2026-09-04).

- **Sumários, documentos, conformidade e comunicados (2026-10-22):** `Sumario` (um por aula; o formador escreve, o mediador ou a coordenação valida ou rejeita com motivo), `DocumentoUc` (repositório por UC, nome oficial `IDCurso_UC_Data`, histórico), semáforos de conformidade por UC (`GET /painel/conformidade`, sumários + documentos + horário) com aviso por email aos formadores em falha, e `Comunicado` (aviso do mediador a todos os formandos de uma turma). Ver `PLANEAMENTO.md`.
- **Recuperação de palavra-passe, sessões e dados de demonstração (2026-10-22 a 28):** ligação de 1 h e uso único; o JWT leva uma impressão da palavra-passe, por isso redefini-la invalida as sessões anteriores. `npm run seed` cria uma turma completa de demonstração (só numa base vazia).

## Histórico resumido

1. **Fase 1 (concluída):** UI completa com dados simulados em `script.js` — dashboard com semáforos de prazos, tabelas dinâmicas, modais, validações, responsivo mobile.
2. **Fase 2 — Firebase (concluída e depois substituída):** integração com Firebase Auth + Firestore + Storage. Funcionou, mas foi identificado que o guia oficial da UC00605/UC00614 exige uma API própria (Node/Express + SQL relacional + JWT), não um BaaS gerido — ver `Plataforma_Pedagogica_Guia_Materia.docx`.
3. **Fase 3 — Migração para stack própria (concluída):** backend Node/Express + MySQL + Prisma + JWT construído por fases verticais (Turmas → Formadores/Perfil → Entregas+upload → Pedidos de Acesso), cada uma testada ponta-a-ponta no browser antes de avançar. Firebase removido por completo do projeto.
4. **Fase 4 (concluída):** testes automatizados (Jest/Supertest), documentação OpenAPI, checklist RGPD.
5. **Fases 5–8 (concluídas):** agenda, papéis de formando e de mediador, notas/assiduidade/trabalhos/mensagens, sumários, documentos, conformidade, comunicados, recuperação de palavra-passe e revisões de código (2026-10-20 e 2026-10-27).

## Por fazer

- **Reuniões do mediador** nos horários livres dos formadores — chegou a ser desenvolvido mas foi retirado antes da entrega por exigir uma migração que não foi aplicada (`PLANEAMENTO.md`, 2026-10-27).
- **Envio de email:** decidido (2026-10-28) manter **simulado** na entrega: sem `SMTP_*` no `.env` o backend usa o Ethereal (não entrega a ninguém). O envio real fica por testar; o script `backend/scripts/testar-email.js` e `COMO_TESTAR.md` explicam como.
- Ver `backend/RGPD.md`: HTTPS, política de privacidade e consentimento, apagamento e portabilidade, retenção de anexos, ficheiros fora do disco local.
- **Limitações conhecidas** (2026-10-28): a migração `20260904134342_uc_catalogo_turma_uc` só é segura numa base nova; as regras de data usam o dia de Lisboa mas não a hora exata; fotografia e currículo do perfil ainda não têm backend. Já corrigido: a sessão do browser está num cookie httpOnly com proteção CSRF (já não há token em `localStorage`); o formador de cada aula é o dono do bloco de disponibilidade em que ela está, por isso substituir o formador de uma UC não altera as aulas já dadas (horários, relatório de horas e calendário); agendar, bloquear horários, lançar notas e substituir formador são serializados na base de dados (`backend/src/lib/bloqueios.js`); "hoje" é o dia de Lisboa (`backend/src/lib/tempo.js`); modais acessíveis (`src/js/modais.js`); `API_ORIGIN` configurável; palavra-passe mínima de 8 caracteres; o anexo de justificação substituído é apagado do disco.
- **Cancelar uma Aula continua a ser `DELETE` definitivo** (não entrou no soft delete) por causa da restrição `@unique` em `Aula.disponibilidadeId`.
- **Disponibilidade:** também tem `ativo`; remover um bloco desativa-o (não há rota de reativar: o formador volta a marcar o bloco).
- `CHANGELOG.md` e `PLANEAMENTO.md` registam o histórico; este ficheiro descreve só o estado atual.

## Documentos de referência

- `Docs/estudo-de-caso.docx` — estudo de caso original (não versionado: está no `.gitignore`)
- `Docs/ARQUITETURA.md` e `Docs/diagramas/` — arquitetura e diagramas (casos de uso, base de dados, domínio, classes)
- `backend/RGPD.md` — checklist de proteção de dados
- `PLANEAMENTO.md` — decisões por data · `CHANGELOG.md` — resumo do que mudou · `COMO_TESTAR.md` — comandos de arranque e de teste · `GUIA_RAPIDO.md` — convenções e armadilhas
- **Entrega:** pasta `Entrega/` (ao lado do projeto) com `Trabalho_de_Projeto_PlataformaGestaoPedagogica` em `.docx`, `.pdf` e `.pptx`. Os ficheiros `Ponto_Situacao_*` e `Ponto_de_Situacao_*` em `Relatório Ponto Situação/` são relatórios intermédios (junho, setembro e outubro de 2026).
