# Checklist RGPD — Plataforma de Gestão Pedagógica

> Elaborado no âmbito da UC00605 (M07 — Integração, Documentação e Deploy). Cobre os dados pessoais tratados pela API e o que falta fazer antes de um deploy real.

## 1. Inventário de dados pessoais

| Tabela | Campos pessoais | Finalidade |
|---|---|---|
| `users` | nome, email, passwordHash, contacto, linkedin, competencias | Autenticação e gestão de coordenadores/formadores |
| `pedidos_acesso` | nome, email, cargo, motivo | Pedido de acesso à plataforma, antes de existir conta |
| `entregas` | (indiretamente) nome do formador via relação, notas de exceção em texto livre | Rastreio de entrega de documentos pedagógicos |
| `sumarios`, `documentos_uc` (2026-10-22) | texto dos sumários de aula e ficheiros de apoio enviados pelos formadores; guardam quem escreveu/validou/enviou | Registo pedagógico e repositório de materiais (substitui os CDs) |
| `notas`, `presencas`, `justificacoes`, `submissoes_trabalho`, `mensagens` (2026-10-20) | dados de avaliação e assiduidade do formando; **motivos e anexos de justificações de faltas** (podem conter dados de saúde — atestados médicos); ficheiros de trabalhos; texto livre de mensagens (incluindo as dirigidas à assistente social) | Avaliação, assiduidade e comunicação interna |

Não são tratados, por desenho, dados de categoria especial (saúde, origem étnica, etc.) — **com uma exceção a vigiar desde 2026-10-20:** as justificações de faltas aceitam um anexo e um motivo em texto livre, onde um formando pode juntar um atestado médico ou descrever uma situação de saúde/pessoal. O acesso a esses anexos está restrito ao próprio formando, ao formador responsável e à coordenação (endpoint autenticado, nunca público). Antes de operar com dados reais, convém decidir um prazo de retenção para estes anexos e avisar os formandos (política de privacidade) de que não devem enviar mais informação do que a necessária.

## 2. Minimização de dados

- [x] Só se pedem os campos estritamente necessários (nome, email, contacto opcional) — não há recolha de morada, NIF, data de nascimento, etc.
- [x] `passwordHash` nunca é devolvido pela API (`toPublicUser`/`toPublicFormador` removem-no antes de qualquer resposta).
- [x] **(Fase 8b, 2026-09-02)** A password temporária gerada ao aprovar um pedido de acesso deixou de ser devolvida na resposta da API / mostrada ao coordenador — passa diretamente por email à pessoa (`backend/src/lib/mailer.js`). Nota: em desenvolvimento (sem `SMTP_HOST` configurado), o link de pré-visualização do email de teste (Ethereal) é escrito na consola do backend — aceitável só porque é um serviço de teste que não corresponde a uma password real de produção. **Desde 2026-10-27**, com `NODE_ENV=production` e sem `SMTP_HOST` o envio falha em vez de usar o Ethereal, e redefinir a palavra-passe invalida as sessões já iniciadas.
- [ ] **Por fazer:** o campo `motivo` do pedido de acesso e `submissaoNota` da exceção são texto livre — não há validação a impedir que um utilizador escreva dados pessoais de terceiros aí. A rever se a plataforma for para produção real.

## 3. Segurança dos dados

