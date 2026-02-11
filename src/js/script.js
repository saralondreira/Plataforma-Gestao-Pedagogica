document.addEventListener('DOMContentLoaded', function () {

    const camposFormulario = document.querySelectorAll('input');
    camposFormulario.forEach(campo => {
        campo.addEventListener('invalid', function (e) {
            if (e.target.validity.valueMissing) {
                e.target.setCustomValidity('Por favor, preencha este campo.');
            }
            else if (e.target.validity.typeMismatch) {
                e.target.setCustomValidity('O email precisa de incluir um "@".');
            }
            else if (e.target.validity.patternMismatch) {
                e.target.setCustomValidity('Por favor, insira um domínio válido (ex: .pt).');
            }
        });

        campo.addEventListener('input', function (e) {
            e.target.setCustomValidity('');
        });
    });

    function calcularDias(dataAlvo) {
        const hoje = new Date();
        const prazo = new Date(dataAlvo);
        hoje.setHours(0, 0, 0, 0);
        prazo.setHours(0, 0, 0, 0);
        const diferencaTempo = prazo - hoje;
        return Math.ceil(diferencaTempo / (1000 * 60 * 60 * 24));
    }

    function atualizarPrazos() {
        const elementos = document.querySelectorAll('.calculo-prazo');
        elementos.forEach(el => {
            const dataPrazo = el.getAttribute('data-prazo');
            if (!dataPrazo) return;

            const dias = calcularDias(dataPrazo);

            if (dias < 0) {
                el.innerText = dias === -1 ? "Ontem" : `Há ${Math.abs(dias)} dias`;
                el.style.color = "#dc2626";
            }
            else if (dias === 0) {
                el.innerText = "Hoje";
                el.style.color = "#ca8a04";
            }
            else if (dias === 1) {
                el.innerText = "Amanhã";
                el.style.color = "#2563eb";
            }
            else {
                el.innerText = `Daqui a ${dias} dias`;
                el.style.color = "#64748b";
            }
        });
    }

    function configurarInterface() {
        const filtro = document.getElementById('filtro-prazos');
        const linhas = document.querySelectorAll('.status-table tbody tr');
        let contadores = { critico: 0, hoje: 0, pendente: 0, todos: 0 };

        linhas.forEach(linha => {
            const elementoPrazo = linha.querySelector('.calculo-prazo');
            if (!elementoPrazo) return;

            const data = elementoPrazo.getAttribute('data-prazo');
            const dias = calcularDias(data);
            contadores.todos++;

            if (dias < 0) {
                contadores.critico++;
                linha.setAttribute('data-estado', 'critico');
            } else if (dias === 0) {
                contadores.hoje++;
                linha.setAttribute('data-estado', 'hoje');
            } else {
                contadores.pendente++;
                linha.setAttribute('data-estado', 'pendente');
            }

            const botoes = linha.querySelectorAll('.btn-icon');
            botoes.forEach(btn => {
                btn.addEventListener('click', function () {
                    const acao = this.getAttribute('title');
                    const colunas = linha.querySelectorAll('td');
                    const nome = colunas[0].innerText.replace(/^[A-Z]{2}\s/, '').trim();
                    const doc = colunas[2].innerText;

                    if (acao === "Enviar Mensagem") {
                        window.location.href = `mailto:exemplo@instituicao.pt?subject=Pendente: ${doc}&body=Olá ${nome}, falta o documento ${doc}.`;
                    } else {
                        alert(`${acao} para ${nome}: ${doc}`);
                    }
                });
            });
        });

        if (filtro && filtro.options.length >= 4) {
            filtro.options[0].text = `${contadores.critico} Críticos`;
            filtro.options[1].text = `${contadores.hoje} Hoje`;
            filtro.options[2].text = `${contadores.pendente} Pendentes`;
            filtro.options[3].text = `Todos (${contadores.todos})`;

            filtro.addEventListener('change', function () {
                this.className = `badge ${this.value === 'critico' ? 'red' : this.value === 'hoje' ? 'yellow' : this.value === 'pendente' ? 'blue' : 'gray'}`;
                linhas.forEach(l => {
                    l.style.display = (this.value === 'todos' || l.getAttribute('data-estado') === this.value) ? '' : 'none';
                });
            });
        }
    }

    function ajustarCamposPorPerfil(cargoUtilizador) {
        const camposDinamicos = document.querySelectorAll('.role-dependent');
        camposDinamicos.forEach(campo => {
            const atributoRole = campo.getAttribute('data-role');
            if (!atributoRole) return;

            const papeisPermitidos = atributoRole.split(' ');
            campo.style.display = papeisPermitidos.includes(cargoUtilizador) ? 'block' : 'none';
        });
    }

    atualizarPrazos();
    configurarInterface();

function aplicarNomeGuardado() {
    const nomeGuardado = localStorage.getItem('utilizadorNome');
    if (nomeGuardado) {
        const elementosNome = document.querySelectorAll('.user-name strong');
        elementosNome.forEach(el => el.innerText = nomeGuardado);
        
        const inputNome = document.getElementById('nome');
        if (inputNome && window.location.pathname.includes('perfil.html')) {
            inputNome.value = nomeGuardado;
        }
    }
}

const formPerfil = document.getElementById('form-perfil');
if (formPerfil) {
    formPerfil.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const novoNome = document.getElementById('nome').value;
        
        if (novoNome.trim() !== "") {
            localStorage.setItem('utilizadorNome', novoNome);
            
            aplicarNomeGuardado();
            
            alert('Perfil atualizado com sucesso!');
        }
    });
}

aplicarNomeGuardado();

function gerarIniciais(nome) {
    if (!nome) return "??";
    const partes = nome.trim().split(" ");
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

function aplicarDadosUtilizador() {
    const nomeGuardado = localStorage.getItem('utilizadorNome');
    
    if (nomeGuardado) {
        const elementosNome = document.querySelectorAll('.user-name strong');
        elementosNome.forEach(el => el.innerText = nomeGuardado);

        const iniciais = gerarIniciais(nomeGuardado);
        const avatares = document.querySelectorAll('.avatar-circle');
        avatares.forEach(av => {
            if (!av.closest('td')) {
                av.innerText = iniciais;
            }
        });

        const inputNome = document.getElementById('nome');
        if (inputNome) inputNome.value = nomeGuardado;
    }
}

const formPerfil = document.getElementById('form-perfil');
if (formPerfil) {
    formPerfil.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const novoNome = document.getElementById('nome').value;
        if (novoNome.trim() !== "") {
            localStorage.setItem('utilizadorNome', novoNome);
            aplicarDadosUtilizador();
            alert('Perfil e iniciais atualizados com sucesso!');
        }
    });
}
aplicarDadosUtilizador();


}); 