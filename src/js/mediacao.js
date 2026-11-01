import { api } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";

const conteudo = document.getElementById("mediacao-conteudo");
const LIMITE_FALTAS = 3; // mesmo limite do alerta da coordenação

function barra(feito, total) {
  const pct = total > 0 ? Math.min(100, Math.round((feito / total) * 100)) : 0;
  return `<div style="min-width: 110px"><div>${feito}/${total}h</div><div style="background: #e2e8f0; border-radius: 4px; height: 6px"><div style="width: ${pct}%; background: #3b82f6; height: 6px; border-radius: 4px"></div></div></div>`;
}

function desenharTurma({ turma, ucs, aulasDadas, formandos }) {
  const linhasUcs = ucs.length
    ? ucs
        .map((u) => `<tr><td><strong>${escapeHtml(u.abreviatura)}</strong> — ${escapeHtml(u.nome)}</td><td>${escapeHtml(u.formador)}</td><td>${barra(u.horasDadas, u.cargaHoraria)}</td><td>${u.horasEmFalta}h</td></tr>`)
        .join("")
    : '<tr class="linha-vazia"><td colspan="4" style="text-align: center; padding: 16px; color: #64748b">Esta turma ainda não tem UCs associadas.</td></tr>';

  const linhasFormandos = formandos.length
    ? formandos
        .map((f) => `<tr><td><strong>${escapeHtml(f.nome)}</strong></td><td>${f.presencas}</td><td>${f.faltas}</td><td>${f.faltasInjustificadas >= LIMITE_FALTAS ? `<span class="badge red">${f.faltasInjustificadas}</span>` : f.faltasInjustificadas}</td></tr>`)
        .join("")
    : '<tr class="linha-vazia"><td colspan="4" style="text-align: center; padding: 16px; color: #64748b">Esta turma ainda não tem formandos.</td></tr>';

  return `
    <div class="section-card table-standard" style="height: auto; margin-bottom: 20px">
      <div class="card-header-simple"><h3>${escapeHtml(turma.codigo)} — ${escapeHtml(turma.designacao)}</h3></div>
      <h4 style="margin: 8px 0">UCs</h4>
      <div class="table-container-clean" style="height: auto">
        <table class="status-table"><thead><tr><th>UC</th><th>Formador</th><th>Horas agendadas</th><th>Por agendar</th></tr></thead><tbody>${linhasUcs}</tbody></table>
      </div>
      <h4 style="margin: 16px 0 8px">Assiduidade (${aulasDadas} aula(s) já dada(s))</h4>
      <div class="table-container-clean" style="height: auto; max-height: 320px">
        <table class="status-table"><thead><tr><th>Formando</th><th>Presenças</th><th>Faltas</th><th>Injustificadas</th></tr></thead><tbody>${linhasFormandos}</tbody></table>
      </div>
    </div>`;
}

async function iniciar() {
  try {
    const turmas = await api("/turmas/mediacao");
    conteudo.innerHTML = turmas.length
      ? turmas.map(desenharTurma).join("")
      : '<div class="section-card" style="height: auto"><p style="color: #64748b">Não és mediador responsável de nenhuma turma. A coordenação define o mediador em Gestão Turmas.</p></div>';
  } catch (error) {
    showToast(error.message || "Erro ao carregar as turmas.", "error");
  }
}

iniciar();
