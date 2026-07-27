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

const formNovaTurma = document.getElementById("form-nova-turma");
const tbodyTurmas = document.querySelector("#tabela-turmas tbody");
const modalTurma = document.getElementById("modal-turma");
const modalTitulo = document.querySelector("#modal-turma h3");
const btnNovoAviso = document.getElementById("btn-novo-aviso"); 
const modalAviso = document.getElementById("modal-aviso"); 
const fecharModalAviso = document.getElementById("fechar-modal-aviso");
let idTurmaEmEdicao = null;

const btnNovaTurma = document.getElementById("btn-nova-turma");
if (btnNovaTurma) {
  btnNovaTurma.addEventListener("click", () => {
    idTurmaEmEdicao = null;
    formNovaTurma.reset();
    modalTitulo.textContent = "Criar Nova Turma";
    modalTurma.style.display = "flex";
  });
}

const btnFecharModal = document.getElementById("fechar-modal");
if (btnFecharModal) {
    btnFecharModal.addEventListener("click", () => {
        modalTurma.style.display = "none";
    });
}

async function carregarTurmas() {
  if (!tbodyTurmas) return;

  try {
    const q = query(collection(db, "turmas"), orderBy("dataCriacao", "desc"));
    const querySnapshot = await getDocs(q);
    tbodyTurmas.innerHTML = "";

    if (querySnapshot.empty) {
      tbodyTurmas.innerHTML =
        '<tr class="linha-vazia"><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">Nenhuma turma encontrada.</td></tr>';
      return;
    }

    querySnapshot.forEach((documentoFirebase) => {
      const turma = documentoFirebase.data();
      const id = documentoFirebase.id;

      let cor = "gray";
      let estadoTexto = turma.estado ? turma.estado.toUpperCase() : "PLANEADA";
      if (turma.estado === "em-curso") {
        cor = "blue";
        estadoTexto = "EM CURSO";
      }
      if (turma.estado === "planeada") cor = "yellow";

      const tr = document.createElement("tr");
      tr.setAttribute("data-estado", turma.estado || "planeada");

      tr.innerHTML = `
                <td><strong>${turma.codigo || ''}</strong></td>
                <td>${turma.designacao || ''}</td>
                <td>${turma.dataInicio || ''}</td>
                <td>${turma.alunos || 0}</td>
                <td><span class="badge ${cor}">${estadoTexto}</span></td>
                <td>
                    <button class="btn-icon btn-editar" 
                        data-id="${id}" 
                        data-codigo="${turma.codigo || ''}" 
                        data-designacao="${turma.designacao || ''}" 
                        data-data="${turma.dataInicio || ''}" 
                        data-alunos="${turma.alunos || 0}" 
                        data-estado="${turma.estado || 'planeada'}" 
                        title="Editar"><i class="ph ph-pencil-simple"></i>
                    </button>
                    <button class="btn-icon btn-apagar" data-id="${id}" title="Apagar"><i class="ph ph-trash"></i></button>
                </td>
            `;
      tbodyTurmas.appendChild(tr);
    });

    const botoesApagar = document.querySelectorAll(".btn-apagar");
    botoesApagar.forEach((botao) => {
      botao.addEventListener("click", async () => {
        const idTurma = botao.getAttribute("data-id");
        if (confirm("Tens a certeza que queres apagar esta turma permanentemente?")) {
          try {
            await deleteDoc(doc(db, "turmas", idTurma));
            showToast("Turma apagada com sucesso!", "success");
            carregarTurmas();
          } catch (error) {
            console.error("Erro:", error);
            showToast("Erro ao apagar.", "error");
          }
        }
      });
    });

    const botoesEditar = document.querySelectorAll(".btn-editar");
    botoesEditar.forEach((botao) => {
      botao.addEventListener("click", () => {
        idTurmaEmEdicao = botao.getAttribute("data-id");
        document.getElementById("new-codigo").value = botao.getAttribute("data-codigo");
        document.getElementById("new-designacao").value = botao.getAttribute("data-designacao");
        document.getElementById("new-data").value = botao.getAttribute("data-data");
        document.getElementById("new-alunos").value = botao.getAttribute("data-alunos");
        document.getElementById("new-estado").value = botao.getAttribute("data-estado");

        modalTitulo.textContent = "Editar Turma";
        modalTurma.style.display = "flex";
      });
    });
  } catch (error) {
    console.error("Erro ao carregar turmas:", error);
  }
}

carregarTurmas();

if (formNovaTurma) {
  formNovaTurma.addEventListener("submit", async (e) => {
    e.preventDefault();

    const codigo = document.getElementById("new-codigo").value;
    const designacao = document.getElementById("new-designacao").value;
    const dataInicio = document.getElementById("new-data").value;
    const alunos = document.getElementById("new-alunos").value;
    const estado = document.getElementById("new-estado").value;

    try {
      if (idTurmaEmEdicao) {
        const turmaRef = doc(db, "turmas", idTurmaEmEdicao);
        await updateDoc(turmaRef, {
          codigo: codigo,
          designacao: designacao,
          dataInicio: dataInicio,
          alunos: alunos,
          estado: estado,
        });
        showToast("Turma atualizada com sucesso!", "success");
      } else {
        await addDoc(collection(db, "turmas"), {
          codigo: codigo,
          designacao: designacao,
          dataInicio: dataInicio,
          alunos: alunos,
          estado: estado,
          dataCriacao: new Date(),
        });
        showToast("Nova turma criada com sucesso!", "success");
      }

      formNovaTurma.reset();
      modalTurma.style.display = "none";
      idTurmaEmEdicao = null;
      carregarTurmas();
    } catch (error) {
      console.error("Erro ao guardar turma: ", error);
      showToast("Ocorreu um erro ao guardar os dados.", "error");
    }
  });
}

const inputPesquisa = document.getElementById('pesquisa-turmas');
if (inputPesquisa) {
    inputPesquisa.addEventListener('keyup', function() {
        const termoPesquisa = this.value.toLowerCase(); 
        const linhasTabela = document.querySelectorAll('#tabela-turmas tbody tr'); 

        linhasTabela.forEach(linha => {
            if (linha.classList.contains('linha-vazia')) return; 
            const textoDaLinha = ReadText(linha);
            linha.style.display = textoDaLinha.includes(termoPesquisa) ? '' : 'none';
        });
    });
}

function ReadText(el) { return el.textContent.toLowerCase(); }