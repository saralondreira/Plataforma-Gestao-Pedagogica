import { api, getUser } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";

const role = getUser()?.role;
const COR = { VERDE: "green", AMARELO: "yellow", VERMELHO: "red" };
const BORDA = { VERDE: "#22c55e", AMARELO: "#f59e0b", VERMELHO: "#ef4444" };
const NOME = { VERDE: "Em dia", AMARELO: "Atenção", VERMELHO: "Em falha" };

const bolinha = (estado) => `<span class="badge ${COR[estado]}" style="white-space: nowrap; display: inline-block">${NOME[estado]}</span>`;

function totais(r) {
  return ["VERMELHO", "AMARELO", "VERDE"]
    .map((estado) => {
      const valor = r[estado.toLowerCase()];
      return `<div class="section-card" style="height: auto; text-align: center; border-top: 3px solid ${BORDA[estado]}"><h2 style="margin: 0">${valor}</h2><p style="color: #64748b; margin: 4px 0 0">${NOME[estado]}</p></div>`;
    })
    .join("");
}

function detalheSumarios(s) {
  if (s.aulasDadas === 0) return '<span style="color:#94a3b8">Sem aulas dadas</span>';
  const partes = [`${s.validados}/${s.aulasDadas} validados`];
  if (s.porValidar) partes.push(`${s.porValidar} por validar`);
  if (s.emFalta) partes.push(`${s.emFalta} em falta${s.emAtraso ? ` (${s.emAtraso} em atraso)` : ""}`);
  return partes.join(" · ");
}

function linha(u) {
  const link = role === "COORDENADOR" ? `turmaUcs.html?turmaId=${u.turmaId}` : "sumarios.html";
  return `<tr>
    <td>${bolinha(u.estado)}</td>
    <td><strong>${escapeHtml(u.turma)}</strong></td>
    <td><strong>${escapeHtml(u.uc)}</strong><br><small style="color:#64748b">${escapeHtml(u.ucNome)}</small></td>
    <td>${escapeHtml(u.formador)}</td>
    <td>${bolinha(u.sumarios.estado)}<br><small>${detalheSumarios(u.sumarios)}</small></td>
    <td>${bolinha(u.documentos.estado)}<br><small>${u.documentos.total} documento(s)</small></td>
    <td>${bolinha(u.horario.estado)}<br><small>${u.horario.horasPorAgendar}h por agendar</small></td>
    <td><a href="${link}">Abrir</a></td></tr>`;
}

async function avisar() {
  if (!window.confirm("Enviar um email a cada formador com UCs em falha (a vermelho)?")) return;
  try {
    const r = await api("/painel/conformidade/avisar", { method: "POST" });
    showToast(r.formadoresAvisados ? `${r.formadoresAvisados} formador(es) avisado(s) por email.` : "Não há UCs em falha — ninguém a avisar.", "success");
  } catch (error) {
    showToast(error.message || "Erro ao enviar os avisos.", "error");
  }
}

async function iniciar() {
  const botao = document.getElementById("btn-avisar");
  if (role === "COORDENADOR") {
    botao.style.display = "";
    botao.addEventListener("click", avisar);
  }
  document.getElementById("subtitulo-pagina").textContent =
    role === "COORDENADOR" ? "Semáforos automáticos por UC de cada turma em curso." : "O estado das tuas UCs: sumários, documentos e horário.";
  try {
    const r = await api("/painel/conformidade");
    document.getElementById("dias-tolerancia").textContent = r.diasTolerancia;
    document.getElementById("conformidade-totais").innerHTML = totais(r);
    document.getElementById("conformidade-conteudo").innerHTML = r.ucs.length
      ? `<div class="section-card table-standard" style="height: auto"><div class="table-container-clean" style="height: auto; max-height: 600px">
          <table class="status-table"><thead><tr><th>Estado</th><th>Turma</th><th>UC</th><th>Formador</th><th>Sumários</th><th>Documentos</th><th>Horário</th><th></th></tr></thead>
          <tbody>${r.ucs.map(linha).join("")}</tbody></table></div></div>`
      : '<div class="section-card" style="height: auto"><p style="color: #64748b">Não há UCs em curso para avaliar.</p></div>';
  } catch (error) {
    showToast(error.message || "Erro ao carregar a conformidade.", "error");
  }
}

iniciar();
