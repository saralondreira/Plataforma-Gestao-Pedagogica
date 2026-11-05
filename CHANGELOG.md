# Changelog

> Registo cronológico e resumido das alterações ao projeto, da mais recente para a mais antiga. Para a discussão, as decisões e os "porquês" por trás de cada uma, ver `PLANEAMENTO.md`; para a visão geral atual do projeto (stack, modelo de dados, estado de cada papel), ver `CONTEXTO.md`.

## 2026-10-22

### Adicionado e corrigido: gestão de formandos, agenda, presenças, rodapé e demonstração (2026-11-05)
- **Gestão de formandos (CRUD):** a coordenação cria, edita (nome, email, turma), desativa, reativa e repõe a palavra-passe de um formando (`POST /formandos`, `PATCH /formandos/:id`, `DELETE /formandos/:id`, `PATCH /formandos/:id/reativar`, `PATCH /formandos/:id/password`). Desativar não apaga (mantém notas, presenças e entregas); criar com o email de um formando desativado reativa a conta; repor a palavra-passe invalida as sessões abertas. Novo `tests/integration/formandosCrud.test.js`.
- **Agenda do formador:** seleção de vários horários, a clicar ou a arrastar um retângulo, e uma barra para marcar livre, bloquear (com motivo) ou limpar.
- **Assiduidade:** as presenças confirmadas ficam bloqueadas (só leitura) até o formador clicar em "Editar presenças". O bloqueio é só na página.
- **Turma ao lado da UC:** o título das presenças e a lista de UCs dos Documentos mostram a turma ao princípio.
- **Rodapé:** passou a ter 32 px, fixo no fundo; o menu lateral da coordenação passou a ter scroll próprio, em vez de esticar a página; corrigido o `&copy:` em 4 páginas.
- **Dados de demonstração:** segunda turma (TPSI-DEMO-B) com a mesma UC de Backend, dada por outra formadora, e dois formandos novos (`formando7` e `formando8`).
- **Estado:** 119 rotas, 31 suites / 292 testes a passar.

### Alterado: relatório e PPT com a estrutura do relatório de setembro (2026-11-01)
- O Trabalho de Projeto usa agora a capa, o cabeçalho (logótipo do IEFP), o rodapé (logótipos de financiamento e número de página) e a secção do relatório de setembro; a capa leva o júri e a data com local, o índice e o corpo numeram-se a partir de 1 (53 páginas).
- Travessões ("—") retirados do relatório, do PPT e dos títulos dos diagramas; PPT (46 slides) com os diagramas atualizados e rodapés "Cap. N: ...".
- Novo `Entrega/Diagramas/Diagrama_ER_completo` (PDF vetorial + PNG): as 18 tabelas numa só folha; os 6 diagramas ER parcelares mantêm-se no relatório.

### Alterado — relatório desenvolvido em primeira pessoa (2026-11-01)
- Capítulos 1 a 6 desenvolvidos em primeira pessoa ("decidi X porque Y"): escolha das ferramentas, planeamento, decisões em cada papel (visitante, coordenação, formador/mediador, formando), modelo de dados, qualidade e segurança, e reflexão final. Nova secção **4.12 Decisões de desenho e justificação** (tabela com 12 decisões, o motivo e a alternativa descartada); "Dificuldades encontradas" passou a 4.13. Capítulo 5 com a evolução dos testes, os testes automáticos e as revisões de código (5.4) e o que não foi testado (5.5). Capítulos 1 e 2: porque escolhi o tema, como li o estudo de caso e porque formulei assim os objetivos. Relatório com 52 páginas.

### Corrigido — diagramas refeitos, legíveis e no estilo UML pedido (2026-10-31)
- **Casos de uso:** passou a ser um diagrama UML a sério (atores, fronteira do sistema, associações, `«include»`, `«extend»`, mediador como especialização do formador), em 3 diagramas pequenos.
- **ER:** gerado a partir do SQL real do `schema.prisma`, com todas as colunas e tipos, `*` para NOT NULL, `«PK»`/`«FK»`/`«UNIQUE»`, ligações com verbo e pé-de-galinha; em 6 diagramas (as colunas createdAt/updatedAt omitidas, indicado na legenda). Corrige a nota antiga que dizia que o `PedidoAcesso` não tinha chave estrangeira (tem uma, para a turma decidida).
- **Domínio (2 diagramas) e classes (7 diagramas):** domínio com caixas simples e setas com verbo; classes em UML com atributos tipados, operações reais dos serviços, enumerações e multiplicidades.
- **Legibilidade:** cada diagrama foi dividido até a letra ficar com 7 pt ou mais na página do relatório; ligações redesenhadas para haver o mínimo de cruzamentos.
- Ficheiros em `Docs/diagramas/` (PNG) e, em PNG + PDF vetorial, em `Entrega/Diagramas/`. Relatório (44 páginas, 18 diagramas, dois pares de diagramas pequenos na mesma página) e PPT (slides principais + 18 slides de anexo) atualizados.

### Corrigido — sessão em cookie httpOnly (2026-10-28)
- O JWT deixou de estar em `localStorage`: o login define o cookie `pedagogica_sessao` (`httpOnly`, `SameSite=Lax`, `Secure` em produção) e o frontend só guarda os dados públicos do utilizador. O browser nem recebe o token no corpo da resposta.
- **CSRF:** os pedidos por cookie que alteram dados exigem `X-Requested-With: pedagogica` e a origem de `CORS_ORIGIN` (403 `CSRF_INVALIDO` caso contrário); CORS com `credentials`. `POST /auth/logout` apaga o cookie e o botão "Terminar Sessão" chama-o.
- Clientes de API continuam a usar `Authorization: Bearer`. Novo `tests/integration/sessaoCookie.test.js`; testado no browser (login, pedidos, bloqueio CSRF, logout).

