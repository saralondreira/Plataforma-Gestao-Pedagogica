const nodemailer = require("nodemailer");

// Fase 8b: envio automático de credenciais por email, para o coordenador deixar
// de ter de ver/copiar a password gerada (pedido da Sara, 2026-09-02).
//
// Três modos, escolhidos automaticamente:
//  - NODE_ENV=test  -> "jsonTransport" do nodemailer: não envia nada a sério,
//    só simula em memória. Corre offline, é o que os testes usam.
//  - SMTP_HOST definido no .env -> usa esse servidor real (produção/Gmail/etc.).
//  - sem nada configurado -> cria automaticamente uma conta de teste Ethereal
//    (https://ethereal.email). Não envia emails reais, mas dá um link de
//    pré-visualização no terminal do backend — ótimo para desenvolvimento,
//    sem precisar de nenhuma credencial real.

let transporterPromise = null;

// Só usado em testes (NODE_ENV=test): guarda os emails "enviados" em memória
// (o jsonTransport não envia nada a sério) para os testes poderem verificar
// o conteúdo — ex.: confirmar que a password gerada realmente permite login.
const testOutbox = [];

function limparTestOutbox() {
  testOutbox.length = 0;
}

function getTransporter() {
  if (transporterPromise) return transporterPromise;

  if (process.env.NODE_ENV === "test") {
    transporterPromise = Promise.resolve(nodemailer.createTransport({ jsonTransport: true }));
  } else if (process.env.SMTP_HOST) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      })
    );
  } else if (process.env.NODE_ENV === "production") {
    // Sem SMTP_HOST o código usaria o Ethereal (serviço de teste): em produção isso
    // enviaria palavras-passe temporárias e ligações de recuperação para fora.
    transporterPromise = Promise.reject(new Error("SMTP_HOST não está configurado: em produção os emails não podem ir para o serviço de teste."));
    transporterPromise.catch(() => {});
  } else {
    transporterPromise = nodemailer.createTestAccount().then((conta) =>
      nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: conta.user, pass: conta.pass },
      })
    );
  }

  return transporterPromise;
}

async function enviarCredenciaisAcesso({ nome, email, role, passwordTemporaria }) {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || '"Gestão Pedagógica" <no-reply@plataforma-pedagogica.local>',
    to: email,
    subject: "O teu acesso à Plataforma de Gestão Pedagógica foi aprovado",
    text: [
      `Olá ${nome},`,
      "",
      "O teu pedido de acesso à Plataforma de Gestão Pedagógica foi aprovado.",
      "",
      `Papel: ${role}`,
      `Email de acesso: ${email}`,
      `Password temporária: ${passwordTemporaria}`,
      "",
      "Recomendamos que a alteres assim que entrares pela primeira vez.",
    ].join("\n"),
  });

  if (process.env.NODE_ENV === "test") {
    testOutbox.push({ to: email, nome, role, passwordTemporaria });
  }

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    // Só existe em modo Ethereal (desenvolvimento) — nunca em produção real.
    console.log("[mailer] Email de teste gerado. Pré-visualização:", previewUrl);
  }

  return info;
}


// Fase 8c: notificações automáticas por email quando alguém é atribuído a
// uma responsabilidade concreta (pedido da Sara, 2026-09-09). Âmbito
// deliberadamente restrito a dois eventos discretos — "foste atribuído a
// isto" — e não a qualquer edição de turma/UC, para não gerar spam:
//  - um formador é associado (ou reassociado) a lecionar uma UC numa turma;
//  - um formador é designado mediador de uma turma.

async function enviarNotificacaoUcAtribuida({
  nome,
  email,
  turmaCodigo,
  turmaDesignacao,
  ucAbreviatura,
  ucNome,
  cargaHoraria,
}) {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || '"Gestão Pedagógica" <no-reply@plataforma-pedagogica.local>',
    to: email,
    subject: `Foste atribuído(a) à UC ${ucAbreviatura} (${turmaCodigo})`,
    text: [
      `Olá ${nome},`,
      "",
      `Foste atribuído(a) como formador(a) da UC "${ucNome}" (${ucAbreviatura}) na turma ${turmaCodigo} — ${turmaDesignacao}.`,
      `Carga horária: ${cargaHoraria}h.`,
      "",
      "Já podes consultar os detalhes e a agenda na Plataforma de Gestão Pedagógica.",
    ].join("\n"),
  });

  if (process.env.NODE_ENV === "test") {
    testOutbox.push({ tipo: "UC_ATRIBUIDA", to: email, nome, turmaCodigo, ucAbreviatura });
  }

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    // Só existe em modo Ethereal (desenvolvimento) — nunca em produção real.
    console.log("[mailer] Email de teste gerado. Pré-visualização:", previewUrl);
  }

  return info;
}

async function enviarNotificacaoMediadorAtribuido({ nome, email, turmaCodigo, turmaDesignacao }) {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || '"Gestão Pedagógica" <no-reply@plataforma-pedagogica.local>',
    to: email,
    subject: `Foste designado(a) mediador(a) da turma ${turmaCodigo}`,
    text: [
      `Olá ${nome},`,
      "",
      `Foste designado(a) mediador(a) da turma ${turmaCodigo} — ${turmaDesignacao}.`,
      "",
      "Já podes consultar os detalhes na Plataforma de Gestão Pedagógica.",
    ].join("\n"),
  });

  if (process.env.NODE_ENV === "test") {
    testOutbox.push({ tipo: "MEDIADOR_ATRIBUIDO", to: email, nome, turmaCodigo });
  }

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log("[mailer] Email de teste gerado. Pré-visualização:", previewUrl);
  }

  return info;
}

// Email genérico de aviso (notas, justificações, trabalhos, mensagens) — ver
// lib/notificacoes.js. `linhas` é o corpo, uma linha por elemento.
async function enviarNotificacao({ to, nome, tipo, assunto, linhas }) {
  const transporter = await getTransporter();
  const texto = [`Olá ${nome},`, "", ...linhas, "", "— Plataforma de Gestão Pedagógica"].join("\n");

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || '"Gestão Pedagógica" <no-reply@plataforma-pedagogica.local>',
    to,
    subject: assunto,
    text: texto,
  });

  if (process.env.NODE_ENV === "test") {
    testOutbox.push({ tipo, to, nome, assunto, texto });
  }

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log("[mailer] Email de teste gerado. Pré-visualização:", previewUrl);
  }

  return info;
}

module.exports = {
  getTransporter,
  enviarNotificacao,
  enviarCredenciaisAcesso,
  enviarNotificacaoUcAtribuida,
  enviarNotificacaoMediadorAtribuido,
  testOutbox,
  limparTestOutbox,
};