- [x] Passwords com hash `bcrypt` (nunca em texto simples).
- [x] **Recuperação de palavra-passe (2026-10-22):** token JWT de 1 hora e uso único (assinado com o hash atual da palavra-passe, por isso deixa de valer assim que ela muda); a resposta é igual exista ou não a conta (não revela quem tem acesso); só contas ativas; limitada a 5 pedidos/hora/IP; o token vai no fragmento do URL (`#token=`), que o browser não envia ao servidor.
- [x] **Ficheiros de documentos (2026-10-22):** só saem por rota autenticada (`GET /documentos/:id/ficheiro`) para o responsável da UC, mediador, coordenação e formandos da turma; o formando nunca vê documentos removidos; remover é soft delete (fica no histórico).
- [x] Autenticação stateless com JWT (`expiresIn: 7d`), sem guardar sessões em texto simples no servidor.
- [x] CORS restrito à origem do frontend (`CORS_ORIGIN`), não aberto a qualquer domínio.
- [x] Segredos (`DATABASE_URL`, `JWT_SECRET`) fora do código-fonte, em `.env` (git-ignorado).
- [ ] **Por fazer antes de produção:**
  - Servir a API só por HTTPS (atualmente `http://localhost` em dev).
  - Reduzir `expiresIn` do JWT ou implementar refresh tokens.
  - `JWT_SECRET` de produção gerado aleatoriamente (o `.env.example` tem um valor de exemplo — nunca reutilizar).
  - ~~Rever `backend/uploads/`~~ — **feito (2026-10-20):** `/uploads` deixou de ser servido como estático público; os ficheiros só saem por `GET /api/v1/entregas/:id/ficheiro`, que exige autenticação (formador dono ou coordenação). Falta ainda, para produção, mover o armazenamento para fora do disco local.

## 4. Direitos dos titulares dos dados

- [x] **Acesso e retificação:** `GET`/`PATCH /api/v1/auth/me` — qualquer utilizador pode ver e corrigir os seus próprios dados.
- [ ] **Por fazer:** não existe endpoint de "apagar a minha conta" (direito ao apagamento). A coordenação pode **desativar** um formador via `DELETE /api/v1/formadores/:id` (soft delete: os dados mantêm-se e podem ser reativados; não há eliminação definitiva) e um formador não se pode autoeliminar.
- [ ] **Por fazer:** não existe exportação dos dados próprios num formato portável (direito à portabilidade).
- [ ] **Por fazer:** os `pedidos_acesso` rejeitados/expirados não têm apagamento automático — ficam na base de dados indefinidamente.

## 5. Consentimento e transparência

- [ ] **Por fazer:** o formulário de pedido de acesso (`forms.html`) e o registo (`login.html`) não têm uma política de privacidade linkada nem uma checkbox de consentimento explícito — necessário antes de recolher dados de pessoas reais.
- [ ] **Por fazer:** não existe uma página "Política de Privacidade" no site.

## 6. Retenção de dados

- [ ] **Por fazer:** os dados de demonstração (`npm run seed`, 2026-10-22) são fictícios e todas as contas partilham a mesma palavra-passe — nunca usar em produção (o script recusa `NODE_ENV=production`).
- [ ] **Por fazer:** não há política de retenção definida nem limpeza automática (ex.: apagar contas de formadores inativos há X anos, apagar entregas muito antigas). A definir antes de operar com dados reais.

## 7. Checklist de deploy (relacionado, do M07)

- [ ] `NODE_ENV=production` e `JWT_SECRET` fortes/únicos por ambiente.
- [ ] Base de dados de produção com backups regulares.
- [ ] Logs do servidor não devem incluir passwords, tokens ou corpo de pedidos com dados pessoais em claro.
- [x] Rate limiting (2026-10-20): `POST /auth/login` limitado a 10 tentativas por IP em 15 min, e `POST /pedidos-acesso` (público) a 5 pedidos por IP por hora — em memória (`backend/src/middleware/rateLimit.js`), suficiente para uma única instância. `/auth/register` já exige coordenador autenticado, por isso não foi limitado.
- [ ] Ficheiros em `backend/uploads/` movidos para armazenamento externo (ex.: S3/equivalente) com controlo de acesso, em vez de disco local, para escalar e proteger o acesso.

---

**Resumo:** a base (minimização, hashing, segredos fora do código, CORS) está feita. O que falta é sobretudo relacionado com *operar em produção com dados reais de pessoas* — política de privacidade, consentimento explícito, direito ao apagamento/portabilidade, e proteger o acesso aos ficheiros submetidos. Nada disto bloqueia o uso do projeto como trabalho académico com dados de teste.
- [x] **Sessão do browser (2026-10-28):** o JWT deixou de estar no `localStorage` e passou para um cookie `httpOnly` (`SameSite=Lax`, `Secure` em produção), por isso um XSS não o consegue ler; os pedidos que alteram dados têm proteção CSRF (cabeçalho `X-Requested-With` e verificação da origem); `POST /auth/logout` apaga o cookie.
