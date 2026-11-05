import { api, getUser, abrirFicheiroProtegido } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";
import { formatarDataPT, formatarDataHoraPT, formatarHora, mostrar } from "./formatos.js";

const role = getUser()?.role;
const subtitulo = document.getElementById("subtitulo-pagina");

function badgeJustificacao(justificacao) {
  if (!justificacao) return "—";
  const mapa = { PENDENTE: ["yellow", "Pendente"], ACEITE: ["green", "Aceite"], REJEITADA: ["red", "Rejeitada"] };
  const [cor, texto] = mapa[justificacao.estado];
  const nota = justificacao.notaDecisao ? ` title="${escapeHtml(justificacao.notaDecisao)}"` : "";
  return `<span class="badge ${cor}"${nota}>${texto}</span>`;
}

// ================================================================ formando

const modalJustificar = document.getElementById("modal-justificar");
const formJustificar = document.getElementById("form-justificar");
let aulaEmJustificacao = null;

function badgePresenca(item) {
  if (item.presenca === "PRESENTE") return '<span class="badge green">Presente</span>';
  if (item.presenca === "AUSENTE") {
    return item.justificacao?.estado === "ACEITE"
      ? '<span class="badge green">Falta justificada</span>'
      : '<span class="badge red">Falta</span>';
  }
  return '<span class="badge yellow">Por registar</span>';
}

