# Contexto do Projeto — Plataforma de Gestão Pedagógica

> Última atualização: 30 de julho de 2026

## O que é

Projeto final que junta três Unidades de Competência: UC00604 (Programação Web — Frontend), UC00605 (Backend) e UC00614 (Integração de Sistemas). Uma plataforma web para centros de formação que substitui a entrega física de documentação (CDs, papel) por um sistema digital centralizado, com rastreio de entregas, prazos e gestão de turmas e formadores. Destinatários: coordenadores e formadores.

## Stack

- **Frontend:** HTML5, CSS3 (variables, Flexbox, Grid, media queries), JavaScript vanilla (ES modules), servido como estático (`npx serve`).
- **Backend:** Node.js + Express (`backend/`), estrutura em camadas `routes/controllers/services/middleware`.
- **Base de dados:** MySQL + Prisma ORM (`backend/prisma/schema.prisma`).
- **Autenticação:** JWT (Bearer token) + `bcrypt` para passwords.
- **Uploads:** `multer`, disco local em `backend/uploads/`, servido em `/uploads`.
- **Testes:** Jest (unitários) + Supertest (integração), base de dados de teste dedicada.
- **Documentação da API:** OpenAPI/Swagger em `/api-docs` (gerado via `swagger-jsdoc` a partir de anotações nas rotas).
- **Ícones:** Phosphor Icons · **Fonte:** Inter

> O projeto usou inicialmente Firebase (Auth + Firestore + Storage) para a fase 2, mas foi totalmente substituído por esta stack própria — ver "Histórico resumido" abaixo. Não há Firebase em nenhuma parte do código atual.

## Estrutura

```
src/                            # Frontend estático
  css/style.css                 # ~1400 linhas — reset, layout, componentes, responsivo
  js/
    api-client.js               # Cliente fetch central: JWT em localStorage, base da API
    auth.js                     # Login/registo via API
    script.js                   # Motor original (cálculo de prazos, modais) — legado, ainda usado nalgumas páginas
    dashboardCoord.js           # Painel da coordenadora — Entregas via API
    dashboardFormador.js        # Painel do formador — submeter documento / exceção
    turmas.js                   # CRUD turmas via API
    formadores.js               # CRUD formadores via API (cria conta de login real)
    perfil.js                   # Perfil próprio via API (GET/PATCH /auth/me)
    forms.js                    # Pedido de acesso via API (rota pública)
    toast.js                    # Notificações toast
  pages/                        # login, forms, dashboardCoord, turmas, formadores, dashboardFormador, agenda (placeholder), perfil

backend/                        # API Node/Express + MySQL
  prisma/schema.prisma          # User (unifica login+perfil+ficha de formador), Turma, Entrega, PedidoAcesso
  prisma/migrations/
  src/
    app.js                      # Configuração do Express (rotas, CORS, swagger, estáticos)
    server.js                   # Entrypoint (app.listen)
    routes/ controllers/ services/ middleware/
    docs/swagger.js             # Definição OpenAPI
  tests/
    unit/                       # Testes de validação (zod), sem BD
    integration/                # Supertest contra a app, com BD de teste dedicada
  RGPD.md                       # Checklist de proteção de dados
  .env.example                  # Variáveis de ambiente necessárias
```

## Modelo de dados (Prisma/MySQL)

- **User** — unifica autenticação, perfil e (quando `role=FORMADOR`) a ficha de formador (sigla, turmasQtd, ucsQtd, estadoFormador). Substitui as antigas coleções Firestore `perfis` + `formadores`.
- **Turma** — código, designação, data de início, nº formandos, estado.
- **Entrega** — documento pendente/entregue, ligado por FK real a `User` (formador) e `Turma`. Campo `submissaoTipo` (FICHEIRO/EXCECAO/COORDENACAO) regista como foi concluída.
- **PedidoAcesso** — pedidos de acesso à plataforma antes de existir conta (rota pública).

## Histórico resumido

1. **Fase 1 (concluída):** UI completa com dados simulados em `script.js` — dashboard com semáforos de prazos, tabelas dinâmicas, modais, validações, responsivo mobile.
2. **Fase 2 — Firebase (concluída e depois substituída):** integração com Firebase Auth + Firestore + Storage. Funcionou, mas foi identificado que o guia oficial da UC00605/UC00614 exige uma API própria (Node/Express + SQL relacional + JWT), não um BaaS gerido — ver `Plataforma_Pedagogica_Guia_Materia.docx`.
3. **Fase 3 — Migração para stack própria (concluída):** backend Node/Express + MySQL + Prisma + JWT construído por fases verticais (Turmas → Formadores/Perfil → Entregas+upload → Pedidos de Acesso), cada uma testada ponta-a-ponta no browser antes de avançar. Firebase removido por completo do projeto.
4. **Fase 4 (concluída):** testes automatizados (Jest/Supertest), documentação OpenAPI, checklist RGPD.

## Por fazer

- **Agenda** (`agenda.html`) continua placeholder — funcionalidade nova, não iniciada (calendário mensal, disponibilidade de formadores).
- **Guarda de autenticação no frontend**: as páginas internas não verificam sessão antes de renderizar (só redirecionam se uma chamada à API falhar com 401). Considerar um `guard.js` partilhado.
- **"Terminar Sessão"** ainda é só um link para `login.html` — não limpa o token/utilizador do `localStorage` (`clearSession()` existe em `api-client.js` mas não está ligado a nenhum botão).
- Ver `RGPD.md` para o checklist de itens pendentes antes de um deploy com dados reais.

## Documentos de referência

- `Docs/estudo-de-caso.docx` — estudo de caso original
- `Plataforma_Pedagogica_Guia_Materia.docx` — guia de matéria oficial (Frontend + Backend + Integração de Sistemas), motivou a migração da Fase 3
- `backend/RGPD.md` — checklist de proteção de dados
- `../Relatório Ponto Situação/Ponto_de_Situacao_SaraLondreira.docx` — ponto de situação (30/jun/2026, já desatualizado face à Fase 3)
- `PLANEAMENTO.md` — ponto de situação atual e plano de trabalho
