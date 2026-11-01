// Formatação partilhada pelas páginas de notas, assiduidade, trabalhos e mensagens.
// As datas "só dia" (Aula.data) chegam como 2026-09-10T00:00:00.000Z — usa-se
// sempre UTC para não aparecerem um dia antes/depois consoante o fuso.

export function formatarDataPT(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

// Para instantes reais (mensagens, submissões): na hora local do utilizador.
export function formatarDataHoraPT(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const dia = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return `${dia} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatarHora(hora) {
  return `${String(hora).padStart(2, "0")}:00`;
}

export function formatarNota(valor) {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1).replace(".", ",");
}

// <input type="date"> quer YYYY-MM-DD.
export function dataParaInput(iso) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

export function corDaNota(valor) {
  if (valor >= 14) return "green";
  if (valor >= 10) return "yellow";
  return "red";
}

// Pequeno atalho: mostra/esconde um elemento por id.
export function mostrar(el, visivel) {
  if (el) el.style.display = visivel ? "" : "none";
}