async function carregarMinhasAulas() {
  mostrar(document.getElementById("vista-formando"), true);
  subtitulo.textContent = "As tuas presenças, faltas e justificações.";

  try {
    const { resumo, aulas } = await api("/assiduidade/minhas");

    const cartoes = [
      ["Aulas registadas", resumo.aulasRegistadas],
      ["Presenças", resumo.presencas],
      ["Faltas", resumo.faltas],
      ["Justificadas", resumo.faltasJustificadas],
    ];
    document.getElementById("resumo-assiduidade").innerHTML = cartoes
      .map(([rotulo, valor]) => `<div class="section-card" style="text-align: center"><h2>${valor}</h2><p style="color: #64748b">${rotulo}</p></div>`)
      .join("");

    const tbody = document.querySelector("#tabela-minhas-aulas tbody");
    if (aulas.length === 0) {
      tbody.innerHTML =
        '<tr class="linha-vazia"><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">Ainda não há aulas agendadas para a tua turma.</td></tr>';
      return;
    }

    tbody.innerHTML = aulas
      .map((item) => {
        const podeJustificar = item.presenca === "AUSENTE" && (!item.justificacao || item.justificacao.estado === "REJEITADA");
        const acao = podeJustificar
          ? `<button class="btn-login btn-justificar" type="button" style="width: auto; display: inline-block; padding: 6px 14px"
               data-aula="${item.aula.id}" data-info="${escapeHtml(`${formatarDataPT(item.aula.data)} ${formatarHora(item.aula.horaInicio)} — ${item.uc.abreviatura}`)}">Justificar</button>`
          : "—";
        return `
        <tr>
          <td>${formatarDataPT(item.aula.data)}</td>
          <td>${formatarHora(item.aula.horaInicio)}</td>
          <td><strong>${escapeHtml(item.uc.abreviatura)}</strong> — ${escapeHtml(item.uc.nome)}</td>
          <td>${badgePresenca(item)}</td>
          <td>${badgeJustificacao(item.justificacao)}</td>
          <td>${acao}</td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll(".btn-justificar").forEach((botao) => {
      botao.addEventListener("click", () => {
        aulaEmJustificacao = botao.getAttribute("data-aula");
        document.getElementById("justificar-aula-info").textContent = `Falta de ${botao.getAttribute("data-info")}`;
        formJustificar.reset();
        modalJustificar.style.display = "flex";
      });
    });
  } catch (error) {
    showToast(error.message || "Erro ao carregar a assiduidade.", "error");
  }
}

if (formJustificar) {
  document.getElementById("fechar-modal-justificar").addEventListener("click", () => {
    modalJustificar.style.display = "none";
  });

  formJustificar.addEventListener("submit", async (e) => {
    e.preventDefault();
    const corpo = new FormData();
    corpo.append("aulaId", aulaEmJustificacao);
    corpo.append("motivo", document.getElementById("justificar-motivo").value.trim());
    const anexo = document.getElementById("justificar-anexo").files[0];
    if (anexo) corpo.append("anexo", anexo);

    try {
      await api("/assiduidade/justificacoes", { method: "POST", body: corpo });
      modalJustificar.style.display = "none";
      showToast("Justificação submetida — fica a aguardar decisão.", "success");
      carregarMinhasAulas();
    } catch (error) {
      showToast(error.message || "Erro ao submeter a justificação.", "error");
    }
  });
}

// ================================================================= formador: presenças

const selectTurmaUc = document.getElementById("select-turma-uc");
const selectAula = document.getElementById("select-aula");
const cartaoPresencas = document.getElementById("cartao-presencas");
const tbodyPresencas = document.querySelector("#tabela-presencas tbody");
let aulaSelecionada = null;
const btnGuardarPresencas = document.getElementById("btn-guardar-presencas");
const blocoConfirmadas = document.getElementById("presencas-confirmadas");

// Depois de confirmadas, as presenças ficam bloqueadas (só leitura) até o formador clicar em "Editar presenças".
function bloquearPresencas(bloquear) {
  tbodyPresencas.querySelectorAll("input[type=radio]").forEach((r) => (r.disabled = bloquear));
  btnGuardarPresencas.style.display = bloquear ? "none" : "inline-block";
  blocoConfirmadas.style.display = bloquear ? "inline-flex" : "none";
}

async function carregarUcsDoFormador() {
  mostrar(document.getElementById("vista-presencas"), true);
  subtitulo.textContent = "Regista as presenças das aulas que já deste e decide as justificações de faltas.";

  try {
    const turmaUcs = await api("/turma-ucs/minhas");
    turmaUcs.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `${t.turma.codigo} — ${t.uc.abreviatura} ${t.uc.nome}`;
      selectTurmaUc.appendChild(opt);
    });
  } catch (error) {
    showToast(error.message || "Erro ao carregar as tuas UCs.", "error");
  }
}

let pedidoAulas = 0;

async function carregarAulas(turmaUcId) {
  const pedido = ++pedidoAulas; // ignora respostas de uma UC entretanto trocada
  mostrar(cartaoPresencas, false);
  aulaSelecionada = null;
  selectAula.innerHTML = '<option value="">— Seleciona primeiro a UC —</option>';
  selectAula.disabled = true;
  if (!turmaUcId) return;

  try {
    const aulas = await api(`/aulas/turma-uc/${turmaUcId}`);
    if (pedido !== pedidoAulas) return;
    const dadas = aulas.filter((a) => new Date(a.data).getTime() <= Date.now());
    selectAula.innerHTML = `<option value="">${dadas.length ? "— Seleciona a aula —" : "Ainda não há aulas já dadas"}</option>`;
    dadas
      .sort((a, b) => new Date(b.data) - new Date(a.data) || b.horaInicio - a.horaInicio)
      .forEach((aula) => {
        const opt = document.createElement("option");
        opt.value = aula.id;
        opt.textContent = `${formatarDataPT(aula.data)} ${formatarHora(aula.horaInicio)}`;
        selectAula.appendChild(opt);
      });
    selectAula.disabled = dadas.length === 0;
  } catch (error) {
    showToast(error.message || "Erro ao carregar as aulas.", "error");
  }
}

let pedidoPresencas = 0;

async function carregarPresencas(aulaId) {
  const meuPedido = ++pedidoPresencas;
  aulaSelecionada = aulaId || null;
  mostrar(cartaoPresencas, false); // esconde a tabela anterior enquanto carrega: nunca se grava a tabela de outra aula
  if (!aulaId) return;

  try {
    const dados = await api(`/assiduidade/aula/${aulaId}`);
    if (meuPedido !== pedidoPresencas) return; // resposta atrasada de uma seleção anterior
    document.getElementById("titulo-presencas").textContent = `${dados.aula.turma.codigo} — ${dados.aula.uc.abreviatura} — ${formatarDataPT(dados.aula.data)} ${formatarHora(dados.aula.horaInicio)}`;
    mostrar(cartaoPresencas, true);

    if (dados.formandos.length === 0) {
      bloquearPresencas(false);
      tbodyPresencas.innerHTML =
        '<tr class="linha-vazia"><td colspan="3" style="text-align: center; padding: 20px; color: #64748b;">Esta turma ainda não tem formandos associados.</td></tr>';
      return;
    }

    tbodyPresencas.innerHTML = dados.formandos
      .map(
        ({ formando, presenca, justificacao }) => `
        <tr data-formando="${formando.id}">
          <td><strong>${escapeHtml(formando.nome)}</strong></td>
          <td>
            <label style="margin-right: 14px"><input type="radio" name="pres-${formando.id}" value="PRESENTE" ${presenca === "PRESENTE" ? "checked" : ""} /> Presente</label>
            <label><input type="radio" name="pres-${formando.id}" value="AUSENTE" ${presenca === "AUSENTE" ? "checked" : ""} /> Ausente</label>
          </td>
          <td>${badgeJustificacao(justificacao)}</td>
        </tr>`
      )
      .join("");
    // Já há presenças registadas para esta aula: mostra-as bloqueadas.
    bloquearPresencas(dados.formandos.some(({ presenca }) => presenca));
  } catch (error) {
    showToast(error.message || "Erro ao carregar as presenças.", "error");
  }
}

if (selectTurmaUc) {
  selectTurmaUc.addEventListener("change", () => carregarAulas(selectTurmaUc.value));
  selectAula.addEventListener("change", () => carregarPresencas(selectAula.value));

  document.getElementById("btn-editar-presencas").addEventListener("click", () => {
    if (confirm("Editar as presenças já confirmadas desta aula?")) bloquearPresencas(false);
  });

  btnGuardarPresencas.addEventListener("click", async () => {
    if (!aulaSelecionada) return;
    const presencas = [...tbodyPresencas.querySelectorAll("tr[data-formando]")]
      .map((linha) => {
        const marcado = linha.querySelector("input[type=radio]:checked");
        return marcado ? { formandoId: Number(linha.getAttribute("data-formando")), estado: marcado.value } : null;
      })
      .filter(Boolean);

    if (presencas.length === 0) {
      showToast("Marca pelo menos um formando como presente ou ausente.", "error");
      return;
    }

    try {
      await api(`/assiduidade/aula/${aulaSelecionada}`, { method: "PUT", body: { presencas } });
      showToast("Presenças guardadas.", "success");
      carregarPresencas(aulaSelecionada);
      carregarJustificacoes();
    } catch (error) {
      showToast(error.message || "Erro ao guardar as presenças.", "error");
    }
  });
}

// ================================================ formador e coordenação: justificações

const tbodyJustificacoes = document.querySelector("#tabela-justificacoes tbody");
const checkboxDecididas = document.getElementById("mostrar-decididas");

async function carregarJustificacoes() {
  if (!tbodyJustificacoes) return;
  try {
    const filtro = checkboxDecididas && checkboxDecididas.checked ? "" : "?estado=PENDENTE";
    const lista = await api(`/assiduidade/justificacoes${filtro}`);

    if (lista.length === 0) {
      tbodyJustificacoes.innerHTML =
        '<tr class="linha-vazia"><td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">Não há justificações para mostrar.</td></tr>';
      return;
    }

    tbodyJustificacoes.innerHTML = lista
      .map((j) => {
        const acoes =
          j.estado === "PENDENTE"
            ? `<button class="btn-icon btn-aceitar" data-id="${j.id}" title="Aceitar"><i class="ph ph-check-circle"></i></button>
               <button class="btn-icon btn-rejeitar" data-id="${j.id}" title="Rejeitar"><i class="ph ph-x-circle"></i></button>`
            : "—";
        const anexo = j.temAnexo ? `<a href="#" class="link-anexo" data-id="${j.id}"><i class="ph ph-paperclip"></i> Abrir</a>` : "—";
        return `
        <tr>
          <td><strong>${escapeHtml(j.formando.nome)}</strong></td>
          <td>${formatarDataPT(j.aula.data)} ${formatarHora(j.aula.horaInicio)}</td>
          <td>${escapeHtml(j.aula.turmaUc.uc.abreviatura)} <span style="color: #94a3b8">(${escapeHtml(j.aula.turmaUc.turma.codigo)})</span></td>
          <td>${escapeHtml(j.motivo)}</td>
          <td>${anexo}</td>
          <td>${badgeJustificacao(j)}</td>
          <td>${acoes}</td>
        </tr>`;
      })
      .join("");

    tbodyJustificacoes.querySelectorAll(".link-anexo").forEach((link) => {
      link.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          await abrirFicheiroProtegido(`/assiduidade/justificacoes/${link.getAttribute("data-id")}/anexo`);
        } catch (error) {
          showToast(error.message || "Não foi possível abrir o anexo.", "error");
        }
      });
    });

    async function decidir(botao, estado) {
      const nota = prompt(estado === "ACEITE" ? "Nota para o formando (opcional):" : "Motivo da rejeição (opcional):", "");
      if (nota === null) return; // cancelado
      try {
        await api(`/assiduidade/justificacoes/${botao.getAttribute("data-id")}/decidir`, {
          method: "PATCH",
          body: { estado, ...(nota.trim() ? { notaDecisao: nota.trim() } : {}) },
        });
        showToast(estado === "ACEITE" ? "Justificação aceite." : "Justificação rejeitada.", "success");
        carregarJustificacoes();
        if (aulaSelecionada) carregarPresencas(aulaSelecionada);
      } catch (error) {
        showToast(error.message || "Erro ao decidir a justificação.", "error");
      }
    }

    tbodyJustificacoes.querySelectorAll(".btn-aceitar").forEach((b) => b.addEventListener("click", () => decidir(b, "ACEITE")));
    tbodyJustificacoes.querySelectorAll(".btn-rejeitar").forEach((b) => b.addEventListener("click", () => decidir(b, "REJEITADA")));
  } catch (error) {
    showToast(error.message || "Erro ao carregar as justificações.", "error");
  }
}

if (checkboxDecididas) checkboxDecididas.addEventListener("change", carregarJustificacoes);

// ============================================================ arranque por papel

if (role === "FORMANDO") {
  carregarMinhasAulas();
} else if (role === "FORMADOR") {
  carregarUcsDoFormador();
  mostrar(document.getElementById("vista-justificacoes"), true);
  carregarJustificacoes();
} else if (role === "COORDENADOR") {
  subtitulo.textContent = "Justificações de faltas de todas as turmas.";
  document.getElementById("titulo-pagina").textContent = "Justificações de Faltas";
  mostrar(document.getElementById("vista-justificacoes"), true);
  carregarJustificacoes();
}
