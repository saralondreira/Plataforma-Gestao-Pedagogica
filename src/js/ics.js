// Exportação de horários para calendário (.ics), compatível com Google
// Calendar, Outlook e Apple Calendar. Feito no browser a partir das aulas que a
// API já devolve — não há ligação real a nenhum serviço externo (decisão da
// Fase 6: a integração com Google/Outlook ficou como evolução futura).

function escapar(texto) {
  return String(texto ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Hora "flutuante" (sem fuso): o calendário mostra a aula à hora marcada, seja qual for o fuso.
function dataHora(dataISO, hora) {
  return `${dataISO.replace(/-/g, "")}T${String(hora).padStart(2, "0")}0000`;
}

function agora() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

// `aulas` vêm de /aulas/minhas, /aulas/turma/:id ou /aulas. Cada aula tem data
// (ISO), horaInicio, duracaoHoras, modalidade e turmaUc { uc, formador, turma? }.
export function gerarIcs(aulas, nomeCalendario) {
  const linhas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Plataforma de Gestao Pedagogica//PT", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${escapar(nomeCalendario)}`];

  aulas.forEach((aula) => {
    const dataISO = aula.data.slice(0, 10);
    const fim = aula.horaInicio + (aula.duracaoHoras || 1);
    const modalidade = aula.modalidade === "ONLINE" ? "Online" : "Presencial";
    const turma = aula.turmaUc.turma ? ` (${aula.turmaUc.turma.codigo})` : "";
    linhas.push(
      "BEGIN:VEVENT",
      `UID:aula-${aula.id}@plataforma-pedagogica`,
      `DTSTAMP:${agora()}`,
      `DTSTART:${dataHora(dataISO, aula.horaInicio)}`,
      `DTEND:${dataHora(dataISO, fim)}`,
      `SUMMARY:${escapar(`${aula.turmaUc.uc.abreviatura} — ${aula.turmaUc.uc.nome}${turma}`)}`,
      `DESCRIPTION:${escapar(`Formador: ${aula.turmaUc.formador.nome}\nModalidade: ${modalidade}`)}`,
      `LOCATION:${modalidade}`,
      "END:VEVENT"
    );
  });

  linhas.push("END:VCALENDAR");
  return linhas.join("\r\n") + "\r\n";
}

export function descarregarIcs(aulas, nomeCalendario, nomeFicheiro) {
  const url = URL.createObjectURL(new Blob([gerarIcs(aulas, nomeCalendario)], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFicheiro;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Intervalo usado nas exportações: de hoje a daqui a 6 meses.
export function intervaloDeExportacao() {
  const de = new Date();
  const ate = new Date(de.getFullYear(), de.getMonth() + 6, de.getDate());
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `de=${iso(de)}&ate=${iso(ate)}`;
}
