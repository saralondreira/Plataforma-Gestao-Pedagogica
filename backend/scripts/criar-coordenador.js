// Cria (ou reativa) uma conta de coordenador diretamente na base de dados,
// sem passar pela API — necessário porque, por segurança, POST /auth/register
// passou a exigir que quem o chama já seja um coordenador autenticado (ver
// PLANEAMENTO.md, "Auditoria de rotas e permissões", 2026-09-09). Isto resolve
// o problema do "primeiro coordenador": numa base de dados nova, sem nenhum
// coordenador ainda, não há forma de chamar essa rota — este script bypassa-a.
//
// Uso (a partir da pasta backend/):
//   node scripts/criar-coordenador.js "Nome Completo" email@exemplo.pt
//   -> pede a password de forma oculta (não fica no histórico da shell nem
//      visível na lista de processos).
// Também aceita a password como 4º argumento (node ... "Nome" email pass),
// para scripting/automação, mas isso é menos seguro — prefere o modo interativo.
//
// Se já existir um utilizador com este email, o script atualiza-o para
// coordenador ativo com esta password em vez de falhar.

const bcrypt = require("bcrypt");
const readline = require("readline");
const { prisma } = require("../src/lib/prisma");

const SALT_ROUNDS = 10; // tem de ser igual ao usado em src/services/auth.service.js

// Pede a password no terminal sem a mostrar: lê tecla a tecla (modo "raw") e só escreve "*".
// (Mascarar o readline não chegava — ao apagar uma letra ele redesenha a linha com o texto.)
function perguntarPasswordOculta(pergunta) {
  return new Promise((resolve) => {
    process.stdout.write(pergunta);
    if (!process.stdin.isTTY) {
      // sem terminal interativo (ex.: redirecionamento): lê a primeira linha
      const rl = readline.createInterface({ input: process.stdin });
      rl.once("line", (linha) => { rl.close(); resolve(linha); });
      return;
    }
    let texto = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const aoReceber = (tecla) => {
      for (const c of tecla) {
        if (c === "\r" || c === "\n" || c === "\u0004") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener("data", aoReceber);
          process.stdout.write("\n");
          return resolve(texto);
        }
        if (c === "\u0003") { process.stdout.write("\n"); process.exit(130); } // Ctrl+C
        if (c === "\u007f" || c === "\b") {
          if (texto.length) { texto = texto.slice(0, -1); process.stdout.write("\b \b"); }
        } else if (c >= " ") {
          texto += c;
          process.stdout.write("*");
        }
      }
    };
    process.stdin.on("data", aoReceber);
  });
}

async function main() {
  const [nomeBruto, emailBruto, passwordArg] = process.argv.slice(2);
  const nome = (nomeBruto || "").trim();
  const email = (emailBruto || "").trim();

  if (!nome || !email) {
    console.error('Uso: node scripts/criar-coordenador.js "Nome Completo" email@exemplo.pt');
    process.exitCode = 1;
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("O email não é válido.");
    process.exitCode = 1;
    return;
  }

  const password = passwordArg || (await perguntarPasswordOculta("Password do coordenador: "));
  if (!password || password.length < 8) {
    console.error("A password tem de ter pelo menos 8 caracteres.");
    process.exitCode = 1;
    return;
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    console.error("A password não pode ter mais de 72 bytes (limite do bcrypt).");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const existente = await prisma.user.findUnique({ where: { email } });

  const user = existente
    ? await prisma.user.update({
        where: { id: existente.id },
        data: { nome, email, passwordHash, role: "COORDENADOR", ativo: true, turmaId: null },
      })
    : await prisma.user.create({
        data: { nome, email, passwordHash, role: "COORDENADOR" },
      });

  console.log(`Coordenador "${user.nome}" (${user.email}) pronto a fazer login. id=${user.id}`);
}

main()
  .catch((error) => {
    console.error("Erro ao criar o coordenador:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
