import { api, getUser } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";
import { formatarDataHoraPT, formatarNota, corDaNota, mostrar } from "./formatos.js";

const role = getUser()?.role;
const subtitulo = document.getElementById("subtitulo-pagina");

// ---------------------------------------------------------------- formando

async function carregarMinhasNotas() {
  mostrar(document.getElementById("vista-formando"), true);
  subtitulo.textContent = "As notas lançadas pelos teus formadores em cada UC.";
  const tbody = document.querySelector("#tabela-minhas-notas tbody");

  try {
    const notas = await api("/notas/minhas");
    if (notas.length === 0) {
      tbody.innerHTML =
        '<tr class="linha-vazia"><td colspan="5" style="text-align: center; padding: 20px; color: #64748b;">Ainda não tens notas lançadas.</td></tr>';
      return;
    }
    tbody.innerHTML = notas
      .map(
        (n) => `
        <tr>
          <td><strong>${escapeHtml(n.turmaUc.uc.abreviatura)}</strong> — ${escapeHtml(n.turmaUc.uc.nome)}</td>
          <td>${escapeHtml(n.turmaUc.formador.nome)}</td>
          <td><span class="badge ${corDaNota(n.valor)}">${formatarNota(n.valor)}</span></td>
          <td>${n.observacoes ? escapeHtml(n.observacoes) : "—"}</td>
          <td>${formatarDataHoraPT(n.updatedAt)}</td>
        </tr>`
      )
      .join("");
  } catch (error) {
    showToast(error.message || "Erro ao carregar as notas.", "error");
  }
}

// ----------------------------------------------------------------- formador

const selectTurmaUc = document.getElementById("select-turma-uc");
const cartaoNotas = document.getElementById("cartao-notas");
const tbodyLancar = document.querySelector("#tabela-lancar-notas tbody");

async function carregarUcsDoFormador() {
  mostrar(document.getElementById("vista-formador"), true);
  subtitulo.textContent = "Lança as notas dos formandos das UCs que lecionas (escala 0 a 20).";

  try {
    const turmaUcs = await api("/turma-ucs/minhas");
    turmaUcs.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `${t.turma.codigo} — ${t.uc.abreviatura} ${t.uc.nome}`;
      selectTurmaUc.appendChild(opt);
    });
    if (turmaUcs.length === 0) {
      subtitulo.textContent = "Ainda não tens UCs atribuídas em nenhuma turma.";
    }
  } catch (error) {
    showToast(error.message || "Erro ao carregar as tuas UCs.", "error");
  }
}

let pedidoLancamento = 0;

async function carregarLancamento(turmaUcId) {
  const meuPedido = ++pedidoLancamento;
  mostrar(cartaoNotas, false); // esconde a tabela anterior enquanto carrega: nunca se grava na UC errada
  if (!turmaUcId) return;

  try {
    const dados = await api(`/notas/turma-uc/${turmaUcId}`);
    if (meuPedido !== pedidoLancamento) return; // resposta atrasada de uma seleção anterior
    document.getElementById("titulo-lancamento").textContent = `${dados.turmaUc.turma.codigo} — ${dados.turmaUc.uc.abreviatura} ${dados.turmaUc.uc.nome}`;
    mostrar(cartaoNotas, true);

    if (dados.formandos.length === 0) {
      tbodyLancar.innerHTML =
        '<tr class="linha-vazia"><td colspan="5" style="text-align: center; padding: 20px; color: #64748b;">Esta turma ainda não tem formandos associados.</td></tr>';
      return;
    }

    tbodyLancar.innerHTML = dados.formandos
      .map(
        ({ formando, nota }) => `
        <tr data-formando="${formando.id}">
          <td><strong>${escapeHtml(formando.nome)}</strong></td>
          <td>${escapeHtml(formando.email)}</td>
          <td><input type="number" class="input-nota" min="0" max="20" step="0.1" style="width: 80px" value="${nota ? nota.valor : ""}" /></td>
          <td><input type="text" class="input-obs" maxlength="1000" style="width: 100%; min-width: 160px" value="${nota?.observacoes ? escapeHtml(nota.observacoes) : ""}" /></td>
          <td>
            <button class="btn-login btn-guardar-nota" type="button" style="width: auto; display: inline-block; padding: 6px 14px">Guardar</button>
            <button class="btn-icon btn-historico-nota" type="button" title="Histórico de alterações"><i class="ph ph-clock-counter-clockwise"></i></button>
          </td>
        </tr>`
      )
      .join("");

    tbodyLancar.querySelectorAll(".btn-guardar-nota").forEach((botao) => {
      botao.addEventListener("click", async () => {
        const linha = botao.closest("tr");
        const valor = parseFloat(linha.querySelector(".input-nota").value.replace(",", "."));
        if (Number.isNaN(valor) || valor < 0 || valor > 20) {
          showToast("Indica uma nota entre 0 e 20.", "error");
          return;
        }
        const observacoes = linha.querySelector(".input-obs").value.trim();

        try {
          await api(`/notas/turma-uc/${turmaUcId}/formando/${linha.getAttribute("data-formando")}`, {
            method: "PUT",
            body: { valor, ...(observacoes ? { observacoes } : {}) },
          });
          showToast("Nota guardada.", "success");
        } catch (error) {
          showToast(error.message || "Erro ao guardar a nota.", "error");
        }
      });
    });

    tbodyLancar.querySelectorAll(".btn-historico-nota").forEach((botao) => {
      botao.addEventListener("click", () => alternarHistorico(botao.closest("tr"), turmaUcId));
    });
  } catch (error) {
    showToast(error.message || "Erro ao carregar os formandos.", "error");
  }
}

// Auditoria: mostra/esconde, por baixo da linha do formando, quem alterou a nota e quando.
async function alternarHistorico(linha, turmaUcId) {
  const seguinte = linha.nextElementSibling;
  if (seguinte && seguinte.classList.contains("linha-historico")) {
    seguinte.remove();
    return;
  }

  try {
    const entradas = await api(`/notas/turma-uc/${turmaUcId}/formando/${linha.getAttribute("data-formando")}/historico`);
    const conteudo = entradas.length
      ? entradas
          .map(
            (e) =>
              `<li>${formatarDataHoraPT(e.createdAt)} — ${escapeHtml(e.alteradaPor.nome)}: ${e.valorAnterior === null ? "lançou" : `${formatarNota(e.valorAnterior)} →`} <strong>${formatarNota(e.valorNovo)}</strong>${e.observacoesNovas ? ` (“${escapeHtml(e.observacoesNovas)}”)` : ""}</li>`
          )
          .join("")
      : "<li>Sem alterações registadas.</li>";
    const tr = document.createElement("tr");
    tr.className = "linha-historico";
    tr.innerHTML = `<td colspan="5" style="background: #f8fafc; font-size: 13px"><ul style="margin: 6px 0 6px 18px">${conteudo}</ul></td>`;
    linha.after(tr);
  } catch (error) {
    showToast(error.message || "Erro ao carregar o histórico.", "error");
  }
}

if (selectTurmaUc) {
  selectTurmaUc.addEventListener("change", () => carregarLancamento(selectTurmaUc.value));
}

if (role === "FORMANDO") carregarMinhasNotas();
else if (role === "FORMADOR") carregarUcsDoFormador();
