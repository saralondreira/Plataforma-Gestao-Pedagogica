// "Hoje" para as regras de negócio é o dia em Lisboa, não o do servidor (UTC):
// perto da meia-noite, e com a hora de verão, os dois dias podem não coincidir.
// As datas de aulas, blocos e prazos guardam-se como meia-noite UTC desse dia.
const FUSO = "Europe/Lisbon";

const formatador = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });

// Meia-noite UTC do dia de hoje em Lisboa (comparável com as datas guardadas na base de dados).
function hojeEmLisboa(agora = new Date()) {
  return new Date(`${formatador.format(agora)}T00:00:00.000Z`);
}

// Último instante do dia de hoje em Lisboa, na mesma representação.
function fimDeHojeEmLisboa(agora = new Date()) {
  return new Date(hojeEmLisboa(agora).getTime() + 24 * 60 * 60 * 1000 - 1);
}

module.exports = { hojeEmLisboa, fimDeHojeEmLisboa, FUSO };