### Corrigido — limitações conhecidas (2026-10-28)
- **Concorrência:** agendar, reagendar, bloquear horários, lançar notas e substituir o formador de uma UC passam a ser serializados na base de dados (bloqueio de linhas, `backend/src/lib/bloqueios.js`); dois agendamentos no mesmo bloco, ou que ultrapassem a carga horária, já não passam os dois.
- **Fuso de Lisboa:** "hoje" nas regras de aulas, prazos de trabalhos, sumários, conformidade e painéis é o dia em Lisboa (`backend/src/lib/tempo.js`).
- **Palavra-passe:** mínimo de 8 caracteres (API, formulários e script do coordenador).
- **Anexos:** o anexo de uma justificação substituída é apagado do disco.
- **Interface:** modais com `role="dialog"`, foco preso, Esc para fechar e regresso do foco (`src/js/modais.js`); endereço da API configurável (`<meta name="api-origin">` ou `window.API_ORIGIN`).
- **Formador por aula:** horários, relatório de horas e calendário usam o formador que deu cada aula (o dono do bloco de disponibilidade), por isso substituir o formador de uma UC já não altera as aulas dadas; sem migração, porque a informação já existia.
- **Fica por fazer:** a migração de setembro, só segura numa base nova. Novo `tests/integration/limitacoes.test.js`.

### Corrigido — auditoria de código (2026-10-28)
- **Segurança:** upload de entregas com o id validado (path traversal), nomes únicos e tipos de ficheiro limitados; ficheiros recusados são apagados; o papel do utilizador é lido da base de dados e não do token; abrir ficheiros só mostra PDF/imagens/texto (o resto descarrega); `X-Content-Type-Options: nosniff`; XSS corrigido no painel da coordenação; limitador próprio para redefinir a palavra-passe; redefinição segura contra pedidos em simultâneo.
- **Regras:** transições de pedidos de acesso, sumários e respostas a mensagens protegidas por estado (duas decisões em simultâneo: ganha uma); reativar uma UC respeita as horas já dadas; reagendar e submeter trabalhos recusam associações inativas; o painel de resumo só serve os três papéis; datas inexistentes (30 de fevereiro) recusadas; JSON inválido devolve 400; ficheiros .ics com fim de aula a passar da meia-noite.
- **Interface:** respostas antigas já não sobrepõem seleções mais recentes (documentos, assiduidade); reagendar não passa para outra UC; editar turma não retira o mediador se a lista não carregou; falhas no dashboard do formando já não aparecem como listas vazias; foco por teclado sempre visível.
- **Duplo envio:** um formulário submetido fica bloqueado (botões desativados) até o pedido terminar; mudar a turma de um formando só abre com a lista de turmas carregada. Testes reforçados (seed com todas as contas, caminho real dos ficheiros de entregas, emails de agendamento verificados antes de limpar a caixa de saída).
- **Documentação:** `COMO_TESTAR.md` (preparação dos testes, `migrate dev` vs `deploy`, aviso do `reset`), README, ARQUITETURA, CONTEXTO, GUIA_RAPIDO e RGPD alinhados com o código. Novo `tests/integration/auditoria.test.js`. Total: 28 suites / 262 testes (30 / 279 depois de corrigir as limitações e a sessão).

### Corrigido — verificação de congruência (2026-10-28)
- Filtro por estado e contadores das turmas e dos formadores (`filtroTabela.js`); formador criado pelos RH com estado ATIVO; "Turmas (Atuais)" do perfil vem da API; `CONTEXTO.md`, `README.md` e `ARQUITETURA.md` atualizados.
- Relatório e PPT: aprovação de pedidos em dois passos, Anexo A e capturas de turmas, formadores, pedidos e perfil refeitas. Total: 27 suites / 255 testes.

### Adicionado — Teste de envio de email
- `backend/scripts/testar-email.js` (verifica a ligação e o login SMTP e envia um email de teste) e secção "Testar o envio de email" em `COMO_TESTAR.md`.

### Corrigido — segunda passagem de revisão (2026-10-27)
- **Frontend/HTML:** biblioteca de ícones com versão fixa e SRI; nomes acessíveis (`aria-label`) nos botões de fechar e nos filtros; `autocomplete` nos campos de email/palavra-passe; foco por teclado visível; `</button>` a mais removido; email do pedido de acesso aceita maiúsculas.
- **CSS:** barra lateral móvel e modais/avisos sobrepostos corrigidos.
- **Backend/scripts:** palavra-passe limitada a 72 bytes (bcrypt); `criar-coordenador.js` com leitura oculta robusta e validações.
- **Testes:** os testes recusam correr contra uma base que não seja de testes; 5 testes novos (total 27 suites, 254 testes). Migrações e schema sem deriva; as 113 rotas estão documentadas no Swagger.

### Corrigido — revisão de código geral (2026-10-27)
- **Segurança:** aulas e UCs por turma só para quem pertence à turma; sessões deixam de valer ao redefinir a palavra-passe; em produção o email exige `SMTP_HOST`; escape dos atributos `data-*` (XSS); token de calendário inválido dá 404.
- **Correções:** remover o mediador de uma turma; reagendar para o passado recusado; notas com `null`/vazio recusadas; respostas fora de ordem nas notas, assiduidade e pautas; abrir ficheiros sem ser bloqueado como pop-up.
- **Limpeza:** código morto do protótipo removido de `script.js`.
- **Testes:** `revisao.test.js` (10 testes) — total 27 suites / 249 testes. Detalhe e limitações conhecidas em `PLANEAMENTO.md` (2026-10-27).

### Adicionado — Documentos: arrastar e largar
- Zona de arrastar e largar no envio de documentos (frontend apenas).

### Adicionado — Trabalho de Projeto (documento e apresentação)
- `Trabalho_de_Projeto_PlataformaGestaoPedagogica.pptx`: 21 slides alinhados com os capítulos do documento.

- `Trabalho_de_Projeto_PlataformaGestaoPedagogica.docx/.pdf` na pasta `Relatório Ponto Situação`, com a estrutura do guia do TPJ (capa, índice, introdução, objetivos, metodologia, desenvolvimento, resultados, conclusão, bibliografia, anexos).

