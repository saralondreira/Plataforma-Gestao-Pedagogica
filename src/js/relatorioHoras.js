import { api } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";

const tbody = document.querySelector("#tabela-horas tbody");
const filtroDe = document.getElementById("filtro-de");
const filtroAte = document.getElementById("filtro-ate");
let relatorio = [];

async function carregar() {
  const params = new URLSearchParams();
  if (filtroDe.value) params.set("de", filtroDe.value);
  if (filtroAte.value) params.set("ate", filtroAte.value);

  try {
    relatorio = await api(`/aulas/relatorio-formadores${params.size ? `?${params}` : ""}`);
    desenhar();
  } catch (error) {
    showToast(error.message || "Erro ao carregar o relatório.", "error");
  }
}

function desenhar() {
  if (relatorio.length === 0) {
    tbody.innerHTML = '<tr class="linha-vazia"><td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">Não há formadores ativos.</td></tr>';
    return;
  }

  tbody.innerHTML = relatorio
    .map(
      (r, i) => `
      <tr>
        <td><strong>${escapeHtml(r.formador.nome)}</strong></td>
        <td>${r.horasDadas}h</td>
        <td>${r.horasPorDar}h</td>
        <td><strong>${r.horasTotal}h</strong></td>
        <td>${r.blocosLivres}</td>
        <td>${r.blocosBloqueados}</td>
        <td><button class="btn-icon btn-detalhe" data-i="${i}" title="Detalhe por UC"><i class="ph ph-caret-down"></i></button></td>
      </tr>`
    )
    .join("");

  tbody.querySelectorAll(".btn-detalhe").forEach((botao) => {
    botao.addEventListener("click", () => {
      const linha = botao.closest("tr");
      if (linha.nextElementSibling?.classList.contains("linha-detalhe")) {
        linha.nextElementSibling.remove();
        return;
      }
      const { detalhe } = relatorio[Number(botao.getAttribute("data-i"))];
      const itens = detalhe.length
        ? detalhe.map((d) => `<li>${escapeHtml(d.turma)} — <strong>${escapeHtml(d.uc)}</strong> (${escapeHtml(d.ucNome)}): ${d.dadas}h dadas, ${d.porDar}h por dar</li>`).join("")
        : "<li>Sem aulas no período.</li>";
      const tr = document.createElement("tr");
      tr.className = "linha-detalhe";
      tr.innerHTML = `<td colspan="7" style="background: #f8fafc; font-size: 13px"><ul style="margin: 6px 0 6px 18px">${itens}</ul></td>`;
      linha.after(tr);
    });
  });
}

// Nomes vêm de fora: neutraliza células que o Excel leria como fórmulas.
function celulaCsv(valor) {
  let texto = String(valor ?? "");
  if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

function exportarCsv() {
  const cabecalho = ["Formador", "Turma", "UC", "Horas dadas", "Horas por dar"];
  const linhas = [];
  relatorio.forEach((r) => {
    if (r.detalhe.length === 0) linhas.push([r.formador.nome, "", "", 0, 0]);
    r.detalhe.forEach((d) => linhas.push([r.formador.nome, d.turma, d.uc, d.dadas, d.porDar]));
  });
  const csv = "\uFEFF" + [cabecalho, ...linhas].map((l) => l.map(celulaCsv).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "horas-por-formador.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

filtroDe.addEventListener("change", carregar);
filtroAte.addEventListener("change", carregar);
document.getElementById("btn-limpar-filtro").addEventListener("click", () => {
  filtroDe.value = "";
  filtroAte.value = "";
  carregar();
});
document.getElementById("btn-exportar-horas").addEventListener("click", exportarCsv);
carregar();
