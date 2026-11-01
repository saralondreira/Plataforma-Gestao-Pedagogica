import { api, getUser } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";

const tituloTurma = document.getElementById("titulo-turma");
const subtituloTurma = document.getElementById("subtitulo-turma");
const avisoSemTurma = document.getElementById("aviso-sem-turma");
const conteudoTurma = document.getElementById("conteudo-turma");
const tbodyUcs = document.querySelector("#tabela-ucs-formando tbody");
const tbodyAulas = document.querySelector("#tabela-aulas-formando tbody");

function popularCabecalho(utilizador) {
  if (!utilizador || !utilizador.nome) return;
  document.querySelectorAll(".user-name strong").forEach((el) => {
    el.textContent = utilizador.nome;
  });
  const partes = utilizador.nome.trim().split(/\s+/);
  const iniciais = partes.length >= 2 ? partes[0].charAt(0) + partes[partes.length - 1].charAt(0) : partes[0].slice(0, 2);
  document.querySelectorAll(".avatar-circle").forEach((av) => {
    av.textContent = iniciais.toUpperCase();
  });
}

function formatarDataPT(dataISO) {
  const d = new Date(dataISO);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

async function iniciar() {
  const sessao = getUser();
  if (!sessao) {
    window.location.href = "login.html";
    return;
  }
  popularCabecalho(sessao);

  try {
    const dados = await api("/auth/me");
    popularCabecalho(dados);

    if (!dados.turmaId) {
      tituloTurma.textContent = "A Minha Turma";
      subtituloTurma.textContent = "Ainda não estás associado a nenhuma turma.";
      if (avisoSemTurma) avisoSemTurma.style.display = "";
      if (conteudoTurma) conteudoTurma.style.display = "none";
      return;
    }

    const turmas = await api("/turmas");
    const turma = turmas.find((t) => String(t.id) === String(dados.turmaId));

    if (!turma) {
      tituloTurma.textContent = "A Minha Turma";
      subtituloTurma.textContent = "A turma associada à tua conta já não existe ou foi desativada — contacta a coordenação.";
      if (avisoSemTurma) avisoSemTurma.style.display = "";
      if (conteudoTurma) conteudoTurma.style.display = "none";
      return;
    }

    tituloTurma.textContent = `A Minha Turma — ${turma.codigo}`;
    subtituloTurma.textContent = turma.designacao;

    await carregarUcsEAulas(dados.turmaId);
  } catch (error) {
    console.error("Erro ao carregar o dashboard do formando:", error);
    showToast(error.message || "Erro ao carregar os teus dados.", "error");
  }
}

async function carregarUcsEAulas(turmaId) {
  const turmaUcs = await api(`/turma-ucs/turma/${turmaId}`);

  if (tbodyUcs) {
    tbodyUcs.innerHTML = "";
    if (turmaUcs.length === 0) {
      tbodyUcs.innerHTML =
        '<tr class="linha-vazia"><td colspan="4" style="text-align: center; padding: 15px; color: #64748b;">Ainda não há UCs associadas a esta turma.</td></tr>';
    } else {
      turmaUcs.forEach((tuc) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${escapeHtml(tuc.uc.abreviatura)}</strong></td>
          <td>${escapeHtml(tuc.uc.nome)}</td>
          <td>${tuc.uc.cargaHoraria}h</td>
          <td>${escapeHtml(tuc.formador.nome)}</td>
        `;
        tbodyUcs.appendChild(tr);
      });
    }
  }

  if (!tbodyAulas) return;

  if (turmaUcs.length === 0) {
    tbodyAulas.innerHTML =
      '<tr class="linha-vazia"><td colspan="5" style="text-align: center; padding: 15px; color: #64748b;">Sem aulas agendadas.</td></tr>';
    return;
  }

  const formadorPorTurmaUc = new Map(turmaUcs.map((tuc) => [tuc.id, tuc.formador.nome]));

  const listasDeAulas = await Promise.all(
    turmaUcs.map((tuc) => api(`/aulas/turma-uc/${tuc.id}`))
  );
  const todasAulas = listasDeAulas.flat();

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const aulasFuturas = todasAulas
    .filter((aula) => new Date(aula.data) >= hoje)
    .sort((a, b) => new Date(a.data) - new Date(b.data) || a.horaInicio - b.horaInicio);

  tbodyAulas.innerHTML = "";
  if (aulasFuturas.length === 0) {
    tbodyAulas.innerHTML =
      '<tr class="linha-vazia"><td colspan="5" style="text-align: center; padding: 15px; color: #64748b;">Sem aulas futuras agendadas.</td></tr>';
    return;
  }

  aulasFuturas.forEach((aula) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatarDataPT(aula.data)}</td>
      <td>${String(aula.horaInicio).padStart(2, "0")}:00</td>
      <td>${escapeHtml(aula.turmaUc.uc.abreviatura)}</td>
      <td>${escapeHtml(formadorPorTurmaUc.get(aula.turmaUc.id) || "—")}</td>
      <td>${aula.modalidade === "ONLINE" ? "Online" : "Presencial"}</td>
    `;
    tbodyAulas.appendChild(tr);
  });
}

iniciar();
