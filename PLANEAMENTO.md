# Ponto de Situação e Planeamento

> 30 de julho de 2026 · Sem prazo fixo — plano organizado por fases e prioridades.

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
1. Grelha de calendário mensal (CSS Grid, navegação mês anterior/seguinte).
2. Nova entidade `Disponibilidade` no schema Prisma (formadorId, data, período).
3. Formadores marcam disponibilidade; coordenadora vê disponibilidades agregadas no calendário.
4. Endpoints REST + testes, seguindo o mesmo padrão das restantes entidades.

### Fase 7 — Segurança antes de um deploy real (~1 sessão)
1. Rate limiting no login/registo (Q4).
2. Proteger o acesso aos ficheiros em `/uploads` (Q5).
3. Rever os restantes itens do checklist `backend/RGPD.md` (política de privacidade, direito ao apagamento).
4. Preparar `Dockerfile`/variáveis de ambiente de produção (M07 do guia).

### Critério de "feito" por fase

Cada fase termina com: testes automatizados a passar (`npm test` no `backend/`) + teste manual do fluxo completo no browser + commit com mensagem descritiva. Não avançar de fase com testes ou consola com erros.
