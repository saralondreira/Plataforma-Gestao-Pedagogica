import { auth, db, storage } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { showToast } from "./toast.js";

const tbodyDocumentos = document.querySelector("#tabela-documentos-formador tbody");

const modalSubmeter = document.getElementById("modal-submeter");
const fecharModalSubmeter = document.getElementById("fechar-modal-submeter");
const formSubmeterDocumento = document.getElementById("form-submeter-documento");
const linkAbrirExcecao = document.getElementById("link-abrir-excecao");

const modalExcecao = document.getElementById("modal-excecao");
const fecharModalExcecao = document.getElementById("fechar-modal-excecao");
const formExcecao = document.getElementById("form-excecao");

let idAvisoAtual = null;

function calcularDias(dataAlvo) {
    const hoje = new Date();
    const prazo = new Date(dataAlvo);
    hoje.setHours(0, 0, 0, 0);
    prazo.setHours(0, 0, 0, 0);
    return Math.ceil((prazo - hoje) / (1000 * 60 * 60 * 24));
}

function abrirModalSubmeter(id) {
    idAvisoAtual = id;
    if (formSubmeterDocumento) formSubmeterDocumento.reset();
    if (modalSubmeter) modalSubmeter.style.display = "flex";
}

function fecharModais() {
    if (modalSubmeter) modalSubmeter.style.display = "none";
    if (modalExcecao) modalExcecao.style.display = "none";
    idAvisoAtual = null;
}

async function carregarDocumentos(nomeFormador) {
    if (!tbodyDocumentos) return;

    try {
        const q = query(collection(db, "entregas"), where("formadorNome", "==", nomeFormador));
        const querySnapshot = await getDocs(q);
        tbodyDocumentos.innerHTML = "";

        if (querySnapshot.empty) {
            tbodyDocumentos.innerHTML = '<tr class="linha-vazia"><td colspan="6" style="text-align: center; padding: 20px;">Não tens documentos atribuídos.</td></tr>';
            return;
        }

        querySnapshot.forEach((documentoFirebase) => {
            const entrega = documentoFirebase.data();
            const id = documentoFirebase.id;

            const diasRestantes = calcularDias(entrega.dataLimite);
            let textoPrazo = "";
            let corPrazo = "";
            let estado = "";
            let badgeHTML = "";

            if (entrega.entregue === true) {
                textoPrazo = "—";
                corPrazo = "#64748b";
                estado = "entregue";
                badgeHTML = `<span class="badge green">Entregue</span>`;
            } else if (diasRestantes < 0) {
                textoPrazo = diasRestantes === -1 ? "Ontem" : `Há ${Math.abs(diasRestantes)} dias`;
                corPrazo = "#dc2626";
                estado = "critico";
                badgeHTML = `<span class="badge red">Em Falta</span>`;
            } else if (diasRestantes === 0) {
                textoPrazo = "Hoje";
                corPrazo = "#ca8a04";
                estado = "hoje";
                badgeHTML = `<span class="badge yellow">Hoje</span>`;
            } else {
                textoPrazo = `Daqui a ${diasRestantes} dias`;
                corPrazo = "#2563eb";
                estado = "pendente";
                badgeHTML = `<span class="badge blue">Pendente</span>`;
            }

            const dataLimObj = new Date(entrega.dataLimite);
            const dataFormatada = dataLimObj.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });

            const acaoHTML = entrega.entregue
                ? ""
                : `<button class="btn-icon btn-submeter" data-id="${id}" title="Submeter Documento"><i class="ph ph-upload-simple"></i></button>`;

            const tr = document.createElement("tr");
            tr.setAttribute("data-estado", estado);
            tr.innerHTML = `
                <td>${entrega.turma || ''}</td>
                <td>${entrega.documento || ''}</td>
                <td style="color: ${corPrazo}; font-weight: 500;">${textoPrazo}</td>
                <td><strong>${dataFormatada}</strong></td>
                <td>${badgeHTML}</td>
                <td>${acaoHTML}</td>
            `;
            tbodyDocumentos.appendChild(tr);
        });

        tbodyDocumentos.querySelectorAll(".btn-submeter").forEach((botao) => {
            botao.addEventListener("click", () => {
                abrirModalSubmeter(botao.getAttribute("data-id"));
            });
        });

    } catch (error) {
        console.error("Erro ao carregar documentos:", error);
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        const perfilDoc = await getDoc(doc(db, "perfis", user.uid));
        const nome = perfilDoc.exists() ? perfilDoc.data().nome : null;

        if (!nome) {
            showToast("Preenche o teu nome no perfil para veres os teus documentos.", "error");
            return;
        }

        carregarDocumentos(nome);
    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
    }
});

if (fecharModalSubmeter) fecharModalSubmeter.addEventListener("click", fecharModais);
if (fecharModalExcecao) fecharModalExcecao.addEventListener("click", fecharModais);

if (linkAbrirExcecao) {
    linkAbrirExcecao.addEventListener("click", (e) => {
        e.preventDefault();
        if (modalSubmeter) modalSubmeter.style.display = "none";
        if (formExcecao) formExcecao.reset();
        if (modalExcecao) modalExcecao.style.display = "flex";
    });
}

if (formSubmeterDocumento) {
    formSubmeterDocumento.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!idAvisoAtual) return;

        const ficheiroInput = document.getElementById("submeter-ficheiro");
        const ficheiro = ficheiroInput.files[0];
        if (!ficheiro) return;

        try {
            const storageRef = ref(storage, `entregas/${idAvisoAtual}/${ficheiro.name}`);
            await uploadBytes(storageRef, ficheiro);
            const ficheiroUrl = await getDownloadURL(storageRef);

            await updateDoc(doc(db, "entregas", idAvisoAtual), {
                entregue: true,
                submissao: {
                    tipo: "ficheiro",
                    ficheiroNome: ficheiro.name,
                    ficheiroUrl: ficheiroUrl,
                    data: serverTimestamp(),
                },
            });

            showToast("Documento submetido com sucesso!", "success");
            fecharModais();

            const perfilDoc = await getDoc(doc(db, "perfis", auth.currentUser.uid));
            if (perfilDoc.exists()) carregarDocumentos(perfilDoc.data().nome);
        } catch (error) {
            console.error("Erro ao submeter documento:", error);
            showToast("Ocorreu um erro ao submeter o documento.", "error");
        }
    });
}

if (formExcecao) {
    formExcecao.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!idAvisoAtual) return;

        const nota = document.getElementById("excecao-nota").value.trim();

        try {
            await updateDoc(doc(db, "entregas", idAvisoAtual), {
                entregue: true,
                submissao: {
                    tipo: "excecao",
                    nota: nota,
                    data: serverTimestamp(),
                },
            });

            showToast("Marcado como enviado (exceção).", "success");
            fecharModais();

            const perfilDoc = await getDoc(doc(db, "perfis", auth.currentUser.uid));
            if (perfilDoc.exists()) carregarDocumentos(perfilDoc.data().nome);
        } catch (error) {
            console.error("Erro ao guardar exceção:", error);
            showToast("Ocorreu um erro ao guardar.", "error");
        }
    });
}
