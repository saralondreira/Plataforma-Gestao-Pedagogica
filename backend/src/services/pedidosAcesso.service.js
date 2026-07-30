const { prisma } = require("../lib/prisma");

async function criar(dados) {
  return prisma.pedidoAcesso.create({ data: dados });
}

module.exports = { criar };