### Adicionado — Diagramas de classes (relatório e Docs/diagramas)
- Quatro diagramas de classes UML (PNG em `Docs/diagramas/`, junto dos de casos de uso e ER) e secção 6.1 no relatório; Docker removido do relatório e do PPT.

### Retirado da entrega — Reuniões do mediador (não incluídas)
- Foram desenvolvidas (marcar reunião com um formador da turma num bloco livre, bloqueando-o) mas **retiradas do projeto antes da entrega**, porque exigiam uma migração que não chegou a ser aplicada. O código está guardado fora do projeto e pode ser reposto. Continua a ser uma evolução possível (ver relatório, "Próximos passos").

### Atualizado — Relatório e PPT com os avisos de conformidade e os comunicados
- `Ponto_Situacao_PlataformaGestaoPedagogica_Outubro2026` (.docx, .pdf, .pptx) regenerados: **18 tabelas, 113 rotas, 239 testes (26 ficheiros), 10 migrações**; diagramas de casos de uso e de base de dados com os comunicados; novos parágrafos sobre os avisos de conformidade e os comunicados; "próximos passos" reduzidos às reuniões do mediador, avisos periódicos, Docker e endurecimento.

### Adicionado — Comunicados à turma (mediador) — **exige migração**
- O **mediador da turma** (ou a coordenação) envia um **comunicado a todos os formandos de uma turma** (`comunicados.html`, menu dos três papéis); os formandos leem-no na plataforma e recebem um email de aviso (sem o conteúdo). O autor, o mediador e a coordenação podem remover (desativar). Nova tabela `comunicados` (`Comunicado`) e rotas `/comunicados` (`POST /`, `GET /enviados`, `/turmas`, `/turma`, `DELETE /:id`) com OpenAPI. 6 testes em `comunicados.test.js` — **por correr até aplicares a migração**.

### Adicionado — Avisos de conformidade por email aos formadores — sem migração
- Na página **Conformidade** (coordenação), o botão **"Avisar formadores em falha"** envia um email a cada formador com UCs a vermelho (um só email por formador, a listar as suas UCs e o que falta: sumários em atraso, sem documentos). Nova rota `POST /painel/conformidade/avisar` (só coordenação; devolve quantos formadores e UCs foram avisados). O email não leva dados de pessoas. 2 testes novos em `conformidade.test.js`.

### Atualizado — Relatório e apresentação de outubro (+ correção de CSS na Agenda)
- **Relatório** `Ponto_Situacao_PlataformaGestaoPedagogica_Outubro2026.docx` (+ `.pdf`, 21 páginas) e **PPT** `..._Outubro2026.pptx` (14 slides + capa e fecho), na pasta `Relatório Ponto Situação` (os ficheiros de 3 de setembro ficam como histórico). Texto, números (17 tabelas, 107 rotas, 231 testes), diagramas de casos de uso e de base de dados refeitos, capturas de ecrã novas (login, painel, agenda, conformidade, documentos, sumários, mediação, painéis de formador/formando).
- **Corrigido (CSS):** nos ecrãs largos os cartões da Agenda ficavam com ~1900 px de altura (regra `.section-card { height: 100% }` aplicada a cartões empilhados). Nova regra `.content-standard > .section-card { height: auto }` em `src/css/style.css`.

### Corrigido — Teste completo no browser (3 papéis) — sem migração
- **Sumários: o mediador já não valida o próprio sumário.** Se o mediador da turma era também o formador da UC, o seu sumário aparecia-lhe em "por validar" e ele podia validá-lo. Agora um formador nunca valida o que escreveu (`403`), não o vê na lista, e o aviso de "sumário por validar" vai para a coordenação; a coordenação pode sempre validar. 1 teste novo em `sumarios.test.js` (11/11).
- **Etiquetas de horas enganadoras:** "Dadas"/"Horas dadas" nas UCs contavam as horas **agendadas** (passadas + futuras). Passaram a "Agendadas"/"Por agendar" (agenda, UCs da turma, mediação, painel do formador). O relatório "Horas por Formador" já distinguia bem dadas e por dar.
- **Documentos:** o botão descarrega o ficheiro com o **nome oficial** (`IDCurso_UC_Data.ext`) em vez de abrir um separador com nome aleatório.
- **Conformidade:** as etiquetas de estado já não partem em duas linhas.

### Adicionado — Pacote de entrega: seeds, Docker, arquitetura, RGPD — sem migração
- **Dados de demonstração:** `npm run seed` (`backend/scripts/seed-demo.js`) cria uma turma em curso com coordenação, mediadora, 2 formadores, 6 formandos, aulas (dadas e futuras), presenças, notas, sumários em todos os estados, documentos, um trabalho e uma mensagem — mostra os três semáforos de conformidade e um formando em risco. Só corre numa base de dados vazia (ou com `--forcar`) e recusa `NODE_ENV=production`. Testado em `seed.test.js` (3 testes).
- ~~Docker~~ — **removido a 2026-10-27** (`Dockerfile`, `.dockerignore`, `docker-compose.yml` e secções da documentação); o projeto corre sem ele.
- **Documentação:** novo `Docs/ARQUITETURA.md` (diagramas, papéis, módulos, segurança, deploy, variáveis de ambiente); `backend/RGPD.md` atualizado (sumários, documentos, recuperação de palavra-passe, dados de demo); `README.md` com secções de Docker, seed e arquitetura.

### Adicionado — Recuperação de palavra-passe e login com "olho" — sem migração
- "Esqueci a palavra-passe" passou a funcionar: `esqueci-password.html` pede o email e `redefinir-password.html` define a nova palavra-passe. Novas rotas `POST /auth/esqueci-password` (resposta igual exista ou não a conta; só envia a contas ativas) e `POST /auth/redefinir-password`. O email leva uma ligação com um token **válido 1 hora e de uso único** (JWT assinado com o segredo + hash atual da palavra-passe — não precisa de tabela). Limitador de 5 pedidos por hora por IP. No login (e na nova palavra-passe) há agora um botão "olho" para mostrar/ocultar a palavra-passe (`mostrarPassword.js`). `recuperacaoPassword.test.js` com 5 testes. Variável opcional `FRONTEND_URL` para o endereço da ligação (por omissão usa `CORS_ORIGIN`).

