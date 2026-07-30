# Checklist RGPD — Plataforma de Gestão Pedagógica

> Elaborado no âmbito da UC00605 (M07 — Integração, Documentação e Deploy). Cobre os dados pessoais tratados pela API e o que falta fazer antes de um deploy real.

## 1. Inventário de dados pessoais

| Tabela | Campos pessoais | Finalidade |
|---|---|---|
| `users` | nome, email, passwordHash, contacto, linkedin, competencias | Autenticação e gestão de coordenadores/formadores |
| `pedidos_acesso` | nome, email, cargo, motivo | Pedido de acesso à plataforma, antes de existir conta |
| `entregas` | (indiretamente) nome do formador via relação, notas de exceção em texto livre | Rastreio de entrega de documentos pedagógicos |

Não são tratados dados de categoria especial (saúde, origem étnica, etc.).

## 2. Minimização de dados

- [x] Só se pedem os campos estritamente necessários (nome, email, contacto opcional) — não há recolha de morada, NIF, data de nascimento, etc.
- [x] `passwordHash` nunca é devolvido pela API (`toPublicUser`/`toPublicFormador` removem-no antes de qualquer resposta).
- [ ] **Por fazer:** o campo `motivo` do pedido de acesso e `submissaoNota` da exceção são texto livre — não há validação a impedir que um utilizador escreva dados pessoais de terceiros aí. A rever se a plataforma for para produção real.

## 3. Segurança dos dados

- [x] Passwords com hash `bcrypt` (nunca em texto simples).
- [x] Autenticação stateless com JWT (`expiresIn: 7d`), sem guardar sessões em texto simples no servidor.
- [x] CORS restrito à origem do frontend (`CORS_ORIGIN`), não aberto a qualquer domínio.
- [x] Segredos (`DATABASE_URL`, `JWT_SECRET`) fora do código-fonte, em `.env` (git-ignorado).
- [ ] **Por fazer antes de produção:**
  - Servir a API só por HTTPS (atualmente `http://localhost` em dev).
  - Reduzir `expiresIn` do JWT ou implementar refresh tokens.
  - `JWT_SECRET` de produção gerado aleatoriamente (o `.env.example` tem um valor de exemplo — nunca reutilizar).
  - Rever `backend/uploads/` — hoje os ficheiros submetidos pelos formadores ficam publicamente acessíveis por URL a quem a conhecer (`/uploads/entregas/{id}/...`), sem controlo de acesso. Antes de produção, isto devia exigir autenticação para descarregar.

## 4. Direitos dos titulares dos dados

- [x] **Acesso e retificação:** `GET`/`PATCH /api/v1/auth/me` — qualquer utilizador pode ver e corrigir os seus próprios dados.
- [ ] **Por fazer:** não existe endpoint de "apagar a minha conta" (direito ao apagamento). A coordenadora pode apagar um formador via `DELETE /api/v1/formadores/:id`, mas um formador não se pode autoeliminar.
- [ ] **Por fazer:** não existe exportação dos dados próprios num formato portável (direito à portabilidade).
- [ ] **Por fazer:** os `pedidos_acesso` rejeitados/expirados não têm apagamento automático — ficam na base de dados indefinidamente.

## 5. Consentimento e transparência

- [ ] **Por fazer:** o formulário de pedido de acesso (`forms.html`) e o registo (`login.html`) não têm uma política de privacidade linkada nem uma checkbox de consentimento explícito — necessário antes de recolher dados de pessoas reais.
- [ ] **Por fazer:** não existe uma página "Política de Privacidade" no site.

## 6. Retenção de dados

- [ ] **Por fazer:** não há política de retenção definida nem limpeza automática (ex.: apagar contas de formadores inativos há X anos, apagar entregas muito antigas). A definir antes de operar com dados reais.

## 7. Checklist de deploy (relacionado, do M07)

- [ ] `NODE_ENV=production` e `JWT_SECRET` fortes/únicos por ambiente.
- [ ] Base de dados de produção com backups regulares.
- [ ] Logs do servidor não devem incluir passwords, tokens ou corpo de pedidos com dados pessoais em claro.
- [ ] Rate limiting nos endpoints de autenticação (`/auth/login`, `/auth/register`), para mitigar força bruta — ainda não implementado.
- [ ] Ficheiros em `backend/uploads/` movidos para armazenamento externo (ex.: S3/equivalente) com controlo de acesso, em vez de disco local, para escalar e proteger o acesso.

---

**Resumo:** a base (minimização, hashing, segredos fora do código, CORS) está feita. O que falta é sobretudo relacionado com *operar em produção com dados reais de pessoas* — política de privacidade, consentimento explícito, direito ao apagamento/portabilidade, e proteger o acesso aos ficheiros submetidos. Nada disto bloqueia o uso do projeto como trabalho académico com dados de teste.
