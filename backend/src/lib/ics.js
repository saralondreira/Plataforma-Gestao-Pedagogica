// Gerador de calendário .ics (RFC 5545) — a versão do servidor, usada pela
// subscrição por URL. Espelha src/js/ics.js (exportação pontual no browser).

function escapar(texto) {
  return String(texto ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Hora "flutuante" (sem fuso): o calendário mostra a aula à hora marcada.
function dataHora(dataISO, hora) {
  return `${dataISO.replace(/-/g, "")}T${String(hora).padStart(2, "0")}0000`;
}

function gerarIcs(aulas, nomeCalendario) {
  const agora = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Plataforma de Gestao Pedagogica//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapar(nomeCalendario)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];

  aulas.forEach((aula) => {
    const dataISO = aula.data.toISOString().slice(0, 10);
    const horasTotais = aula.horaInicio + (aula.duracaoHoras || 1);
    const diaFim = new Date(`${dataISO}T00:00:00Z`);
    diaFim.setUTCDate(diaFim.getUTCDate() + Math.floor(horasTotais / 24));
    const dataFimISO = diaFim.toISOString().slice(0, 10);
    const fim = horasTotais % 24;
    const modalidade = aula.modalidade === "ONLINE" ? "Online" : "Presencial";
    linhas.push(
      "BEGIN:VEVENT",
      `UID:aula-${aula.id}@plataforma-pedagogica`,
      `DTSTAMP:${agora}`,
      `DTSTART:${dataHora(dataISO, aula.horaInicio)}`,
      `DTEND:${dataHora(dataFimISO, fim)}`,
      `SUMMARY:${escapar(`${aula.turmaUc.uc.abreviatura} — ${aula.turmaUc.uc.nome} (${aula.turmaUc.turma.codigo})`)}`,
      `DESCRIPTION:${escapar(`Formador: ${aula.turmaUc.formador.nome}\nModalidade: ${modalidade}`)}`,
      `LOCATION:${modalidade}`,
      "END:VEVENT"
    );
  });

  linhas.push("END:VCALENDAR");
  return linhas.join("\r\n") + "\r\n";
}

module.exports = { gerarIcs };