### Adicionado — Conformidade automática (semáforos por UC) — sem migração
- Novo serviço `conformidade.service.js` e rota `GET /painel/conformidade` (coordenação vê todas as UCs das turmas em curso; o formador só as suas). Cada UC recebe um semáforo que é o pior de três critérios: **sumários** (aula dada sem sumário há mais de 2 dias → vermelho; recente em falta ou por validar → amarelo), **documentos** (UC com aulas dadas e nenhum documento ativo → vermelho) e **horário** (horas por agendar sem aulas futuras → amarelo). Nova página `conformidade.html` (menu da coordenação e do formador) e cartões "UCs em falha / com atenção / em dia" no painel da coordenação (`conformidade` em `/painel/resumo`). `conformidade.test.js` com 7 testes.

### Adicionado — Repositório de documentos por UC — **exige migração**
- O formador responsável (ou a coordenação) envia documentos para cada UC de uma turma (`documentos.html`); o ficheiro fica com o **nome oficial `IDCurso_UC_Data.ext`** (ID do curso IEFP da turma, ou o código da turma se não tiver; `_v2`, `_v3`… para envios no mesmo dia) e os formandos da turma são avisados por email. Vêem e descarregam os formandos da turma, o formador responsável, o mediador e a coordenação. Remover só esconde (soft delete): o **histórico de envios** (com os removidos) é visível ao responsável e à coordenação. Nova tabela `documentos_uc` e novas rotas `/documentos` (`turma`, `turma-uc/:id` GET/POST, `:id/ficheiro`, `:id` DELETE). Aceita pdf, doc(x), ppt(x), xls(x), png, jpg, txt, zip até 10 MB. Entrada "Documentos" no menu dos três papéis. `documentos.test.js` com 7 testes — **por correr até aplicares a migração**.

### Adicionado — Sumários (núcleo do estudo de caso) — **exige migração**
- **Sumários de aula com validação pelo mediador**: o formador responsável escreve o sumário de cada aula já dada (`sumarios.html`, "Por escrever"); fica "Por validar" e o **mediador da turma** (ou a coordenação, se não houver mediador) é avisado por email; valida ou rejeita (com motivo obrigatório); o formador é avisado e, se rejeitado, corrige e volta a submeter; um sumário validado já não se altera. O **formando** vê os sumários **validados** da sua turma. Nova tabela `sumarios` (`Sumario`, um por aula). Novas rotas `/sumarios` (`por-escrever`, `meus`, `por-validar`, `turma`, `aula/:id` GET/PUT, `:id/decidir`) com OpenAPI. Entrada "Sumários" no menu dos três papéis. 10 testes novos em `sumarios.test.js` — **por correr: precisam da migração** (ver PLANEAMENTO).

