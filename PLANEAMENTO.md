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

## Visão futura — papel Formando e funcionalidades avançadas

> Ideias trazidas por Sara em 2026-09-01, para explorar na disciplina de Trabalho de Projeto (com a formadora responsável). Âmbito maior que as Fases 5-7 e ainda sem sessões estimadas — decompor em fases concretas quando entrarmos em cada bloco.

### Formando (novo papel — hoje o enum `Role` só tem COORDENADOR/FORMADOR)

- Consulta da turma: colegas, horário, formador, UC atual.
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

- Novo valor no enum `Role`: `FORMANDO`, e provavelmente uma entidade `Formando` própria (hoje a Turma não tem membros individuais modelados).
- Novas entidades prováveis: `Nota`, `Justificacao`, `Trabalho` + `SubmissaoTrabalho`, `Mensagem`/`Comunicacao` (com um campo de destinatário: coordenação, formador ou assistente social).
- `Curso` como entidade separada de `Turma`, com várias UCs associadas (carga horária + formador por UC).
- `Disponibilidade` (já prevista na Fase 6) passa a ser também a restrição usada no agendamento de aulas pelo coordenador.

### Critério de "feito" por fase

Cada fase termina com: testes automatizados a passar (`npm test` no `backend/`) + teste manual do fluxo completo no browser + commit com mensagem descritiva. Não avançar de fase com testes ou consola com erros.
