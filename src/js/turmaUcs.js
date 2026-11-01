import { api } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";

const params = new URLSearchParams(window.location.search);
const turmaId = params.get("turmaId");

const tituloTurma = document.getElementById("titulo-turma");
const subtituloTurma = document.getElementById("subtitulo-turma");
const tbodyTurmaUcs = document.querySelector("#tabela-turma-ucs tbody");
const selectUcCatalogo = document.getElementById("tuc-uc-catalogo");
const selectFormadorTuc = document.getElementById("tuc-formador");
const formAssociarUc = document.getElementById("form-associar-uc");
const btnToggleNovaUcCatalogo = document.getElementById("btn-toggle-nova-uc-catalogo");
const blocoNovaUcCatalogo = document.getElementById("bloco-nova-uc-catalogo");
const formNovaUcCatalogo = document.getElementById("form-nova-uc-catalogo");
const checkboxTucDesativadas = document.getElementById("mostrar-tuc-desativadas");

if (!turmaId) {
  tituloTurma.textContent = "Turma não encontrada";
  subtituloTurma.textContent = "Falta o identificador da turma no endereço — volta a Gestão Turmas e usa o botão \"Gerir UCs\".";
} else {
  iniciar();
}

const selectCopiarOrigem = document.getElementById("copiar-origem");

async function carregarTurmasParaCopiar() {
  try {
    const turmas = await api("/turmas");
    turmas
      .filter((t) => String(t.id) !== String(turmaId))
      .forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = `${t.codigo} — ${t.designacao}`;
        selectCopiarOrigem.appendChild(opt);
      });
  } catch (error) {
    showToast(error.message || "Erro ao carregar as turmas.", "error");
  }
}

document.getElementById("btn-copiar-ucs").addEventListener("click", async () => {
  if (!selectCopiarOrigem.value) {
    showToast("Escolhe a turma de origem.", "error");
    return;
  }
  try {
    const { copiadas, ignoradas } = await api("/turma-ucs/copiar", {
      method: "POST",
      body: { origemTurmaId: selectCopiarOrigem.value, destinoTurmaId: turmaId },
    });
    const ignoradasTexto = ignoradas.length ? ` Ignoradas: ${ignoradas.map((i) => `${i.uc} (${i.motivo})`).join("; ")}.` : "";
    showToast(`${copiadas.length} UC(s) copiada(s).${ignoradasTexto}`, copiadas.length ? "success" : "error");
    carregarTurmaUcs();
  } catch (error) {
    showToast(error.message || "Erro ao copiar as UCs.", "error");
  }
});

// A UC já tem aulas futuras: oferece passá-las para o novo formador (mesma data
// e hora). Se ele não tiver blocos livres para todas, pergunta se se cancelam
// as que não dá para passar.
async function substituirComAulas(turmaUcId, formadorId, motivo) {
  if (!confirm(`${motivo}\n\nQueres passar as aulas futuras para o novo formador (mesma data e hora)?`)) return;
  const url = `/turma-ucs/${turmaUcId}/substituir-formador`;
  try {
    let r;
    try {
      r = await api(url, { method: "PATCH", body: { formadorId } });
    } catch (erro) {
      if (erro.codigo !== "SEM_BLOCOS_LIVRES") throw erro;
      if (!confirm(`${erro.message}\n\nCancelar as aulas sem bloco livre e passar as restantes?`)) return;
      r = await api(url, { method: "PATCH", body: { formadorId, cancelarSemBloco: true } });
    }
    showToast(`Formador substituído: ${r.movidas} aula(s) passada(s)${r.canceladas ? `, ${r.canceladas} cancelada(s)` : ""}.`, "success");
  } catch (erro) {
    showToast(erro.message || "Erro ao substituir o formador.", "error");
  }
}

async function iniciar() {
  carregarTurmasParaCopiar();
  await carregarCabecalhoTurma();
  await Promise.all([carregarCatalogoUcsNoSelect(), carregarFormadoresParaAssociar(selectFormadorTuc), carregarTurmaUcs()]);
}