### Adicionado
- **Avisar os formadores para marcarem disponibilidade**: depois de "Repetir esta semana…", se alguma aula ficou por agendar porque o formador não marcou essa hora, a interface oferece avisá-lo por email (um email por formador, com a lista de datas/horas e a indicação de abrir "A Minha Agenda"). Novo `POST /disponibilidade/pedir-marcacao` (só coordenação); as falhas `SEM_BLOCO` de `/aulas/repetir-semana` passam a trazer `formadorId`. Sem migração. 2 testes novos em `disponibilidade.test.js` (8→10; com `aula.test.js`, 40/40).
- **Repetir uma semana de aulas** (`agenda.html` → "Horário da turma" → "Repetir esta semana…"): repete as aulas da semana visível nas N semanas seguintes (1 a 16) — mesmo dia da semana, hora, UC, formador e modalidade — para montar o horário tipo de uma formação de uma só vez. Novo `POST /aulas/repetir-semana` (só coordenação). Cada aula passa pelas regras normais; as que falham (formador sem bloco livre nessa hora, turma ocupada, carga horária esgotada…) vêm com a data e o motivo e não impedem as outras. Sem migração. 2 testes novos em `aula.test.js` (30/30).
- **Aulas de hoje e dos próximos 7 dias no painel da coordenação** (`dashboardCoord.html`): duas tabelas novas com as aulas de todas as turmas (hora/data, UC, turma, formador, modalidade). `GET /painel/resumo` (coordenação) passa a incluir `aulas`. Sem migração. 1 teste novo em `painel.test.js` (8/8).
- **Pesquisa global** (`pesquisa.html`, coordenação, menu "Pesquisa"): uma caixa que procura, enquanto se escreve (a partir de 2 letras), em turmas (código, designação, ID de curso), formadores (nome, sigla, email), formandos (nome, email — com a turma) e UCs do catálogo, só registos ativos, com ligação à página de gestão respetiva. Novo `GET /pesquisa?q=` (só coordenação, máx. 8 por tipo). Sem migração. 2 testes novos em `pesquisa.test.js`. Suite completa antes desta alteração: 19 suites / 191 testes a passar.
- **Link de subscrição de calendário** ("O Meu Horário" → "Link de subscrição"): copia um URL que se cola em "Adicionar calendário por URL" no Google Calendar, Outlook ou Apple Calendar — o calendário passa a atualizar-se sozinho (reagendar/cancelar chega lá). Formador/formando veem as suas aulas, a coordenação todas (30 dias atrás a 12 meses à frente; sugere refresco de 6h). Novos `POST /calendario/link` (autenticado) e `GET /calendario/feed.ics?t=…` (público, com limite de 120 pedidos/hora/IP). O link **deixa de funcionar se a password mudar ou a conta for desativada**. Sem migração. 3 testes novos (`calendario.test.js`).
- **Exportar horário para calendário (.ics)**: botão "Exportar (.ics)" em "O Meu Horário" (formador e formando) e no "Horário da turma" de `agenda.html` (coordenação). Descarrega as aulas dos próximos 6 meses num ficheiro que se importa no Google Calendar, Outlook ou Apple Calendar (título com UC e turma, formador e modalidade na descrição; hora "flutuante", sem fuso). Gerado no browser (`src/js/ics.js`) a partir das rotas de horário que já existiam — sem backend novo nem migração; é uma exportação pontual, não uma sincronização.
- **Vista do mediador** (`mediacao.html`, formador, menu "Mediação"): um formador que é mediador responsável de turmas vê, só dessas, as UCs (formador, horas dadas/em falta com barra de progresso) e a assiduidade de cada formando (presenças, faltas, injustificadas — a vermelho a partir de 3). Só leitura. Novo `GET /turmas/mediacao` (só formadores; lista vazia se não for mediador). Sem migração. 2 testes novos em `turmas.test.js` (13/13). Suite completa antes desta alteração: 18 suites / 186 testes a passar.
- **Substituir o formador de uma UC passando as aulas futuras** (`turmaUcs.html`, coordenação): ao mudar o formador de uma UC que já tem aulas futuras, em vez de só dar erro a interface oferece passá-las para o novo formador (mesma data e hora). Se ele não tiver blocos livres para todas, mostra quais faltam e pergunta se se cancelam essas. Novo `PATCH /turma-ucs/:id/substituir-formador` (`{ formadorId, cancelarSemBloco? }` → `{ turmaUc, movidas, canceladas }`; 409 `SEM_BLOCOS_LIVRES` sem alterar nada). Aulas passadas mantêm-se. `api-client.js` passa a expor `erro.codigo`. Sem migração. 3 testes novos em `turmaUc.test.js` (18/18).
- **Horário Geral** (`horarioGeral.html`, coordenação, menu "Horário Geral"): grelha semanal com as aulas de TODAS as turmas (UC, turma e formador; várias aulas à mesma hora aparecem empilhadas), com filtros por turma e por formador, navegação por semana e contagem de aulas. Novo `GET /aulas?de&ate&turmaId&formadorId` (só coordenação; ignora associações Turma/UC desativadas). Sem migração. 1 teste novo em `aula.test.js` (28/28).
- **Pendências de gestão no painel da coordenação** (`dashboardCoord.html`): três cartões novos — turmas sem mediador, UCs com formador inativo, UCs com horas por agendar mas sem nenhuma aula futura — e uma tabela com o problema e a ligação à página onde se resolve. Só considera turmas ativas e não concluídas. `GET /painel/resumo` (coordenação) passa a incluir `gestao`. Sem migração. 2 testes novos em `painel.test.js` (7/7).
- **Agendar várias aulas de uma vez** (`agenda.html`, coordenação): na grelha de agendamento, clicar em vários blocos livres seleciona-os (clicar outra vez tira) e o botão passa a "Agendar N aulas". Novo `POST /aulas/lote` (até 60 blocos, só coordenação): cada aula passa pelas regras normais; as que falham (bloco bloqueado/ocupado, turma ocupada, carga horária esgotada…) são devolvidas com o motivo e não impedem as outras. Reagendar continua a aceitar um só bloco. Sem migração. 2 testes novos em `aula.test.js` (27/27).
- **Avisos por email quando uma aula futura é reagendada ou cancelada**: o formador e os formandos ativos da turma recebem um email com a UC e a data/hora (antiga e nova). Agendar uma aula nova não avisa (são muitas de cada vez); cancelar uma aula que já passou também não. Nunca faz falhar a operação. Sem migração. 2 testes novos em `aula.test.js` (25/25). Suite completa antes desta alteração: 18 suites / 176 testes a passar.

## 2026-10-21

### Adicionado
- **Copiar UCs de uma turma para outra** (`turmaUcs.html`, coordenação): novo cartão "Copiar UCs de outra turma" — escolhe-se a turma de origem e as suas UCs ativas são associadas à turma atual, com os mesmos formadores (que recebem a notificação habitual). Não copia aulas, notas nem trabalhos. Ignora e explica o que não dá para copiar (já associada, UC desativada, formador inativo). Novo `POST /turma-ucs/copiar` (só coordenação). Sem migração. 2 testes novos em `turmaUc.test.js` (15/15).
- **Relatório de horas por formador** (`relatorioHoras.html`, coordenação, menu "Horas por Formador"): por cada formador ativo, horas de aula dadas (já aconteceram), por dar (futuras) e total, mais blocos de disponibilidade livres/bloqueados; filtro por intervalo de datas, detalhe por turma/UC ao expandir a linha e exportação CSV. Novo `GET /aulas/relatorio-formadores?de&ate` (só coordenação). Sem migração. 2 testes novos em `aula.test.js` (23/23).
- **Reagendar aulas** (`agenda.html`, coordenação): botão "Reagendar" em cada aula da UC — escolhe-se na grelha um novo bloco livre do mesmo formador e a aula muda para lá (opcionalmente com outra modalidade), sem cancelar e voltar a criar; o bloco antigo fica livre e as horas dadas não mudam. Novo `PATCH /aulas/:id/reagendar` (só coordenação; recusa aulas já passadas, blocos bloqueados/ocupados/removidos, de outro formador, ou com a turma já ocupada nessa hora). Sem migração. 3 testes novos em `aula.test.js` (21/21).
- **Ocupação do formador** (`agenda.html`, coordenação): escolher um formador mostra a sua semana em grelha só de leitura — blocos livres, bloqueados (com motivo) e aulas (UC e turma) — com um resumo de horas (aulas / livres / bloqueadas) e navegação por semana. A resposta de `GET /disponibilidade/formador/:id` passou a incluir a UC e a turma de cada aula. Sem migração. 1 teste novo em `disponibilidade.test.js`.
- **"O Meu Horário"** (`horario.html`, formador e formando): grelha semanal só de leitura — o formador vê as aulas que dá (com a turma), o formando as aulas da sua turma (com o formador). Novo `GET /aulas/minhas?de&ate`; entrada nova no menu lateral. Sem migração. 2 testes novos em `aula.test.js` (18/18).
- **Horário da turma** (`agenda.html`, coordenação): ao escolher uma turma aparece uma grelha semanal só de leitura com as aulas de todas as UCs (abreviatura e formador, modalidade no tooltip), com navegação por semana. Novo `GET /aulas/turma/:turmaId?de&ate` (só coordenação). Sem migração. 2 testes novos em `aula.test.js`.
- **Histórico de alterações às notas** (auditoria, RGPD): nova tabela `notas_historico` (**exige migração**), registo automático em cada lançamento/alteração (valor anterior e novo, observações, quem alterou, quando; reenviar o mesmo valor não regista), `GET /notas/turma-uc/:id/formando/:id/historico` (só formador responsável ou coordenação) e botão de relógio na página de notas do formador que mostra o histórico por baixo da linha. 2 testes novos em `notas.test.js`.
- **Exportação da pauta em PDF** (`pautas.html`): novo botão "Exportar pauta (PDF)" ao lado do CSV. Usa a impressão do browser ("Guardar como PDF") com uma folha de estilos `@media print` que esconde o menu e o seletor e deixa só a pauta e a assiduidade da turma, com um cabeçalho (turma e data). Sem dependências novas nem migração.

