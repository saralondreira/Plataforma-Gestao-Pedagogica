import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from "./toast.js";

const tbodyDashboard = document.querySelector('#tabela-dashboard tbody');
const filtroPrazos = document.getElementById('filtro-prazos');
const btnRegistarFalta = document.getElementById("btn-registar-falta");
const btnNovoAviso = document.getElementById("btn-novo-aviso");
const modalAviso = document.getElementById("modal-aviso");
const fecharModalAviso = document.getElementById("fechar-modal-aviso");
const formNovoAviso = document.getElementById("form-novo-aviso");
const modalTituloAviso = document.querySelector("#modal-aviso h3");

let idAvisoEmEdicao = null;

function calcularDias(dataAlvo) {
    const hoje = new Date();
    const prazo = new Date(dataAlvo);
    hoje.setHours(0, 0, 0, 0);
    prazo.setHours(0, 0, 0, 0);
    return Math.ceil((prazo - hoje) / (1000 * 60 * 60 * 24));
}

function abrirModalAviso() {
    idAvisoEmEdicao = null;
    if (formNovoAviso) formNovoAviso.reset();
    if (modalTituloAviso) modalTituloAviso.textContent = "Solicitar Documento (Aviso)";
    if (modalAviso) modalAviso.style.display = "flex";
}

function fecharModal() {
    if (modalAviso) modalAviso.style.display = "none";
    idAvisoEmEdicao = null;
}

async function carregarDashboard() {
    if (!tbodyDashboard) return;

    try {
        const q = query(collection(db, "entregas"), orderBy("dataLimite", "asc"));
        const querySnapshot = await getDocs(q);
        tbodyDashboard.innerHTML = '';

        let contadores = { critico: 0, hoje: 0, pendente: 0, todos: 0 };

        if (querySnapshot.empty) {
            tbodyDashboard.innerHTML = '<tr class="linha-vazia"><td colspan="7" style="text-align: center; padding: 20px;">Nenhuma entrega registada.</td></tr>';
            atualizarContadoresFiltro(contadores);
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
                contadores.critico++;
            } else if (diasRestantes === 0) {
                textoPrazo = "Hoje";
                corPrazo = "#ca8a04";
                estado = "hoje";
                badgeHTML = `<span class="badge yellow">Hoje</span>`;
                contadores.hoje++;
            } else {
                textoPrazo = `Daqui a ${diasRestantes} dias`;
                corPrazo = "#2563eb";
                estado = "pendente";
                badgeHTML = `<span class="badge blue">Pendente</span>`;
                contadores.pendente++;
            }

            contadores.todos++;

            const dataLimObj = new Date(entrega.dataLimite);
            const dataFormatada = dataLimObj.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });

            const tr = document.createElement('tr');
            tr.setAttribute('data-estado', estado);

            const iniciais = entrega.formadorNome.substring(0, 2).toUpperCase();

            const btnEntregue = entrega.entregue
                ? ''
                : `<button class="btn-icon btn-entregue" data-id="${id}" title="Marcar como Entregue"><i class="ph ph-check-circle"></i></button>`;

            let indicadorSubmissao = '';
            if (entrega.submissao) {
                if (entrega.submissao.tipo === 'ficheiro') {
                    indicadorSubmissao = `<a href="${entrega.submissao.ficheiroUrl}" target="_blank" title="Ficheiro submetido pelo formador: ${entrega.submissao.ficheiroNome || ''}"><i class="ph ph-paperclip"></i></a>`;
                } else if (entrega.submissao.tipo === 'excecao') {
                    indicadorSubmissao = `<i class="ph ph-warning-circle" style="color: #ca8a04;" title="Exceção (sem ficheiro): ${entrega.submissao.nota || ''}"></i>`;
                } else if (entrega.submissao.tipo === 'coordenacao') {
                    indicadorSubmissao = `<i class="ph ph-user-check" title="Confirmado pela coordenação"></i>`;
                }
            }

            tr.innerHTML = `
                <td><div class="avatar-circle">${iniciais}</div> ${entrega.formadorNome}</td>
                <td>${entrega.turma}</td>
                <td>${entrega.documento} ${indicadorSubmissao}</td>
                <td style="color: ${corPrazo}; font-weight: 500;">${textoPrazo}</td>
                <td><strong>${dataFormatada}</strong></td>
                <td>${badgeHTML}</td>
                <td>
                    ${btnEntregue}
                    <button class="btn-icon btn-editar-aviso"
                        data-id="${id}"
                        data-formador="${entrega.formadorNome}"
                        data-turma="${entrega.turma}"
                        data-documento="${entrega.documento}"
                        data-prazo="${entrega.dataLimite}"
                        title="Editar"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn-icon btn-apagar-aviso" data-id="${id}" title="Apagar"><i class="ph ph-trash"></i></button>
                </td>
            `;
            tbodyDashboard.appendChild(tr);
        });

        tbodyDashboard.querySelectorAll(".btn-entregue").forEach((botao) => {
            botao.addEventListener("click", async () => {
                const id = botao.getAttribute("data-id");
                try {
                    await updateDoc(doc(db, "entregas", id), {
                        entregue: true,
                        submissao: { tipo: "coordenacao", data: new Date() },
                    });
                    showToast("Marcado como entregue!", "success");
                    carregarDashboard();
                } catch (error) {
                    console.error("Erro:", error);
                    showToast("Erro ao atualizar.", "error");
                }
            });
        });

        tbodyDashboard.querySelectorAll(".btn-apagar-aviso").forEach((botao) => {
            botao.addEventListener("click", async () => {
                const id = botao.getAttribute("data-id");
                if (confirm("Tens a certeza que queres apagar este aviso?")) {
                    try {
                        await deleteDoc(doc(db, "entregas", id));
                        showToast("Aviso apagado com sucesso!", "success");
                        carregarDashboard();
                    } catch (error) {
                        console.error("Erro:", error);
                        showToast("Erro ao apagar.", "error");
                    }
                }
            });
        });

        tbodyDashboard.querySelectorAll(".btn-editar-aviso").forEach((botao) => {
            botao.addEventListener("click", () => {
                idAvisoEmEdicao = botao.getAttribute("data-id");
                document.getElementById("aviso-formador").value = botao.getAttribute("data-formador");
                document.getElementById("aviso-turma").value = botao.getAttribute("data-turma");
                document.getElementById("aviso-documento").value = botao.getAttribute("data-documento");
                document.getElementById("aviso-prazo").value = botao.getAttribute("data-prazo");

                if (modalTituloAviso) modalTituloAviso.textContent = "Editar Aviso";
                if (modalAviso) modalAviso.style.display = "flex";
            });
        });

        atualizarContadoresFiltro(contadores);

    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
    }
}

