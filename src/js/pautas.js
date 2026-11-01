import { api } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";
import { formatarNota, corDaNota, mostrar } from "./formatos.js";

const selectTurma = document.getElementById("select-turma");
const cartaoPauta = document.getElementById("cartao-pauta");
const cartaoAssiduidade = document.getElementById("cartao-assiduidade");
const pautaContainer = document.getElementById("pauta-container");
const tbodyAssiduidade = document.querySelector("#tabela-assiduidade-turma tbody");
const btnExportar = document.getElementById("btn-exportar-pauta");
const btnImprimir = document.getElementById("btn-imprimir-pauta");

let pautaAtual = null;

function media(valores) {
  return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
}

function notasDoFormando(pauta, formandoId) {
  return pauta.ucs.map((uc) => pauta.notas.find((n) => n.turmaUcId === uc.turmaUcId && n.formandoId === formandoId)?.valor ?? null);
}

function desenharPauta(pauta) {
  if (pauta.formandos.length === 0 || pauta.ucs.length === 0) {
    pautaContainer.innerHTML =
      '<p style="padding: 20px; color: #64748b">Esta turma ainda não tem formandos ou UCs associadas.</p>';
    return;
  }

  const cabecalho = pauta.ucs
    .map((uc) => `<th title="${escapeHtml(uc.nome)}">${escapeHtml(uc.abreviatura)}</th>`)
    .join("");
  const linhas = pauta.formandos
    .map((formando) => {
      const notas = notasDoFormando(pauta, formando.id);
      const mediaFormando = media(notas.filter((n) => n !== null));
      const celulas = notas
        .map((n) => (n === null ? '<td style="color: #cbd5e1">—</td>' : `<td><span class="badge ${corDaNota(n)}">${formatarNota(n)}</span></td>`))
        .join("");
      return `<tr><td><strong>${escapeHtml(formando.nome)}</strong></td>${celulas}<td><strong>${mediaFormando === null ? "—" : formatarNota(Number(mediaFormando.toFixed(1)))}</strong></td></tr>`;
    })
    .join("");

  pautaContainer.innerHTML = `<table class="status-table"><thead><tr><th>Formando</th>${cabecalho}<th>Média</th></tr></thead><tbody>${linhas}</tbody></table>`;
}

function desenharAssiduidade(resumo) {
  document.getElementById("titulo-assiduidade").textContent = `Assiduidade por formando — ${resumo.aulasDadas} aula(s) já dada(s)`;

  if (resumo.formandos.length === 0) {
    tbodyAssiduidade.innerHTML =
      '<tr class="linha-vazia"><td colspan="5" style="text-align: center; padding: 20px; color: #64748b;">Esta turma ainda não tem formandos.</td></tr>';
    return;
  }

  tbodyAssiduidade.innerHTML = resumo.formandos
    .map(
      (f) => `
      <tr>
        <td><strong>${escapeHtml(f.formando.nome)}</strong></td>
        <td>${f.presencas}</td>
        <td>${f.faltas}</td>
        <td>${f.faltasJustificadas}</td>
        <td>${f.faltasInjustificadas > 0 ? `<span class="badge red">${f.faltasInjustificadas}</span>` : "0"}</td>
      </tr>`
    )
    .join("");
}

let pedidoTurma = 0;

async function carregarTurma(turmaId) {
  const meuPedido = ++pedidoTurma;
  const visivel = Boolean(turmaId);
  mostrar(cartaoPauta, visivel);
  mostrar(cartaoAssiduidade, visivel);
  mostrar(btnExportar, false);
  mostrar(btnImprimir, false);
  pautaAtual = null;
  if (!visivel) return;

  try {
    const [pauta, resumo] = await Promise.all([api(`/notas/pauta/turma/${turmaId}`), api(`/assiduidade/turma/${turmaId}/resumo`)]);
    if (meuPedido !== pedidoTurma) return; // resposta atrasada de uma seleção anterior
    pautaAtual = pauta;
    desenharPauta(pauta);
    desenharAssiduidade(resumo);
    const temDados = pauta.formandos.length > 0 && pauta.ucs.length > 0;
    mostrar(btnExportar, temDados);
    mostrar(btnImprimir, temDados);
  } catch (error) {
    showToast(error.message || "Erro ao carregar a turma.", "error");
  }
}

// Células que começam por = + - @ podem ser lidas como fórmulas pelo Excel —
// o nome de um formando vem de fora, por isso neutraliza-se com um apóstrofo.
function celulaCsv(valor) {
  let texto = String(valor ?? "");
  if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

function exportarCsv() {
  if (!pautaAtual) return;
  const cabecalho = ["Formando", ...pautaAtual.ucs.map((u) => u.abreviatura), "Média"];
  const linhas = pautaAtual.formandos.map((formando) => {
    const notas = notasDoFormando(pautaAtual, formando.id);
    const m = media(notas.filter((n) => n !== null));
    return [formando.nome, ...notas.map((n) => (n === null ? "" : formatarNota(n))), m === null ? "" : formatarNota(Number(m.toFixed(1)))];
  });
  // ";" e BOM: é o que o Excel em português espera para abrir o ficheiro sem estragar acentos.
  const csv = "﻿" + [cabecalho, ...linhas].map((l) => l.map(celulaCsv).join(";")).join("\r\n");

  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `pauta-${pautaAtual.turma.codigo}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function iniciar() {
  try {
    const turmas = await api("/turmas");
    turmas.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `${t.codigo} — ${t.designacao}`;
      selectTurma.appendChild(opt);
    });
  } catch (error) {
    showToast(error.message || "Erro ao carregar as turmas.", "error");
  }
}

// PDF: usa a impressão do browser ("Guardar como PDF"); o CSS @media print
// esconde o menu e o seletor e deixa só a pauta e a assiduidade.
function imprimirPauta() {
  if (!pautaAtual) return;
  const titulo = document.title;
  document.getElementById("cabecalho-impressao").textContent =
    `Pauta — ${pautaAtual.turma.codigo} — ${pautaAtual.turma.designacao} (${new Date().toLocaleDateString("pt-PT")})`;
  document.title = `pauta-${pautaAtual.turma.codigo}`;
  window.print();
  document.title = titulo;
}

selectTurma.addEventListener("change", () => carregarTurma(selectTurma.value));
btnExportar.addEventListener("click", exportarCsv);
btnImprimir.addEventListener("click", imprimirPauta);
iniciar();