## 2026-10-20

### Confirmado
- Migração `funcionalidades_formando_formador` aplicada à BD de desenvolvimento e à de testes (inclui as duas que estavam por gerar: `User.turmaId` e o fluxo RH). `npm test`: **16 suites / 152 testes, tudo a passar.**

### Corrigido
- **[Segurança] XSS persistente no nome/email de Pedidos de Acesso e no nome de formador.** Texto vindo do formulário público (`forms.html`) e do próprio perfil de um formador (`PATCH /auth/me`) era inserido sem escape em várias tabelas (`pedidosAcesso.html`, `formandos.html`, `formadores.html`, `dashboardCoord.html` e outras) — permitia a um visitante anónimo, ou a um formador, correr JavaScript na sessão da coordenação. Corrigido com uma nova função partilhada `escapeHtml()` (`src/js/sanitize.js`), aplicada em todas as páginas afetadas.
- Agendar uma aula num bloco de disponibilidade já desativado deixa de ser possível.
- Reduzir a carga horária de uma UC do catálogo abaixo do que já está agendado numa turma deixa de ser possível.
- Marcar um bloco de disponibilidade como Bloqueado quando já tem uma aula agendada deixa de ser possível.
- Submeter um documento (ficheiro ou exceção) numa entrega já desativada deixa de ser possível.
- Cancelar o diálogo de "motivo do bloqueio" na Agenda do formador deixa de bloquear o bloco na mesma.
- Um formador desativado associado a uma UC de turma deixa de ser substituído visualmente por outro no `<select>`.
- `backend/scripts/criar-coordenador.js` deixa de exigir a password como argumento da linha de comandos — passa a ser pedida de forma oculta.

### Adicionado
- **Guarda de autenticação no frontend** (`guard.js`): páginas internas redirecionam para o login sem sessão, e contas com o papel errado vão para o seu próprio dashboard. Sessão expirada (401) ou conta desativada a meio da sessão também voltam ao login.
- **Rate limiting** no login (10 tentativas / 15 min por IP) e no Pedido de Acesso público (5 / hora por IP).
- `GET /entregas/:id/ficheiro` — descarregamento autenticado dos ficheiros submetidos.

### Adicionado (painéis de resumo)
- Os três dashboards ganham um painel de resumo (`GET /painel/resumo`): o **formador** vê o estado de cada UC que leciona (horas, notas lançadas, trabalhos), justificações por decidir, trabalhos por avaliar e próximas aulas; o **formando** vê a média, as faltas (injustificadas) e os trabalhos por entregar; a **coordenação** vê pedidos de acesso, justificações e mensagens por tratar e os formandos com 3+ faltas injustificadas. Sem migração.

### Adicionado (notificações por email)
- Emails de aviso (sem revelar notas, motivos de faltas, feedback nem o texto das mensagens) quando: é lançada uma nota; é submetida ou decidida uma justificação de falta; é atribuído ou avaliado um trabalho; chega ou é respondida uma mensagem. Só para contas ativas; uma falha de envio nunca impede a operação. Sem migração. `npm test`: 17 suites / 157 testes a passar.

### Adicionado (funcionalidades de formando/formador)
- **Notas por UC** (`notas.html`, `pautas.html`): o formador responsável lança notas (0–20) aos formandos da turma; o formando consulta as suas; a coordenação vê a pauta da turma (formandos × UCs, com média) e exporta-a em CSV.
- **Assiduidade e justificação de faltas** (`assiduidade.html`): o formador regista presenças das aulas já dadas; o formando vê o seu resumo e justifica faltas (motivo + anexo opcional); formador ou coordenação aceita/rejeita. A coordenação vê o resumo de assiduidade por turma.
- **Trabalhos e submissões** (`trabalhos.html`): o formador atribui trabalhos com prazo e avalia as submissões; o formando submete e pode reenviar até ao fim do prazo.
- **Mensagens** (`mensagens.html`): formando → coordenação, assistente social (tratada pela coordenação) ou formador da turma; formador → coordenação; coordenação → formador; com resposta.
- Menu lateral com as novas páginas em todas as páginas internas (`menu.js` + `guard.js`).
- Novos endpoints `/notas`, `/assiduidade`, `/trabalhos`, `/mensagens` e `GET /turma-ucs/minhas`. Ficheiros de justificações e trabalhos nunca são públicos, só aceitam pdf/doc/docx/png/jpg/txt/zip, e erros de upload (ex.: > 10 MB) devolvem 422.
- **Requer migração** (`npx prisma migrate dev --name funcionalidades-formando-formador`, inclui também as duas que estavam por gerar) — ver `PLANEAMENTO.md`.

### Corrigido (revisão às funcionalidades novas)
- Já não é possível agendar duas aulas da mesma turma à mesma data e hora, mesmo com formadores diferentes (`409 TURMA_OCUPADA`).
- Reativar uma associação Turma/UC com outro formador também é recusado se houver aulas futuras (antes só a edição direta estava protegida).
- A data de entrega de um trabalho deixa de mudar quando o formador o avalia (novo campo `enviadaEm`).

