// Testa o envio de email com a configuração do backend/.env — sem arrancar o servidor
// nem tocar na base de dados.
//
// Uso (a partir da pasta backend/):
//   node scripts/testar-email.js destinatario@exemplo.pt
//
// O que faz:
//   1. mostra o modo em uso (servidor SMTP real ou conta de teste Ethereal) — nunca a palavra-passe;
//   2. verifica a ligação e o login ao servidor (transporter.verify());
//   3. envia UM email de teste ao destinatário indicado e mostra a resposta do servidor.
// Com SMTP_HOST definido no .env envia mesmo (email real); sem SMTP_HOST usa o Ethereal,
// que não entrega a ninguém e devolve um link de pré-visualização.

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const nodemailer = require("nodemailer");
const { getTransporter } = require("../src/lib/mailer");

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMITE_MS = 25000;

const mascarar = (s) => (s ? `${s.slice(0, 2)}***${s.includes("@") ? s.slice(s.indexOf("@")) : ""}` : "(nenhum)");
const comLimite = (promessa, texto) =>
  Promise.race([promessa, new Promise((_, rej) => setTimeout(() => rej(new Error(`${texto}: sem resposta ao fim de ${LIMITE_MS / 1000}s`)), LIMITE_MS))]);

async function main() {
  const destino = (process.argv[2] || "").trim();
  if (!FORMATO_EMAIL.test(destino)) {
    console.error("Uso: node scripts/testar-email.js destinatario@exemplo.pt");
    process.exitCode = 1;
    return;
  }

  const real = Boolean(process.env.SMTP_HOST);
  console.log(real ? "Modo: servidor SMTP REAL (SMTP_HOST definido)" : "Modo: conta de teste Ethereal (SMTP_HOST não definido) — não envia a ninguém");
  if (real) {
    console.log(`  Servidor: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587} | seguro: ${process.env.SMTP_SECURE === "true"}`);
    console.log(`  Utilizador: ${mascarar(process.env.SMTP_USER)} | palavra-passe definida: ${process.env.SMTP_PASS ? "sim" : "NÃO"}`);
    console.log(`  Remetente: ${process.env.SMTP_FROM || "(por omissão)"}`);
  }

  const transporter = await comLimite(getTransporter(), "Criar o transporte");
  console.log("A verificar a ligação e o login...");
  await comLimite(transporter.verify(), "Verificar o servidor");
  console.log("  Ligação e login: OK");

  console.log(`A enviar o email de teste para ${destino}...`);
  const info = await comLimite(
    transporter.sendMail({
      from: process.env.SMTP_FROM || '"Gestão Pedagógica" <no-reply@plataforma-pedagogica.local>',
      to: destino,
      subject: "Teste de envio — Plataforma de Gestão Pedagógica",
      text: ["Olá,", "", "Este é um email de teste da Plataforma de Gestão Pedagógica.", "Se o recebeste, o envio de emails está a funcionar.", "", `Enviado em ${new Date().toLocaleString("pt-PT")}.`].join("\n"),
    }),
    "Enviar o email"
  );
  console.log("  Aceite por:", info.accepted?.join(", ") || "(ninguém)");
  if (info.rejected?.length) console.log("  Rejeitado por:", info.rejected.join(", "));
  console.log("  Resposta do servidor:", info.response);
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) console.log("  Pré-visualização (Ethereal):", previewUrl);
  if (!info.accepted?.length) process.exitCode = 1;
}

main().catch((erro) => {
  console.error("FALHOU:", erro.message);
  if (erro.code) console.error("  código:", erro.code);
  if (erro.responseCode) console.error("  resposta SMTP:", erro.responseCode, erro.response);
  process.exitCode = 1;
});
