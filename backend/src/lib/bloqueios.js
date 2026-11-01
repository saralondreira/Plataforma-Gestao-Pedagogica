// Bloqueio de linhas (SELECT ... FOR UPDATE) dentro de uma transação, para serializar pedidos em
// simultâneo sobre o mesmo recurso (agendar duas aulas ao mesmo tempo, lançar notas, bloquear um
// bloco que está a ser agendado...). Regras de uso:
//  - bloquear PRIMEIRO, antes de qualquer leitura normal da transação (a leitura normal fixa a
//    fotografia dos dados e não veria o que o outro pedido acabou de gravar);
//  - bloquear sempre pela mesma ordem: turmas, turma_ucs, disponibilidades (evita deadlocks).
const TABELAS = new Set(["turmas", "turma_ucs", "disponibilidades"]);

async function bloquear(tx, tabela, id) {
  if (!TABELAS.has(tabela)) throw new Error(`Tabela não permitida para bloqueio: ${tabela}`);
  await tx.$queryRawUnsafe(`SELECT id FROM ${tabela} WHERE id = ? FOR UPDATE`, Number(id));
}

module.exports = { bloquear };