### Alterado
- **"Terminar Sessão" passa a limpar mesmo a sessão** (token e utilizador no `localStorage`) antes de ir para o login.
- **Ficheiros submetidos deixam de ser públicos:** `/uploads` já não é servido como estático; só o formador dono ou a coordenação os descarregam, com autenticação.
- Trocar o formador responsável por uma UC numa turma passa a ser recusado se já houver aulas futuras marcadas (antes a troca era aceite, deixando a agenda inconsistente). Cancela as aulas futuras primeiro, se for mesmo preciso trocar.
- `mediadorId` de uma turma já pode ser removido pela API (`null`) — antes não havia forma de limpar o campo.

Ver `PLANEAMENTO.md`, entrada de 2026-10-20, para o detalhe completo (incluindo a revisão de segurança que motivou estas correções, e uma decisão registada mas não implementada: invalidar tokens JWT ao reativar uma conta).

## 2026-09-10

### Adicionado
- **Gestão de Formandos** (`formandos.html`): nova página, só para a coordenação, com a lista de todos os formandos e a turma atual de cada um. Permite mudar (ou remover) a turma de um formando depois de a conta já existir — antes só era possível defini-la no momento de aprovar o Pedido de Acesso. Novos endpoints `GET /formandos` e `PATCH /formandos/:id/turma`. Sem alterações ao schema.

### Alterado
- **Aprovação de Pedidos de Acesso passou a ter dois passos (fluxo via RH)** — a coordenação continua a decidir o papel (e turma, se for formando) em `PATCH /:id/aprovar`, mas isso já não cria a conta na hora: o pedido fica com estado `A_AGUARDAR_RH` até a coordenação confirmar, no novo botão da listagem, que os RH já criaram a conta fora da plataforma (`PATCH /:id/confirmar-conta-criada` — só aí a conta é criada de facto e o email de credenciais é enviado). `Rejeitar` passou a funcionar também a partir de `A_AGUARDAR_RH`. Ver `PLANEAMENTO.md` para o detalhe e as variantes discutidas.

## 2026-09-04

### Alterado
- UCs deixam de pertencer a uma única turma e passam a catálogo reutilizável — a mesma UC pode agora ser associada a várias turmas, cada uma com o seu próprio formador (nova entidade `TurmaUc`; carga horária continua fixa no catálogo).
- Gestão de UCs movida da página Agenda para Gestão Turmas (botão "Gerir UCs", ícone de livros, em cada linha da tabela de turmas).
- Página Agenda simplificada: passa a servir só para agendar aulas — já não cria/edita UCs.

### Adicionado
- **Fase 6 — Agenda**: simulação interna de disponibilidade/agendamento (sem integração real com Google Calendar/Outlook, por decisão explícita). Novas entidades `Uc`, `Disponibilidade`, `Aula`. Formador define a sua disponibilidade em `agendaFormador.html` (grelha semanal); coordenação agenda aulas em `agenda.html`, consoante a disponibilidade do formador responsável por cada UC.
- Campos `idCursoIEFP` e `mediadorId` na Turma (o mediador é uma conta de formador já existente).
- `COMO_TESTAR.md` — guia de comandos de terminal para arrancar o backend/frontend e testar a aplicação.
- `backend/.env.test.example` — template para a base de dados de testes (não existia nenhum).
- Este ficheiro (`CHANGELOG.md`).

### Corrigido
- Cartão "Turma" da página Agenda com estilo inacabado (label ilegível sobre fundo branco, `<select>` sem estilo nenhum).
- Efeito secundário dessa correção: o `<select>` "Estado Inicial" (estilo "badge") do modal Editar Turma ficou com o texto invisível — corrigido para não afetar selects já estilizados como badge.
- Botões "Associar UC" / "Nova UC no catálogo" a aparecerem empilhados um em cima do outro em vez de lado a lado.
- Destaque errado no menu lateral: `turmas.html`, `formadores.html` e `perfil.html` mostravam sempre "Visão Global" como página ativa, independentemente da página onde se estava (bug já existente antes desta sessão).

### Adicionado (continuação)
- `CHANGELOG.md` (este ficheiro).
- `GUIA_RAPIDO.md` — guia rápido do projeto (convenções, armadilhas conhecidas, ponteiros para a documentação).
- `src/pages/turmaUcs.html` + `src/js/turmaUcs.js` — página dedicada para gerir as UCs de uma turma (antes era um modal em Gestão Turmas).

### Corrigido (continuação)
- `.modal-content` esticava até 100% da altura do ecrã em todos os modais da aplicação (herdava `height: 100%` da classe `.section-card`), deixando muito espaço em branco por baixo do conteúdo.

### Alterado (continuação — "flag em vez de eliminar")
- Apagar um Formador, Turma, UC do catálogo, associação Turma+UC, Entrega ou bloco de Disponibilidade deixou de ser destrutivo: passa a marcar o registo como inativo (`ativo: false`), mantendo o histórico. Deixa de aparecer nas listagens por omissão, mas pode ser visto e reativado (novo `?incluirInativos=true` nas listagens; novo `PATCH /:id/reativar`; nos blocos de disponibilidade basta redefinir o bloco outra vez). Fora de âmbito por agora: cancelar uma Aula continua a apagar definitivamente (motivo técnico detalhado no `PLANEAMENTO.md`).
- Login e todos os pedidos autenticados passam a recusar o acesso a contas desativadas (`403 CONTA_INATIVA`), mesmo com um token ainda válido.
- Removidas as guardas `UC_ASSOCIADA_A_TURMAS` e `TURMA_UC_COM_AULAS` (existiam só para evitar que o `DELETE` definitivo falhasse por chave estrangeira — deixaram de ser precisas com soft delete).
- Formadores e Turmas: checkbox "Mostrar desativados/as" na listagem, com botão de reativar.

