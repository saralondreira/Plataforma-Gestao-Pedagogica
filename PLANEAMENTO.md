# Ponto de Situação e Planeamento

> 14 de julho de 2026 · Sem prazo fixo — plano organizado por fases e prioridades.

## Ponto de situação

### ✅ Feito
- UI completa e responsiva: login, forms, dashboard, turmas, formadores, perfil
- Firebase configurado (Auth + Firestore) e ligado ao projeto `plataforma-gestaopedagogica`
- Autenticação (login/registo) em `auth.js` com toasts
- Módulos JS por página com leitura/escrita Firestore: `dashboardCoord.js`, `turmas.js`, `formadores.js`, `perfil.js`, `forms.js`

### ⚠️ Problemas detetados na revisão (14/jul)

| # | Problema | Impacto |
|---|----------|---------|
| P1 | **`firestore.rules` expiraram a 09/05/2026** (`allow read, write: if request.time < timestamp.date(2026, 5, 9)`) | Todos os pedidos ao Firestore são **negados desde maio** — nada funciona contra a base de dados |
| P2 | **`dashboardCoord.html` não tem nenhuma tag `<script>`** | O `dashboardCoord.js` (250 linhas) nunca corre; o dashboard não carrega dados nem menus |
| P3 | **`login.html` importa `src="auth.js"`** (caminho errado; devia ser `../js/auth.js`) | O login está partido — 404 ao carregar o módulo |
| P4 | **Sem guarda de autenticação** nas páginas internas (só `perfil.js` usa `onAuthStateChanged`) | Qualquer pessoa acede ao dashboard/turmas/formadores por URL sem login |
| P5 | **"Terminar Sessão" é um link direto** para login.html, sem `signOut()` | A sessão Firebase fica ativa após "logout" |
| P6 | **`agenda.html` é placeholder** ("Agenda em Desenvolvimento") | Funcionalidade prometida no ponto de situação por fazer |
| P7 | **Trabalho todo por commitar** — 12 ficheiros modificados + 7 novos desde o último commit | Risco de perda; histórico git não reflete a fase Firebase |
| P8 | Detalhes menores: `&copy:` em vez de `&copy;` nos footers; scripts inline em `forms.html` duplicam lógica de `forms.js`; header da agenda mostra "Utilizador"/"??" fixo | Polimento |

## Plano de trabalho

### Fase 0 — Desbloquear (fazer primeiro, ~1 sessão)
1. **Commit de segurança** do estado atual num branch (ex.: `firebase-integration`) — resolve P7 antes de mexer em mais alguma coisa
2. **Corrigir `firestore.rules`** — substituir a regra expirada por regras reais: leitura/escrita apenas para utilizadores autenticados (`request.auth != null`) e fazer deploy (P1)
3. **Corrigir caminho do `auth.js`** em login.html (P3)
4. **Adicionar `<script>` em falta** ao dashboardCoord.html (script.js + dashboardCoord.js) (P2)
5. **Testar o ciclo completo:** registo → login → dashboard lê Firestore → criar turma → aparece na tabela

### Fase 1 — Autenticação sólida (~1–2 sessões)
1. Criar um `guard.js` partilhado com `onAuthStateChanged`: redireciona para login se não autenticado; incluir em todas as páginas internas (P4)
2. Implementar `signOut()` no botão "Terminar Sessão" (P5)
3. Preencher nome/avatar reais no header de todas as páginas a partir do perfil (substituir "Utilizador"/"??")

### Fase 2 — Dados reais em todo o lado (~2–3 sessões)
1. Auditar página a página: eliminar restos de dados simulados de `script.js` onde já há Firestore
2. Completar CRUD: editar e apagar turmas/formadores (hoje há sobretudo criar/ler)
3. Unificar `forms.html`: mover os dois blocos `<script type="module">` inline para `forms.js`
4. Definir e documentar o modelo de dados Firestore (coleções: `turmas`, `formadores`, `perfis`, `pedidosAcesso`, `documentos`) em `CONTEXTO.md`

### Fase 3 — Agenda (funcionalidade nova, ~2–3 sessões)
1. Grelha de calendário mensal (CSS Grid, navegação mês anterior/seguinte)
2. Formadores marcam disponibilidade (escrita em coleção `disponibilidades`)
3. Coordenadora vê disponibilidades agregadas no calendário

### Fase 4 — Qualidade e entrega (~1–2 sessões)
1. Corrigir P8 (typos, headers, código duplicado)
2. Roles: distinguir coordenador vs. formador (campo `role` no perfil; menus e permissões consoante o papel)
3. Rever regras Firestore por coleção (não apenas "autenticado pode tudo")
4. Atualizar README.md (ainda descreve só a fase frontend) e escrever relatório final
5. Merge do branch para main

### Critério de "feito" por fase
Cada fase termina com: teste manual do fluxo completo no browser + commit com mensagem descritiva. Não avançar de fase com erros na consola.

## Ordem de ataque imediata
**P7 → P1 → P3 → P2 → teste.** Sem isto, nada do resto é verificável, porque a app está efetivamente partida em três pontos (regras expiradas, login com 404, dashboard sem scripts).
