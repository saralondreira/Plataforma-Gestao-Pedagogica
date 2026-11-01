// Helpers de datas partilhados pela agenda do formador e da coordenação.
// Semana representada Domingo -> Sábado, tal como no cronograma da IEFP.

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function formatarDataISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function inicioDaSemana(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function diasDaSemana(inicioSemana) {
  const dias = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicioSemana);
    d.setDate(d.getDate() + i);
    dias.push(d);
  }
  return dias;
}

export function formatarIntervaloSemana(inicioSemana) {
  const fim = new Date(inicioSemana);
  fim.setDate(fim.getDate() + 6);
  const opcoes = { day: "2-digit", month: "2-digit" };
  return `${inicioSemana.toLocaleDateString("pt-PT", opcoes)} – ${fim.toLocaleDateString("pt-PT", opcoes)}`;
}
