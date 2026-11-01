# Plataforma de Gestão Pedagógica
### Projeto Final - UC00604 (Frontend) · UC00605 (Backend) · UC00614 (Integração de Sistemas)

## 📝 Visão Geral
Este projeto nasce da necessidade de modernizar os processos administrativos em centros de formação, substituindo métodos obsoletos (como a entrega de documentação em CD) por uma **Plataforma Centralizada de Gestão Formativa**. A solução foca-se na eficiência logística, no rastreio (*tracking*) de conformidade e na segurança de dados sensíveis — com um frontend em HTML/CSS/JS puro a consumir uma API REST própria em Node.js/Express, com base de dados relacional (MySQL).

## 🚀 Funcionalidades Detalhadas

### 1. Painel de Controlo e Conformidade (Coordenação)
* **Painel de resumo:** pedidos por tratar, justificações pendentes, mensagens por ler, formandos em risco por faltas e o estado de conformidade das UCs.
* **Conformidade automática:** um semáforo por UC (verde, amarelo, vermelho) calculado a partir dos sumários, dos documentos e do horário; a coordenação pode avisar por email os formadores em falha.
* **Pautas e relatórios:** pauta de notas e de assiduidade por turma (CSV e PDF), horário geral e horas por formador.

### 2. Formador e Mediador
* **Sumários:** o formador escreve o sumário de cada aula dada; o mediador da turma (ou a coordenação) valida ou rejeita com motivo. Um sumário validado já não se altera.
* **Documentos por UC:** upload (arrastar e largar) com nome oficial `IDCurso_UC_Data` e histórico; os formandos são avisados por email.
* **Mediação:** o mediador acompanha as UCs e a assiduidade da turma e envia comunicados a todos os formandos.
* **Disponibilidade:** o formador marca blocos de 1 h livres ou bloqueados.

### 3. Gestão de Turmas, UCs, Formadores e Formandos
* Criar, listar, editar, desativar e reativar, tudo ligado à API. Criar um formador cria também a sua conta de acesso; os formandos são geridos pela coordenação.
* Pesquisa e filtro por estado com contadores; "apagar" é uma desativação (soft delete): o histórico mantém-se e pode ser reativado. A exceção é cancelar uma aula, que é um apagamento definitivo.

### 4. Agenda
* O formador define a sua disponibilidade em blocos de 1 h; a coordenação agenda aulas (presencial/online) apenas nos blocos livres, respeitando a carga horária de cada UC. Horário exportável (`.ics`) e subscrevível.
* UCs são um catálogo reutilizável, associado a turmas com um formador por turma.

### 5. Pedidos de Acesso e Gestão de Formandos
* Não há auto-registo: a pessoa submete um Pedido de Acesso (formulário público; só emails `.pt`); a coordenação aprova escolhendo o papel (e a turma, se for formando); a conta é criada num segundo passo, depois de os RH tratarem do email, e as credenciais seguem por email.
* A coordenação gere os formandos e a turma de cada um; o formando tem um dashboard próprio (turma, UCs, próximas aulas).

### 6. Notas, Assiduidade, Trabalhos e Mensagens
* **Notas:** o formador responsável lança notas (0–20) por UC, com histórico de alterações; o formando consulta as suas.
* **Assiduidade:** o formador regista presenças; o formando justifica faltas (com anexo opcional) e o formador/coordenação aceita ou rejeita.
* **Trabalhos:** o formador atribui trabalhos com prazo e avalia; o formando submete e pode reenviar até ao fim do prazo.
* **Mensagens:** formando, formador e coordenação comunicam entre si (com resposta). Os ficheiros enviados nunca são públicos.

### 7. Notificações e pesquisa
* Os eventos importantes geram emails de aviso, sem conteúdo sensível. Pesquisa global (turmas, formadores, formandos, UCs).

### 8. Autenticação e Perfil
* Login com três papéis (Coordenador, Formador, Formando; o mediador é um formador designado numa turma), password com hash `bcrypt`, sessão via JWT.
* Recuperação de palavra-passe por ligação de uso único (1 h); redefinir a palavra-passe invalida as sessões anteriores.
* Perfil próprio editável (`GET`/`PATCH /auth/me`).
* Notificações por email quando um formador é atribuído a uma UC ou designado mediador de uma turma.

## 🛠️ Stack Tecnológica

**Frontend**
* HTML5 semântico, CSS3 (variables, Flexbox, Grid, media queries), JavaScript vanilla (ES modules).
* Servido como ficheiros estáticos (`npx serve`), sem bundler.

