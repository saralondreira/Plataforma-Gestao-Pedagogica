const { prisma } = require("./prisma");
const { enviarNotificacao } = require("./mailer");

// Notificações por email das funcionalidades de formando/formador (notas,
// justificações, trabalhos, mensagens). Regras:
//  - Nunca fazem falhar a operação que as originou: qualquer erro (SMTP em
//    baixo, utilizador apagado, etc.) só fica no log do servidor.
//  - Os emails dizem *o que* aconteceu e mandam consultar a plataforma — não
//    levam dados sensíveis (notas, motivos de faltas, texto das mensagens).
//  - Só vão para contas ativas.
async function notificar(ids, { tipo, assunto, linhas }) {
  try {
    const unicos = [...new Set(ids)].filter(Boolean);
    if (unicos.length === 0) return;

    const utilizadores = await prisma.user.findMany({
      where: { id: { in: unicos }, ativo: true },
      select: { nome: true, email: true },
    });

    const resultados = await Promise.allSettled(
      utilizadores.map((u) => enviarNotificacao({ to: u.email, nome: u.nome, tipo, assunto, linhas }))
    );
    resultados
      .filter((r) => r.status === "rejected")
      .forEach((r) => console.error(`[notificacoes] Falha ao enviar "${tipo}":`, r.reason?.message));
  } catch (erro) {
    console.error(`[notificacoes] Falha ao preparar "${tipo}":`, erro.message);
  }
}

async function idsDaCoordenacao() {
  const coordenadores = await prisma.user.findMany({
    where: { role: "COORDENADOR", ativo: true },
    select: { id: true },
  });
  return coordenadores.map((c) => c.id);
}

module.exports = { notificar, idsDaCoordenacao };
