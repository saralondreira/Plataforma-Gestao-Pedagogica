# Plataforma de Gestão Pedagógica
### Projeto Final — UC00604 (Frontend) · UC00605 (Backend) · UC00614 (Integração de Sistemas)

## 📝 Visão Geral
Este projeto nasce da necessidade de modernizar os processos administrativos em centros de formação, substituindo métodos obsoletos (como a entrega de documentação em CD) por uma **Plataforma Centralizada de Gestão Formativa**. A solução foca-se na eficiência logística, no rastreio (*tracking*) de conformidade e na segurança de dados sensíveis — com um frontend em HTML/CSS/JS puro a consumir uma API REST própria em Node.js/Express, com base de dados relacional (MySQL).

## 🚀 Funcionalidades Detalhadas

### 1. Painel de Controlo Inteligente (Dashboard da Coordenadora)
* **Algoritmo de Prazos:** cálculo automático dos dias restantes para a entrega de cada documento.
* **Sistema de Semáforos (UX):** 🔴 Crítico (prazo ultrapassado) · 🟡 Hoje · 🔵 Pendente · 🟢 Entregue.
* **Filtros Rápidos:** contadores em tempo real por estado.
* **Indicador de origem da entrega:** ícone que distingue se o documento foi submetido por ficheiro, marcado como exceção (sem ficheiro, com nota), ou confirmado manualmente pela coordenação.

### 2. Painel do Formador
* Lista só os documentos atribuídos ao formador autenticado.
* **Submissão de documentos:** upload real de ficheiro (PDF/Word/imagem) que marca o documento como entregue.
* **Via de exceção:** marcar como enviado sem ficheiro (ex.: entregue por email), com nota justificativa.

### 3. Gestão de Turmas e Formadores
* CRUD completo, ligado à API — criar um formador cria também a sua conta de acesso (email + password).
* Modais de interação com selects populados a partir da API (não texto livre).

### 4. Autenticação e Perfil
* Registo/login com papéis distintos (Coordenador/Formador), password com hash `bcrypt`, sessão via JWT.
* Perfil próprio editável (`GET`/`PATCH /auth/me`).

## 🛠️ Stack Tecnológica

**Frontend**
* HTML5 semântico, CSS3 (variables, Flexbox, Grid, media queries), JavaScript vanilla (ES modules).
* Servido como ficheiros estáticos (`npx serve`), sem bundler.

**Backend** (`backend/`)
* Node.js + Express, estrutura em camadas (`routes/controllers/services/middleware`).
* MySQL + Prisma ORM — schema em `backend/prisma/schema.prisma`, migrações versionadas.
* Autenticação JWT (Bearer token) + `bcrypt` para passwords.
* Upload de ficheiros com `multer`, servidos a partir de `/uploads`.
* Validação de dados com `zod` em todos os endpoints de escrita.
* Testes automatizados: Jest (unitários) + Supertest (integração) contra uma base de dados de teste dedicada.
* Documentação da API: OpenAPI/Swagger interativo em `/api-docs`.

## 📁 Estrutura do Projeto
```text
/src                          # Frontend estático
  /css/style.css
  /js
    api-client.js             # Cliente fetch central (JWT, base da API)
    auth.js, turmas.js, formadores.js, perfil.js, forms.js
    dashboardCoord.js, dashboardFormador.js
  /pages
    login.html, forms.html, dashboardCoord.html, turmas.html,
    formadores.html, dashboardFormador.html, agenda.html (placeholder), perfil.html

/backend                      # API REST
  /prisma
    schema.prisma             # User, Turma, Entrega, PedidoAcesso
    migrations/
  /src
    app.js, server.js
    routes/ controllers/ services/ middleware/ docs/
  /tests
    unit/ integration/
  RGPD.md                     # Checklist de proteção de dados
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
* **Coordinator dashboard:** deadline traffic-light system, quick filters, and an indicator of how each document was submitted (file upload, exception note, or manual confirmation).
* **Trainer dashboard:** lists only the trainer's own assigned documents; real file upload, or an exception path (no file, with a justification note).
* **Classes & trainers management:** full CRUD against the API; creating a trainer also creates their login account.
* **Auth & profile:** JWT-based sessions, `bcrypt`-hashed passwords, role-based accounts (Coordinator/Trainer).

## 🛠️ Technology Stack
* **Frontend:** HTML5, CSS3 (variables, Flexbox, Grid, media queries), vanilla JavaScript (ES modules), served as static files.
* **Backend:** Node.js + Express (layered architecture), MySQL + Prisma ORM, JWT auth, `multer` file uploads, `zod` validation, Jest + Supertest test suite, OpenAPI/Swagger docs at `/api-docs`.

## 📁 Project Structure
See the Portuguese section above — same layout (`/src` for the static frontend, `/backend` for the API).

## ▶️ Running the project
See "Como correr o projeto" above — the commands are the same regardless of language.
