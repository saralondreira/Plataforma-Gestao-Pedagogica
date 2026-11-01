const { z } = require("zod");

// O bcrypt só usa os primeiros 72 bytes da palavra-passe: acima disso, palavras-passe
// diferentes dariam o mesmo resultado. Recusa-se em vez de truncar em silêncio.
const passwordNova = z
  .string()
  .min(8, "A palavra-passe tem de ter pelo menos 8 caracteres.")
  .refine((p) => Buffer.byteLength(p, "utf8") <= 72, "A palavra-passe não pode ter mais de 72 bytes.");

// Data de calendário real no formato AAAA-MM-DD ("2026-99-99" é recusada).
const dataISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data no formato AAAA-MM-DD")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Data inválida");

module.exports = { passwordNova, dataISO };
