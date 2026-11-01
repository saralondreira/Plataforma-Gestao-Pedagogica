const path = require("path");

// override: true — uma DATABASE_URL herdada do terminal nunca pode ganhar ao .env.test.
require("dotenv").config({ path: path.join(__dirname, "..", ".env.test"), override: true });

// Os testes apagam tudo (limparBaseDados): recusa arrancar se a base não for de testes.
const url = process.env.DATABASE_URL || "";
const nomeDaBase = decodeURIComponent((url.split("?")[0].split("/").pop() || ""));
if (!/test/i.test(nomeDaBase)) {
  throw new Error(`Os testes só correm contra uma base de dados de testes (o nome tem de incluir "test"). Base atual: "${nomeDaBase}".`);
}