**Backend** (`backend/`)
* Node.js + Express, estrutura em camadas (`routes/controllers/services/middleware`).
* MySQL + Prisma ORM — schema em `backend/prisma/schema.prisma`, migrações versionadas.
* Autenticação JWT + `bcrypt` para passwords. No browser a sessão vai num cookie `httpOnly` (o JavaScript não a lê) com proteção CSRF; os clientes de API usam `Authorization: Bearer`.
* Upload de ficheiros com `multer`; o descarregamento exige autenticação (`GET /entregas/:id/ficheiro`), não há acesso público direto à pasta.
* Validação de dados com `zod` em todos os endpoints de escrita.
* Testes automatizados: Jest (unitários) + Supertest (integração) contra uma base de dados de teste dedicada.
* Rate limiting em memória no login e no pedido de acesso público.
* Documentação da API: OpenAPI/Swagger interativo em `/api-docs`.

## 📁 Estrutura do Projeto
```text
/src                          # Frontend estático (29 páginas, um módulo JS por página)
  /css/style.css
  /js                         # api-client.js (JWT, API), guard.js, menu.js, sanitize.js, filtroTabela.js, ...
  /pages
/backend                      # API REST
  /prisma                     # schema.prisma (18 modelos) e migrations/ (10)
  /src                        # app.js, server.js, routes/ controllers/ services/ middleware/ lib/ docs/
  /scripts                    # seed-demo.js, criar-coordenador.js, testar-email.js
  /tests                      # unit/ e integration/ (279 testes)
  RGPD.md                     # Checklist de proteção de dados
/Docs                         # ARQUITETURA.md e diagramas
```

## ▶️ Como correr o projeto

```bash
# 1. Backend
cd backend
cp .env.example .env       # preencher DATABASE_URL e JWT_SECRET
npm install
npx prisma migrate deploy
npm run dev                 # http://localhost:4000 (docs em /api-docs)

# 2. Frontend (noutro terminal)
npx serve src -l 5500       # http://localhost:5500/pages/login.html
```

### Testes
```bash
cd backend
cp .env.example .env.test   # apontar a uma base de dados de teste separada
npm test
```

---

# 🇬🇧 English Version

## 📝 Project Overview
This project was born from the need to modernize administrative processes in training centers, replacing obsolete methods (such as submitting documentation via physical CDs) with a **Centralized Pedagogical Management Platform**. It focuses on logistical efficiency, compliance tracking, and personal data security — a vanilla HTML/CSS/JS frontend consuming a REST API of its own, built with Node.js/Express and a relational database (MySQL).

## 🚀 Key Features
* **Coordination:** dashboard with automatic compliance traffic lights per course unit (summaries, documents, schedule), access-request approval, class/trainer/trainee management, scheduling in the trainers' free slots, gradebooks (CSV/PDF).
* **Trainers and mediators:** lesson summaries validated by the class mediator, document repository per course unit (drag and drop), grades, attendance, assignments, class announcements.
* **Trainees:** timetable (with `.ics` subscription), validated summaries, documents, grades, absence justifications, assignment submissions, messages.
* **Auth & security:** JWT sessions, `bcrypt`-hashed passwords, role-based access (Coordinator/Trainer/Trainee; the mediator is a trainer assigned to a class), password recovery, protected file downloads.

## 🛠️ Technology Stack
* **Frontend:** HTML5, CSS3 (variables, Flexbox, Grid, media queries), vanilla JavaScript (ES modules), served as static files.
* **Backend:** Node.js + Express (layered architecture), MySQL + Prisma ORM, JWT auth, `multer` file uploads, `zod` validation, Jest + Supertest test suite, OpenAPI/Swagger docs at `/api-docs`.

## 📁 Project Structure
See the Portuguese section above — same layout (`/src` for the static frontend, `/backend` for the API).

## ▶️ Running the project
See "Como correr o projeto" above — the commands are the same regardless of language.

## 🌱 Dados de demonstração

Numa base de dados vazia: `cd backend && npm run seed`. Cria uma turma em curso com coordenação, mediadora, formadores, formandos, aulas, sumários e documentos (todas as contas com a palavra-passe `Demo1234!`; o script lista os emails). Mostra os semáforos de conformidade e os painéis com dados.

## 🏗️ Arquitetura

Ver [`Docs/ARQUITETURA.md`](Docs/ARQUITETURA.md).
