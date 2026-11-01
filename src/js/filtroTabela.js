// Pesquisa de texto + filtro por estado + contadores para as tabelas de turmas e de formadores.
// As linhas só existem depois de a API responder, por isso os contadores e o filtro têm de ser
// recalculados a cada desenho da tabela (o código antigo calculava-os uma única vez, com a tabela vazia).
export function ligarFiltros({ tabelaId, selectId, pesquisaId, rotulos, cores, todos }) {
  const tabela = document.getElementById(tabelaId);
  const select = document.getElementById(selectId);
  const pesquisa = pesquisaId ? document.getElementById(pesquisaId) : null;
  if (!tabela) return () => {};

  const linhas = () => [...tabela.querySelectorAll("tbody tr")].filter((l) => !l.classList.contains("linha-vazia") && !l.classList.contains("linha-sem-resultados"));

  function aplicar() {
    const termo = (pesquisa?.value || "").toLowerCase();
    const estado = select?.value || todos;
    let visiveis = 0;
    linhas().forEach((linha) => {
      const visivel = linha.textContent.toLowerCase().includes(termo) && (estado === todos || linha.dataset.estado === estado);
      linha.style.display = visivel ? "" : "none";
      if (visivel) visiveis++;
    });

    const corpo = tabela.querySelector("tbody");
    corpo.querySelector(".linha-sem-resultados")?.remove();
    if (linhas().length > 0 && visiveis === 0) {
      const colunas = tabela.querySelectorAll("thead th").length || 6;
      const vazia = document.createElement("tr");
      vazia.className = "linha-sem-resultados";
      vazia.innerHTML = `<td colspan="${colunas}" style="text-align: center; padding: 30px; color: #64748b;">Não existem dados para a pesquisa ou o estado selecionados.</td>`;
      corpo.appendChild(vazia);
    }
  }

  function atualizar() {
    const todasAsLinhas = linhas();
    if (select) {
      [...select.options].forEach((opcao) => {
        const n = opcao.value === todos ? todasAsLinhas.length : todasAsLinhas.filter((l) => l.dataset.estado === opcao.value).length;
        opcao.textContent = `${rotulos[opcao.value] || opcao.value.toUpperCase()} (${n})`;
      });
    }
    aplicar();
  }

  select?.addEventListener("change", () => {
    select.className = `badge ${cores[select.value] || "gray"}`;
    aplicar();
  });
  pesquisa?.addEventListener("keyup", aplicar);
  return atualizar;
}
