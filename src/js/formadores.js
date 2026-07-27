import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from "./toast.js";

const formNovoFormador = document.getElementById("form-novo-formador");
const tbodyFormadores = document.querySelector("#tabela-formadores tbody");
const modalFormador = document.getElementById("modal-formador");
const modalTitulo = document.getElementById("modal-titulo-formador");
const btnNovoFormador = document.getElementById("btn-novo-formador");
const btnFecharModal = document.getElementById("fechar-modal-formador");

let idFormadorEmEdicao = null;

if (btnFecharModal) {
  btnFecharModal.addEventListener("click", () => {
    modalFormador.style.display = "none";
  });
}

if (btnNovoFormador) {
  btnNovoFormador.addEventListener("click", () => {
    idFormadorEmEdicao = null;
    formNovoFormador.reset();
    modalTitulo.textContent = "Adicionar Formador";
    modalFormador.style.display = "flex";
  });
}

async function carregarFormadores() {
  if (!tbodyFormadores) return;

  try {
    const q = query(collection(db, "formadores"), orderBy("dataCriacao", "desc"));
    const querySnapshot = await getDocs(q);
    
    tbodyFormadores.innerHTML = "";

    if (querySnapshot.empty) {
      tbodyFormadores.innerHTML =
        '<tr class="linha-vazia"><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">Nenhum formador registado.</td></tr>';
      return;
    }

    querySnapshot.forEach((documentoFirebase) => {
      const formador = documentoFirebase.data();
      const id = documentoFirebase.id;

      let cor = formador.estado === "ativo" ? "green" : "red";
      let estadoTexto = formador.estado ? formador.estado.toUpperCase() : "ATIVO";

      const tr = document.createElement("tr");
      tr.setAttribute("data-estado", formador.estado || "ativo");

      tr.innerHTML = `
                <td><div class="avatar-circle">${formador.sigla || ''}</div> <strong>${formador.nome || ''}</strong></td>
                <td>${formador.nome || ''}</td>
                <td style="text-align: center;">${formador.turmas || 0}</td>
                <td style="text-align: center;">${formador.ucs || 0}</td>
                <td><span class="badge ${cor}">${estadoTexto}</span></td>
                <td>
                    <button class="btn-icon btn-editar" 
                        data-id="${id}" 
                        data-sigla="${formador.sigla || ''}" 
                        data-nome="${formador.nome || ''}" 
                        data-turmas="${formador.turmas || 0}" 
                        data-ucs="${formador.ucs || 0}" 
                        data-estado="${formador.estado || 'ativo'}" 
                        title="Editar"><i class="ph ph-pencil-simple"></i>
                    </button>
                    <button class="btn-icon btn-apagar" data-id="${id}" title="Apagar"><i class="ph ph-trash"></i></button>
                </td>
            `;
      tbodyFormadores.appendChild(tr);
    });

    const botoesApagar = document.querySelectorAll(".btn-apagar");
    botoesApagar.forEach((botao) => {
      botao.addEventListener("click", async () => {
        const idFormador = botao.getAttribute("data-id");
        if (confirm("Tens a certeza que queres apagar este formador?")) {
          try {
            await deleteDoc(doc(db, "formadores", idFormador));
            showToast("Formador apagado com sucesso!", "success");
            carregarFormadores();
          } catch (error) {
            console.error("Erro:", error);
            showToast("Erro ao apagar formador.", "error");
          }
        }
      });
    });

    const botoesEditar = document.querySelectorAll(".btn-editar");
    botoesEditar.forEach((botao) => {
      botao.addEventListener("click", () => {
        idFormadorEmEdicao = botao.getAttribute("data-id");
        document.getElementById("new-sigla").value = botao.getAttribute("data-sigla");
        document.getElementById("new-nome").value = botao.getAttribute("data-nome");
        document.getElementById("new-turmas-qtd").value = botao.getAttribute("data-turmas");
        document.getElementById("new-ucs-qtd").value = botao.getAttribute("data-ucs");
        document.getElementById("new-estado-formador").value = botao.getAttribute("data-estado");

        modalTitulo.textContent = "Editar Formador";
        modalFormador.style.display = "flex";
      });
    });
  } catch (error) {
    console.error("Erro ao carregar formadores:", error);
  }
}

carregarFormadores();

if (formNovoFormador) {
  formNovoFormador.addEventListener("submit", async (e) => {
    e.preventDefault();

    const sigla = document.getElementById("new-sigla").value;
    const nome = document.getElementById("new-nome").value;
    const turmas = document.getElementById("new-turmas-qtd").value;
    const ucs = document.getElementById("new-ucs-qtd").value;
    const estado = document.getElementById("new-estado-formador").value;

    try {
      if (idFormadorEmEdicao) {
        const formadorRef = doc(db, "formadores", idFormadorEmEdicao);
        await updateDoc(formadorRef, {
          sigla: sigla,
          nome: nome,
          turmas: turmas,
          ucs: ucs,
          estado: estado,
        });
        showToast("Formador atualizado com sucesso!", "success");
      } else {
        await addDoc(collection(db, "formadores"), {
          sigla: sigla,
          nome: nome,
          turmas: turmas,
          ucs: ucs,
          estado: estado,
          dataCriacao: new Date(),
        });
        showToast("Novo formador adicionado com sucesso!", "success");
      }

      formNovoFormador.reset();
      modalFormador.style.display = "none";
      idFormadorEmEdicao = null;
      carregarFormadores();
    } catch (error) {
      console.error("Erro ao guardar formador: ", error);
      showToast("Ocorreu um erro ao guardar os dados.", "error");
    }
  });
}

const inputPesquisaFormadores = document.getElementById("pesquisa-formadores");
if (inputPesquisaFormadores) {
  inputPesquisaFormadores.addEventListener("keyup", function () {
    const termoPesquisa = this.value.toLowerCase();
    const linhasTabela = document.querySelectorAll("#tabela-formadores tbody tr");

    linhasTabela.forEach((linha) => {
      if (linha.classList.contains("linha-vazia")) return;

      const textoDaLinha = linha.textContent.toLowerCase();

      if (textoDaLinha.includes(termoPesquisa)) {
        linha.style.display = "";
      } else {
        linha.style.display = "none";
      }
    });
  });
}