# Contexto do Projeto — Plataforma de Gestão Pedagógica

> Última atualização: 14 de julho de 2026

## O que é

Projeto final da UC00604 (Programação Web — Frontend). Uma plataforma web para centros de formação que substitui a entrega física de documentação (CDs, papel) por um sistema digital centralizado, com rastreio de entregas, prazos e gestão de turmas e formadores. Destinatários: coordenadores, mediadores, formadores e formandos.

## Stack

- **Frontend:** HTML5, CSS3 (variables, Flexbox, Grid, media queries), JavaScript vanilla (ES modules)
- **Backend:** Firebase — Authentication (email/password) + Firestore (projeto `plataforma-gestaopedagogica`)
- **Ícones:** Phosphor Icons · **Fonte:** Inter
- **Cloud Functions:** pasta `src/functions` inicializada mas sem funções escritas (apenas boilerplate)

## Estrutura

```
src/
  css/style.css            # ~1400 linhas — reset, layout, componentes, responsivo
  js/
    firebase-config.js     # Inicialização Firebase (app, auth, db)
    auth.js                # Login/registo com Firebase Auth
    script.js              # Motor original (dados simulados, prazos, modais) — legado
    dashboardCoord.js      # Dashboard com leitura Firestore (getDocs)
    turmas.js              # CRUD turmas via Firestore
    formadores.js          # CRUD formadores via Firestore
    perfil.js              # Perfil com onAuthStateChanged + getDoc/setDoc
    forms.js               # Pedido de acesso (escreve no Firestore)
    toast.js               # Notificações toast
  pages/
    login.html             # Entrada
    forms.html             # Pedido de acesso
    dashboardCoord.html    # Painel principal (semáforos de prazos)
    turmas.html            # Gestão de turmas
    formadores.html        # Gestão de formadores
    agenda.html            # PLACEHOLDER — "Agenda em Desenvolvimento"
    perfil.html            # Perfil (campos readonly)
  firestore.rules          # Regras Firestore (⚠️ expiradas — ver PLANEAMENTO.md)
  firebase.json, firestore.indexes.json
```

## Histórico resumido

1. **Fase 1 (concluída):** UI completa com dados simulados em `script.js` — dashboard com semáforos de prazos, tabelas dinâmicas, modais, validações, responsivo mobile (tabelas → cartões).
2. **Decisão de arquitetura:** abandonada a stack inicial mais complexa; migração para Firebase para cumprir prazos (documentado no relatório de ponto de situação de 30/jun).
3. **Fase 2 (em curso):** integração Firebase — ficheiros JS por página criados (auth, dashboard, turmas, formadores, perfil, forms), todos por commitar no git.

## Documentos de referência

- `Docs/estudo-de-caso.docx` — estudo de caso original
- `../Relatório Ponto Situação/Ponto_de_Situacao_SaraLondreira.docx` — ponto de situação (30/jun/2026)
- `../Relatorio_Maio_SaraLondreira.docx` — relatório de maio
- `PLANEAMENTO.md` — ponto de situação atual e plano de trabalho
