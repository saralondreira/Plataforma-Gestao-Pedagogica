const crypto = require("crypto");

// Impressão digital da palavra-passe atual: vai dentro do JWT (claim "ph") e o
// middleware compara-a com a da base de dados a cada pedido. Quando a
// palavra-passe muda (recuperação), as sessões antigas — incluindo uma roubada —
// deixam de funcionar sem precisar de uma tabela de sessões.
function impressaoDaPassword(passwordHash) {
  return crypto.createHash("sha256").update(String(passwordHash)).digest("hex").slice(0, 16);
}

module.exports = { impressaoDaPassword };