### Corrigido (continuação 2)
- Apagar um Formador ou uma Turma com histórico associado (entregas, UCs lecionadas, disponibilidades) falhava com um erro de chave estrangeira — não havia proteção nenhuma contra isto (ao contrário da UC/TurmaUc, que já tinham uma guarda explícita). Corrigido ao mesmo tempo que "flag em vez de eliminar", pela mesma alteração.

## 2026-09-09

### Adicionado
- **Dashboard do Formando** (`dashboardFormando.html`) — mostra a turma, as UCs (com formador e carga horária) e as próximas aulas. Novo campo `User.turmaId` (só para role=FORMANDO) liga a conta à turma; atribuível ao aprovar o Pedido de Acesso (`pedidosAcesso.html` ganhou um seletor de turma para esse caso). Login de uma conta FORMANDO passa a ir para este dashboard em vez de `perfil.html`.
- **Notificações por email de atribuição** — o formador recebe agora um email quando é (re)atribuído a lecionar uma UC numa turma, ou designado mediador de uma turma. Âmbito restrito a estes dois eventos (ver `PLANEAMENTO.md`, "Notificações por email").

### Corrigido
- **Códigos de erro `404` inconsistentes entre serviços** — várias entidades (Turma, UC, Associação Turma/UC, Bloco de disponibilidade, Formador, Entrega, Aula, Pedido de Acesso, Utilizador) deixavam de ter um código específico (ex.: `TURMA_NOT_FOUND`) quando o 404 vinha do próprio serviço, ao contrário de quando a mesma entidade era referenciada por outro serviço. Todos passaram a usar sempre o código específico da entidade. Ver `PLANEAMENTO.md` para o detalhe completo e o que ficou de fora de propósito.
- **[Segurança] `POST /auth/register` estava público e deixava escolher o `role`** — qualquer pessoa sem login conseguia criar-se a si própria uma conta de coordenador, ultrapassando o fluxo de Pedidos de Acesso. Passou a exigir um coordenador autenticado. Novo script `backend/scripts/criar-coordenador.js` para o bootstrap do primeiro coordenador numa base de dados nova.
- **[Segurança] Entregas, Formadores e Turmas sem verificação de papel nas rotas de escrita** — qualquer utilizador autenticado (mesmo FORMANDO) conseguia criar/editar/apagar entregas de outros formadores, contas de formador, e turmas. Passaram a exigir `requireRole("COORDENADOR")`. Ver `PLANEAMENTO.md`, "Auditoria de rotas e permissões", para o detalhe completo.
- `perfil.html` mostrava sempre a barra lateral de coordenador, mesmo para formador/formando — passou a ajustar-se ao papel real da conta autenticada.

## 2026-09-08

### Adicionado
- Botão "Bloquear dia" na Agenda do formador — bloqueia de uma vez todos os blocos de 1h ainda livres/por definir de um dia (com motivo opcional), sem tocar nos que já têm aula agendada ou já estavam bloqueados. Ver `PLANEAMENTO.md` para detalhe.

### Corrigido
- Login a mostrar sempre "As credenciais estão incorretas" fosse qual fosse o erro real (conta desativada, backend em baixo, etc.) — passa a mostrar a mensagem real da API. `api-client.js` também passou a apanhar falhas de rede e mostrar uma mensagem em português em vez do erro em inglês do browser (afeta toda a aplicação). Ver `PLANEAMENTO.md`.

### Confirmado
- Migração `flag_em_vez_de_eliminar` aplicada com sucesso à base de dados de testes (já estava aplicada à de desenvolvimento) — `npm test`: 10 suites / 75 testes, tudo a passar.

### Corrigido
- Select "Formador" em `turmaUcs.html` a aparecer com fundo azul sólido e texto branco (Windows com tema escuro do sistema) — acrescentado `color-scheme: light` à regra CSS partilhada dos selects/inputs claros fora dos modais. Ver `PLANEAMENTO.md` para detalhe da investigação.
- `turmaUcs.html` a perder o `turmaId` do endereço (caindo em "Turma não encontrada", com tabela e selects vazios) ao criar uma UC no catálogo a partir do formulário inline — acrescentado `action="javascript:void(0);"` aos formulários da página para impedir que um envio nativo do formulário substitua a query string. Ver `PLANEAMENTO.md` para detalhe.
- Aplicado o mesmo `action="javascript:void(0);"` preventivamente a todos os restantes formulários do projeto (dashboardCoord, dashboardFormador, formadores, forms, login, pedidosAcesso, perfil, turmas).

## 2026-09-02 a 2026-09-04 — Pedidos de Acesso

### Adicionado
- **Fase 8**: fluxo completo de aprovação/rejeição de Pedidos de Acesso, com criação real de conta.
- **Fase 8b**: as credenciais deixam de ser mostradas ao coordenador e passam a ser enviadas por email; o papel FORMANDO passa a poder ser atribuído a novas contas (migração aplicada com sucesso à base de dados real em 2026-09-04).

## 2026-09-01 a 2026-09-03 — Documentação do projeto

### Documentação
- Relatório de ponto de situação e apresentação atualizados: novo PowerPoint (11 diapositivos) e relatório Word completo (introdução, caso de estudo com diagrama de casos de uso UML, modelo de dados, modelo de base de dados, dificuldades encontradas, próximos passos, anexos e bibliografia/webgrafia em formato APA).

## Até 2026-07-30 — Fundação do projeto

### Adicionado
- Migração completa de Firebase para stack própria: Node/Express + MySQL + Prisma + JWT.
- **Fase 0** — Autenticação (JWT/bcrypt) + Turmas.
- **Fase 1** — Formadores (contas de login reais, não só um roster) + Perfil.
- **Fase 2** — Entregas, com upload real de ficheiros (multer) e via de exceção.
- **Fase 3** — Pedidos de Acesso (rota pública).
- **Fase 4** — Testes automatizados (Jest + Supertest), documentação OpenAPI (`/api-docs`), checklist RGPD (`backend/RGPD.md`), remoção completa do Firebase do projeto.