async function carregarCabecalhoTurma() {
  try {
    const turmas = await api("/turmas");
    const turma = turmas.find((t) => String(t.id) === String(turmaId));
    if (!turma) {
      tituloTurma.textContent = "Turma não encontrada";
      subtituloTurma.textContent = "Esta turma pode ter sido apagada.";
      return;
    }
    tituloTurma.textContent = `UCs da turma — ${turma.codigo}`;
    subtituloTurma.textContent = turma.designacao;
  } catch (error) {
    showToast(error.message || "Erro ao carregar a turma.", "error");
  }
}

async function carregarCatalogoUcsNoSelect() {
  if (!selectUcCatalogo) return;
  try {
    const ucs = await api("/ucs");
    selectUcCatalogo.innerHTML = '<option value="">— Seleciona —</option>';
    ucs.forEach((uc) => {
      const opt = document.createElement("option");
      opt.value = uc.id;
      opt.textContent = `${uc.abreviatura} — ${uc.nome} (${uc.cargaHoraria}h)`;
      selectUcCatalogo.appendChild(opt);
    });
  } catch (error) {
    showToast(error.message || "Erro ao carregar o catálogo de UCs.", "error");
  }
}

async function carregarFormadoresParaAssociar(selectEl) {
  if (!selectEl) return;
  try {
    const formadores = await api("/formadores");
    selectEl.innerHTML = '<option value="">— Seleciona —</option>';
    formadores.forEach((formador) => {
      const opt = document.createElement("option");
      opt.value = formador.id;
      opt.textContent = formador.nome;
      selectEl.appendChild(opt);
    });
  } catch (error) {
    showToast(error.message || "Erro ao carregar formadores.", "error");
  }
}

async function carregarTurmaUcs() {
  if (!turmaId || !tbodyTurmaUcs) return;
  try {
    const incluirInativos = checkboxTucDesativadas ? checkboxTucDesativadas.checked : false;
    const associacoes = await api(`/turma-ucs/turma/${turmaId}${incluirInativos ? "?incluirInativos=true" : ""}`);
    // incluirInativos=true aqui (independente da checkbox acima, que é só para
    // as associações) para o formador atualmente associado continuar a
    // aparecer no <select> mesmo que tenha sido desativado entretanto — senão
    // nenhuma opção corresponde a assoc.formadorId e o browser mostra o
    // primeiro formador da lista, dando a impressão errada de que mudou.
    const formadores = await api("/formadores?incluirInativos=true");
    tbodyTurmaUcs.innerHTML = "";

    if (associacoes.length === 0) {
      tbodyTurmaUcs.innerHTML =
        '<tr class="linha-vazia"><td colspan="7" style="text-align: center; padding: 15px; color: #64748b;">Ainda não há UCs associadas a esta turma.</td></tr>';
      return;
    }

    associacoes.forEach((assoc) => {
      const tr = document.createElement("tr");
      const desativada = assoc.ativo === false;
      if (desativada) tr.style.opacity = "0.55";
      const opcoesFormador = formadores
        // Mostra os formadores ativos, mais o atualmente associado mesmo que
        // tenha sido desativado — mas esse fica desabilitado (não dá para
        // reescolhê-lo depois de já estar desativado).
        .filter((f) => f.ativo !== false || f.id === assoc.formadorId)
        .map((f) => {
          const inativo = f.ativo === false;
          return `<option value="${f.id}" ${f.id === assoc.formadorId ? "selected" : ""} ${inativo ? "disabled" : ""}>${escapeHtml(f.nome)}${inativo ? " (desativado)" : ""}</option>`;
        })
        .join("");
      const acaoRemoverOuReativar = desativada
        ? `<button class="btn-icon btn-reativar-tuc" data-id="${assoc.id}" title="Reativar"><i class="ph ph-arrow-counter-clockwise"></i></button>`
        : `<button class="btn-icon btn-remover-tuc" data-id="${assoc.id}" title="Remover da turma"><i class="ph ph-trash"></i></button>`;
      tr.innerHTML = `
        <td><strong>${escapeHtml(assoc.uc.abreviatura)}</strong></td>
        <td>${escapeHtml(assoc.uc.nome)}${desativada ? ' <span class="badge red" style="margin-left: 6px;">DESATIVADA</span>' : ""}</td>
        <td>${assoc.uc.cargaHoraria}h</td>
        <td><select class="select-formador-tuc" data-id="${assoc.id}" ${desativada ? "disabled" : ""}>${opcoesFormador}</select></td>
        <td>${assoc.horasDadas}h</td>
        <td><span class="badge ${assoc.horasEmFalta === 0 ? "green" : "yellow"}">${assoc.horasEmFalta}h</span></td>
        <td>${acaoRemoverOuReativar}</td>
      `;
      tbodyTurmaUcs.appendChild(tr);
    });

    document.querySelectorAll(".select-formador-tuc").forEach((select) => {
      select.addEventListener("change", async () => {
        try {
          await api(`/turma-ucs/${select.getAttribute("data-id")}`, {
            method: "PATCH",
            body: { formadorId: Number(select.value) },
          });
          showToast("Formador atualizado.", "success");
          carregarTurmaUcs();
        } catch (error) {
          if (error.codigo === "TURMA_UC_COM_AULAS_FUTURAS") {
            await substituirComAulas(select.getAttribute("data-id"), Number(select.value), error.message);
          } else {
            showToast(error.message || "Erro ao mudar o formador.", "error");
          }
          carregarTurmaUcs();
        }
      });
    });

    document.querySelectorAll(".btn-remover-tuc").forEach((botao) => {
      botao.addEventListener("click", async () => {
        if (!confirm("Remover esta UC da turma? As aulas já dadas mantêm-se e podes reativar a associação mais tarde.")) return;
        try {
          await api(`/turma-ucs/${botao.getAttribute("data-id")}`, { method: "DELETE" });
          showToast("UC removida da turma.", "success");
          carregarTurmaUcs();
        } catch (error) {
          showToast(error.message || "Erro ao remover UC da turma.", "error");
        }
      });
    });

    document.querySelectorAll(".btn-reativar-tuc").forEach((botao) => {
      botao.addEventListener("click", async () => {
        try {
          await api(`/turma-ucs/${botao.getAttribute("data-id")}/reativar`, { method: "PATCH" });
          showToast("UC reativada nesta turma.", "success");
          carregarTurmaUcs();
        } catch (error) {
          showToast(error.message || "Erro ao reativar UC nesta turma.", "error");
        }
      });
    });
  } catch (error) {
    showToast(error.message || "Erro ao carregar as UCs desta turma.", "error");
  }
}