function atualizarContadoresFiltro(contadores) {
    if (filtroPrazos && filtroPrazos.options.length >= 4) {
        filtroPrazos.options[0].text = `${contadores.critico} CRÍTICOS`;
        filtroPrazos.options[1].text = `${contadores.hoje} HOJE`;
        filtroPrazos.options[2].text = `${contadores.pendente} PENDENTES`;
        filtroPrazos.options[3].text = `TODOS (${contadores.todos})`;
    }
}

if (filtroPrazos) {
    filtroPrazos.addEventListener('change', function () {
        const linhas = document.querySelectorAll('#tabela-dashboard tbody tr');
        const cores = { critico: 'red', hoje: 'yellow', pendente: 'blue', todos: 'gray' };
        this.className = `badge ${cores[this.value] || 'gray'}`;

        linhas.forEach(l => {
            if (l.classList.contains('linha-vazia')) return;
            l.style.display = (this.value === 'todos' || l.getAttribute('data-estado') === this.value) ? '' : 'none';
        });
    });
}

if (btnRegistarFalta) btnRegistarFalta.addEventListener("click", abrirModalAviso);
if (btnNovoAviso) btnNovoAviso.addEventListener("click", abrirModalAviso);

if (fecharModalAviso) fecharModalAviso.addEventListener("click", fecharModal);

if (formNovoAviso) {
    formNovoAviso.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formador = document.getElementById('aviso-formador').value;
        const turma = document.getElementById('aviso-turma').value;
        const documento = document.getElementById('aviso-documento').value;
        const prazo = document.getElementById('aviso-prazo').value;

        try {
            if (idAvisoEmEdicao) {
                const avisoRef = doc(db, "entregas", idAvisoEmEdicao);
                await updateDoc(avisoRef, {
                    formadorNome: formador,
                    turma: turma,
                    documento: documento,
                    dataLimite: prazo,
                });
                showToast("Aviso atualizado com sucesso!", "success");
            } else {
                await addDoc(collection(db, "entregas"), {
                    formadorNome: formador,
                    turma: turma,
                    documento: documento,
                    dataLimite: prazo,
                    entregue: false,
                    dataCriacao: new Date()
                });
                showToast("Falta registada com sucesso!", "success");
            }

            formNovoAviso.reset();
            fecharModal();
            carregarDashboard();

        } catch (error) {
            console.error("Erro ao guardar aviso:", error);
            showToast("Ocorreu um erro ao guardar.", "error");
        }
    });
}

carregarDashboard();