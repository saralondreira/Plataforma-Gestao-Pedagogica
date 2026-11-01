import { api, getUser, abrirFicheiroProtegido } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";
import { formatarDataPT, formatarDataHoraPT, formatarNota, corDaNota, mostrar } from "./formatos.js";

const role = getUser()?.role;
const subtitulo = document.getElementById("subtitulo-pagina");

function abrirFicheiro(link, caminho) {
  link.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await abrirFicheiroProtegido(caminho(link));
    } catch (error) {
      showToast(error.message || "Não foi possível abrir o ficheiro.", "error");
    }
  });
}

// =================================================================== formando

const modalSubmeter = document.getElementById("modal-submeter");
const formSubmeter = document.getElementById("form-submeter");
let trabalhoEmSubmissao = null;

async function carregarMeusTrabalhos() {
  mostrar(document.getElementById("vista-formando"), true);
  subtitulo.textContent = "Os trabalhos atribuídos pelos teus formadores. Podes reenviar até ao fim do prazo.";
  const tbody = document.querySelector("#tabela-meus-trabalhos tbody");

  try {
    const trabalhos = await api("/trabalhos/minhas");
    if (trabalhos.length === 0) {
      tbody.innerHTML =
        '<tr class="linha-vazia"><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">Ainda não há trabalhos atribuídos.</td></tr>';
      return;
    }

    tbody.innerHTML = trabalhos
      .map((t) => {
        const s = t.submissao;
        const estado = s
          ? `<span class="badge green">Entregue</span><br /><small style="color: #64748b">${formatarDataHoraPT(s.enviadaEm)}</small>`
          : t.prazoTerminado
            ? '<span class="badge red">Não entregue</span>'
            : '<span class="badge yellow">Por entregar</span>';
        const avaliacao =
          s && s.avaliacao !== null
            ? `<span class="badge ${corDaNota(s.avaliacao)}">${formatarNota(s.avaliacao)}</span>`
            : "—";
        const feedback = s?.feedback ? `<br /><small style="color: #64748b">${escapeHtml(s.feedback)}</small>` : "";
        const botaoSubmeter = !t.prazoTerminado
          ? `<button class="btn-login btn-submeter" type="button" style="width: auto; display: inline-block; padding: 6px 14px" data-id="${t.id}" data-titulo="${escapeHtml(t.titulo)}">${s ? "Reenviar" : "Submeter"}</button>`
          : "";
        const linkFicheiro = s ? ` <a href="#" class="link-meu-ficheiro" data-sid="${s.id}"><i class="ph ph-paperclip"></i> O meu ficheiro</a>` : "";
        return `
        <tr>
          <td><strong>${escapeHtml(t.uc.abreviatura)}</strong></td>
          <td><strong>${escapeHtml(t.titulo)}</strong>${t.descricao ? `<br /><small style="color: #64748b; white-space: pre-wrap">${escapeHtml(t.descricao)}</small>` : ""}</td>
          <td>${formatarDataPT(t.dataLimite)}${t.prazoTerminado ? '<br /><span class="badge red">Prazo terminado</span>' : ""}</td>
          <td>${estado}</td>
          <td>${avaliacao}${feedback}</td>
          <td>${botaoSubmeter}${linkFicheiro}</td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll(".btn-submeter").forEach((botao) => {
      botao.addEventListener("click", () => {
        trabalhoEmSubmissao = botao.getAttribute("data-id");
        document.getElementById("submeter-info").textContent = botao.getAttribute("data-titulo");
        formSubmeter.reset();
        modalSubmeter.style.display = "flex";
      });
    });
    tbody.querySelectorAll(".link-meu-ficheiro").forEach((l) =>
      abrirFicheiro(l, (el) => `/trabalhos/submissoes/${el.getAttribute("data-sid")}/ficheiro`)
    );
  } catch (error) {
    showToast(error.message || "Erro ao carregar os trabalhos.", "error");
  }
}

if (formSubmeter) {
  document.getElementById("fechar-modal-submeter").addEventListener("click", () => {
    modalSubmeter.style.display = "none";
  });

  formSubmeter.addEventListener("submit", async (e) => {
    e.preventDefault();
    const corpo = new FormData();
    corpo.append("ficheiro", document.getElementById("submeter-ficheiro").files[0]);
    const comentario = document.getElementById("submeter-comentario").value.trim();
    if (comentario) corpo.append("comentario", comentario);

    try {
      await api(`/trabalhos/${trabalhoEmSubmissao}/submissao`, { method: "POST", body: corpo });
      modalSubmeter.style.display = "none";
      showToast("Trabalho submetido!", "success");
      carregarMeusTrabalhos();
    } catch (error) {
      showToast(error.message || "Erro ao submeter o trabalho.", "error");
    }
  });
}

// =================================================================== formador

const selectTurmaUc = document.getElementById("select-turma-uc");
const cartaoTrabalhos = document.getElementById("cartao-trabalhos");
const tbodyTrabalhos = document.querySelector("#tabela-trabalhos-formador tbody");
const btnNovoTrabalho = document.getElementById("btn-novo-trabalho");

const modalNovo = document.getElementById("modal-novo-trabalho");
const formNovo = document.getElementById("form-novo-trabalho");
const modalSubmissoes = document.getElementById("modal-submissoes");

async function carregarUcsDoFormador() {
  mostrar(document.getElementById("vista-formador"), true);
  subtitulo.textContent = "Atribui trabalhos às tuas UCs e avalia as submissões dos formandos.";

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

async function carregarTrabalhosDaUc() {
  const turmaUcId = selectTurmaUc.value;
  mostrar(cartaoTrabalhos, Boolean(turmaUcId));
  mostrar(btnNovoTrabalho, Boolean(turmaUcId));
  if (!turmaUcId) return;

  document.getElementById("titulo-trabalhos").textContent = selectTurmaUc.options[selectTurmaUc.selectedIndex].textContent;

  try {
    const trabalhos = await api(`/trabalhos/turma-uc/${turmaUcId}`);
    if (trabalhos.length === 0) {
      tbodyTrabalhos.innerHTML =
        '<tr class="linha-vazia"><td colspan="4" style="text-align: center; padding: 20px; color: #64748b;">Ainda não atribuíste trabalhos nesta UC.</td></tr>';
      return;
    }

    tbodyTrabalhos.innerHTML = trabalhos
      .map(
        (t) => `
        <tr>
          <td><strong>${escapeHtml(t.titulo)}</strong>${t.descricao ? `<br /><small style="color: #64748b; white-space: pre-wrap">${escapeHtml(t.descricao)}</small>` : ""}</td>
          <td>${formatarDataPT(t.dataLimite)}</td>
          <td><span class="badge ${t.totalSubmissoes === t.totalFormandos && t.totalFormandos > 0 ? "green" : "yellow"}">${t.totalSubmissoes}/${t.totalFormandos}</span></td>
          <td>
            <button class="btn-icon btn-ver-submissoes" data-id="${t.id}" title="Ver submissões"><i class="ph ph-eye"></i></button>
            <button class="btn-icon btn-apagar-trabalho" data-id="${t.id}" title="Apagar"><i class="ph ph-trash"></i></button>
          </td>
        </tr>`
      )
      .join("");

    tbodyTrabalhos.querySelectorAll(".btn-ver-submissoes").forEach((b) =>
      b.addEventListener("click", () => abrirSubmissoes(b.getAttribute("data-id")))
    );
    tbodyTrabalhos.querySelectorAll(".btn-apagar-trabalho").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Apagar este trabalho? As submissões já feitas mantêm-se guardadas.")) return;
        try {
          await api(`/trabalhos/${b.getAttribute("data-id")}`, { method: "DELETE" });
          showToast("Trabalho apagado.", "success");
          carregarTrabalhosDaUc();
        } catch (error) {
          showToast(error.message || "Erro ao apagar o trabalho.", "error");
        }
      })
    );
  } catch (error) {
    showToast(error.message || "Erro ao carregar os trabalhos.", "error");
  }
}

async function abrirSubmissoes(trabalhoId) {
  try {
    const dados = await api(`/trabalhos/${trabalhoId}/submissoes`);
    document.getElementById("modal-submissoes-titulo").textContent = dados.trabalho.titulo;
    document.getElementById("submissoes-descricao").textContent = `Prazo: ${formatarDataPT(dados.trabalho.dataLimite)}`;
    const tbody = document.querySelector("#tabela-submissoes tbody");

    if (dados.formandos.length === 0) {
      tbody.innerHTML =
        '<tr class="linha-vazia"><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">Esta turma ainda não tem formandos associados.</td></tr>';
    } else {
      tbody.innerHTML = dados.formandos
        .map(({ formando, submissao: s }) =>
          s
            ? `
        <tr data-sid="${s.id}">
          <td><strong>${escapeHtml(formando.nome)}</strong>${s.comentario ? `<br /><small style="color: #64748b">${escapeHtml(s.comentario)}</small>` : ""}</td>
          <td>${formatarDataHoraPT(s.enviadaEm)}</td>
          <td><a href="#" class="link-sub-ficheiro" data-sid="${s.id}"><i class="ph ph-paperclip"></i> Abrir</a></td>
          <td><input type="number" class="input-avaliacao" min="0" max="20" step="0.1" style="width: 70px" value="${s.avaliacao ?? ""}" /></td>
          <td><input type="text" class="input-feedback" maxlength="2000" style="width: 100%; min-width: 140px" value="${s.feedback ? escapeHtml(s.feedback) : ""}" /></td>
          <td><button class="btn-login btn-avaliar" type="button" style="width: auto; display: inline-block; padding: 6px 14px">Guardar</button></td>
        </tr>`
            : `
        <tr>
          <td><strong>${escapeHtml(formando.nome)}</strong></td>
          <td colspan="5" style="color: #94a3b8">Ainda não entregou</td>
        </tr>`
        )
        .join("");

      tbody.querySelectorAll(".link-sub-ficheiro").forEach((l) =>
        abrirFicheiro(l, (el) => `/trabalhos/submissoes/${el.getAttribute("data-sid")}/ficheiro`)
      );
      tbody.querySelectorAll(".btn-avaliar").forEach((botao) =>
        botao.addEventListener("click", async () => {
          const linha = botao.closest("tr");
          const bruto = linha.querySelector(".input-avaliacao").value.replace(",", ".");
          const feedback = linha.querySelector(".input-feedback").value.trim();
          const corpo = { ...(feedback ? { feedback } : {}) };
          if (bruto !== "") {
            const valor = parseFloat(bruto);
            if (Number.isNaN(valor) || valor < 0 || valor > 20) {
              showToast("Indica uma nota entre 0 e 20.", "error");
              return;
            }
            corpo.avaliacao = valor;
          }
          try {
            await api(`/trabalhos/submissoes/${linha.getAttribute("data-sid")}/avaliar`, { method: "PATCH", body: corpo });
            showToast("Avaliação guardada.", "success");
          } catch (error) {
            showToast(error.message || "Erro ao guardar a avaliação.", "error");
          }
        })
      );
    }
    modalSubmissoes.style.display = "flex";
  } catch (error) {
    showToast(error.message || "Erro ao carregar as submissões.", "error");
  }
}

if (selectTurmaUc) {
  selectTurmaUc.addEventListener("change", carregarTrabalhosDaUc);
  btnNovoTrabalho.addEventListener("click", () => {
    formNovo.reset();
    modalNovo.style.display = "flex";
  });
  document.getElementById("fechar-modal-novo-trabalho").addEventListener("click", () => {
    modalNovo.style.display = "none";
  });
  document.getElementById("fechar-modal-submissoes").addEventListener("click", () => {
    modalSubmissoes.style.display = "none";
    carregarTrabalhosDaUc();
  });

  formNovo.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/trabalhos", {
        method: "POST",
        body: {
          turmaUcId: Number(selectTurmaUc.value),
          titulo: document.getElementById("trabalho-titulo").value.trim(),
          descricao: document.getElementById("trabalho-descricao").value.trim(),
          dataLimite: document.getElementById("trabalho-prazo").value,
        },
      });
      modalNovo.style.display = "none";
      showToast("Trabalho atribuído!", "success");
      carregarTrabalhosDaUc();
    } catch (error) {
      showToast(error.message || "Erro ao atribuir o trabalho.", "error");
    }
  });
}

if (role === "FORMANDO") carregarMeusTrabalhos();
else if (role === "FORMADOR") carregarUcsDoFormador();
