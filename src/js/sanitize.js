// Escapa texto antes de o inserir em innerHTML. Necessário sempre que o
// texto pode vir de alguém sem conta (ex.: o nome/email submetidos no
// formulário público de Pedido de Acesso, forms.html) — sem isto, um nome
// como "<img src=x onerror=...>" corre como JavaScript na sessão de quem
// vir a lista depois (normalmente a coordenação, com o token de sessão no
// localStorage).
export function escapeHtml(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
