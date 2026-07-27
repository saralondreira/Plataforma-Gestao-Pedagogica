import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from "./toast.js";

const formPerfil = document.getElementById('form-perfil');
const nomeInput = document.getElementById('nome');
const contactoInput = document.getElementById('contacto');
const emailInput = document.getElementById('email');
const linkedinInput = document.getElementById('linkedin');
const competenciasTextarea = document.getElementById('competencias');
const roleSelect = document.getElementById('role');

let utilizadorAtualUid = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        utilizadorAtualUid = user.uid;
        
        if (emailInput) {
            emailInput.value = user.email;
        }

        try {
            const perfilRef = doc(db, "perfis", user.uid);
            const perfilDoc = await getDoc(perfilRef);

            if (perfilDoc.exists()) {
                const dados = perfilDoc.data();
                if (nomeInput) nomeInput.value = dados.nome || "";
                if (contactoInput) contactoInput.value = dados.contacto || "";
                if (linkedinInput) linkedinInput.value = dados.linkedin || "";
                if (competenciasTextarea) competenciasTextarea.value = dados.competencias || "";
                if (roleSelect) roleSelect.value = dados.role || "coordenador";

                atualizarNomeCabecalho(dados.nome);
            }
        } catch (error) {
            console.error("Erro ao carregar dados do perfil:", error);
        }
    } else {
    showToast("Sessão expirada. A redirecionar...", "error");
    setTimeout(() => {
        window.location.href = "../login/login.html";
    }, 1500);
}
});

if (formPerfil) {
    formPerfil.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!utilizadorAtualUid) return;

        const nome = nomeInput.value.trim();
        const contacto = contactoInput.value.trim();
        const linkedin = linkedinInput.value.trim();
        const competencias = competenciasTextarea.value.trim();
        const role = roleSelect ? roleSelect.value : "coordenador";

        try {
         await setDoc(doc(db, "perfis", utilizadorAtualUid), {
                nome: nome,
                contacto: contacto,
                linkedin: linkedin,
                competencias: competencias,
                role: role,
                ultimaAtualizacao: new Date()
            }, { merge: true });

            showToast("Perfil atualizado com sucesso!", "success");
            
            atualizarNomeCabecalho(nome);

        } catch (error) {
            console.error("Erro ao guardar perfil:", error);
            showToast("Ocorreu um erro ao guardar as alterações.", "error");
        }
    });
}

function atualizarNomeCabecalho(nome) {
    if (!nome) return;
    document.querySelectorAll('.user-name strong').forEach(el => {
        el.innerText = nome;
    });
    
    const partes = nome.split(/\s+/);
    if (partes.length >= 2) {
        const iniciais = (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
        document.querySelectorAll('.avatar-circle').forEach(av => {
            if (!av.closest('td')) av.innerText = iniciais;
        });
    }
}