if (checkboxTucDesativadas) {
  checkboxTucDesativadas.addEventListener("change", carregarTurmaUcs);
}

if (btnToggleNovaUcCatalogo) {
  btnToggleNovaUcCatalogo.addEventListener("click", () => {
    blocoNovaUcCatalogo.style.display = blocoNovaUcCatalogo.style.display === "none" ? "" : "none";
  });
}

if (formNovaUcCatalogo) {
  formNovaUcCatalogo.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dados = {
      abreviatura: document.getElementById("catalogo-abreviatura").value,
      nome: document.getElementById("catalogo-nome").value,
      cargaHoraria: Number(document.getElementById("catalogo-carga-horaria").value),
    };
    try {
      const novaUc = await api("/ucs", { method: "POST", body: dados });
      showToast("UC criada no catálogo!", "success");
      formNovaUcCatalogo.reset();
      blocoNovaUcCatalogo.style.display = "none";
      await carregarCatalogoUcsNoSelect();
      selectUcCatalogo.value = novaUc.id;
    } catch (error) {
      showToast(error.message || "Erro ao criar UC no catálogo.", "error");
    }
  });
}

if (formAssociarUc) {
  formAssociarUc.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!turmaId) return;
    const dados = {
      turmaId: Number(turmaId),
      ucId: Number(selectUcCatalogo.value),
      formadorId: Number(selectFormadorTuc.value),
    };
    try {
      await api("/turma-ucs", { method: "POST", body: dados });
      showToast("UC associada à turma!", "success");
      formAssociarUc.reset();
      carregarTurmaUcs();
    } catch (error) {
      showToast(error.message || "Erro ao associar UC à turma.", "error");
    }
  });
}
