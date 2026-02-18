document.addEventListener('DOMContentLoaded', function () {
    inicializarValidacaoFormularios();
    atualizarPrazos();
    configurarInterfaceTabela();
    atualizarInterfaceUtilizador();
    configurarFormularioPerfil();
    configurarModalTurma();

    /* =============================================================
       FILTROS REUTILIZÁVEIS (Lógica Unificada)
       ============================================================= */
    
    // 1. Configurar filtro das TURMAS
    inicializarFiltro('filtro-turmas', 'tabela-turmas', {
        'em-curso': 'blue',
        'planeada': 'yellow',
        'concluida': 'green',
        'arquivada': 'gray',
        'cancelada': 'red',
        'todas': 'gray'
    });

    // 2. Configurar filtro dos FORMADORES
    inicializarFiltro('filtro-formadores', 'tabela-formadores', {
        'ativo': 'green',
        'inativo': 'red',
        'todos': 'gray'
    });

    /**
     * Função genérica para criar filtros em tabelas
     * @param {string} idSelect - O ID do <select> HTML
     * @param {string} idTabela - O ID da <table> HTML
     * @param {object} mapaCores - Objeto com a correspondência valor -> cor
     */
    function inicializarFiltro(idSelect, idTabela, mapaCores) {
        const filtro = document.getElementById(idSelect);
        // Tenta encontrar a tabela, se não encontrar pelo ID, tenta pela classe genérica (fallback)
        const tabela = document.getElementById(idTabela);
        
        if (!filtro || !tabela) return;

        const linhas = tabela.querySelectorAll('tbody tr');

        // 1. Contagem dinâmica
        let contadores = { todas: 0, todos: 0 }; // Prepara contadores genéricos
        
        // Inicializa os contadores a 0 para todas as opções do select
        Array.from(filtro.options).forEach(opt => {
             contadores[opt.value] = 0;
        });

        // Conta as linhas reais
        linhas.forEach(linha => {
            const estado = linha.getAttribute('data-estado');
            if (contadores.hasOwnProperty(estado)) {
                contadores[estado]++;
            }
            // Incrementa o contador geral (seja "todas" ou "todos")
            if (contadores.hasOwnProperty('todas')) contadores.todas++;
            if (contadores.hasOwnProperty('todos')) contadores.todos++;
        });

        // 2. Atualizar os textos do Select com os números
        Array.from(filtro.options).forEach(opt => {
            const total = contadores[opt.value] || 0;
            // Limpa qualquer número antigo que esteja no texto e adiciona o novo
            const textoBase = opt.text.split('(')[0].trim();
            opt.text = `${textoBase} (${total})`;
        });

        // 3. Lógica de Filtragem e Cores
        filtro.addEventListener('change', function () {
            const valor = this.value;
            
            // Atualiza a cor do badge do select
            this.className = `badge ${mapaCores[valor] || 'gray'}`;

            // Mostra ou esconde linhas
            linhas.forEach(l => {
                const estadoLinha = l.getAttribute('data-estado');
                // Verifica se é "todas" ou "todos" para mostrar tudo
                l.style.display = (valor === 'todas' || valor === 'todos' || estadoLinha === valor) ? '' : 'none';
            });
        });
        
        // Disparar evento para definir cor inicial correta
        filtro.dispatchEvent(new Event('change'));
    }

    /* =============================================================
       OUTRAS FUNÇÕES (Mantidas do teu código original)
       ============================================================= */

    function atualizarInterfaceUtilizador() {
        const nomeGuardado = localStorage.getItem('utilizadorNome');
        if (!nomeGuardado) return;

        document.querySelectorAll('.user-name strong').forEach(el => {
            el.innerText = nomeGuardado;
        });

        const iniciais = gerarIniciais(nomeGuardado);
        document.querySelectorAll('.avatar-circle').forEach(av => {
            if (!av.closest('td')) av.innerText = iniciais;
        });

        const inputNome = document.getElementById('nome');
        if (inputNome) inputNome.value = nomeGuardado;
    }

    function configurarFormularioPerfil() {
        const formPerfil = document.getElementById('form-perfil');
        if (!formPerfil) return;

        formPerfil.addEventListener('submit', function (e) {
            e.preventDefault();
            const novoNome = document.getElementById('nome').value.trim();

            if (novoNome) {
                localStorage.setItem('utilizadorNome', novoNome);
                atualizarInterfaceUtilizador();
                alert('Perfil atualizado com sucesso!');
            } else {
                alert('Por favor, insira um nome válido.');
            }
        });
    }

    const formLogin = document.getElementById('form-login');
    if (formLogin) {
        formLogin.addEventListener('submit', function (e) {
            e.preventDefault();
            window.location.href = "dashboardCoord.html";
        });
    }

    function gerarIniciais(nome) {
        const partes = nome.trim().split(/\s+/);
        if (partes.length === 0) return "??";
        if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
        return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
    }

    function calcularDias(dataAlvo) {
        const hoje = new Date();
        const prazo = new Date(dataAlvo);
        hoje.setHours(0, 0, 0, 0);
        prazo.setHours(0, 0, 0, 0);
        return Math.ceil((prazo - hoje) / (1000 * 60 * 60 * 24));
    }

    function atualizarPrazos() {
        document.querySelectorAll('.calculo-prazo').forEach(el => {
            const data = el.getAttribute('data-prazo');
            if (!data) return;

            const dias = calcularDias(data);
            const configuracao =
                dias < 0 ? { texto: dias === -1 ? "Ontem" : `Há ${Math.abs(dias)} dias`, cor: "#dc2626" } :
                    dias === 0 ? { texto: "Hoje", cor: "#ca8a04" } :
                        dias === 1 ? { texto: "Amanhã", cor: "#2563eb" } :
                            { texto: `Daqui a ${dias} dias`, cor: "#64748b" };

            el.innerText = configuracao.texto;
            el.style.color = configuracao.cor;
        });
    }

    function configurarInterfaceTabela() {
        const filtro = document.getElementById('filtro-prazos');
        const linhas = document.querySelectorAll('.status-table tbody tr');
        let contadores = { critico: 0, hoje: 0, pendente: 0, todos: 0 };

        linhas.forEach(linha => {
            const elPrazo = linha.querySelector('.calculo-prazo');
            const badgeEstado = linha.querySelector('.badge');
            if (!elPrazo || !badgeEstado) return;

            if (badgeEstado.innerText.trim().toLowerCase() === "entregue") {
                elPrazo.innerText = "—";
                linha.setAttribute('data-estado', 'entregue');
                return;
            }

            const dias = calcularDias(elPrazo.getAttribute('data-prazo'));

            if (dias < 0) {
                badgeEstado.innerText = "Em Falta";
                badgeEstado.className = "badge red";
                const estado = 'critico';
                contadores[estado]++;
                linha.setAttribute('data-estado', estado);
            } else if (dias === 0) {
                const estado = 'hoje';
                contadores[estado]++;
                linha.setAttribute('data-estado', estado);
            } else {
                const estado = 'pendente';
                contadores[estado]++;
                linha.setAttribute('data-estado', estado);
            }

            contadores.todos++;

            linha.querySelectorAll('.btn-icon').forEach(btn => {
                btn.onclick = () => processarAcao(btn, linha);
            });
        });

        if (filtro) atualizarDropdownFiltro(filtro, contadores, linhas);
    }

    function processarAcao(btn, linha) {
        const acao = btn.getAttribute('title');
        const colunas = linha.querySelectorAll('td');
        const nome = colunas[0].innerText.replace(/^[A-Z]{2}\s/, '').trim();
        const doc = colunas[2] ? colunas[2].innerText : 'Item';

        if (acao === "Enviar Mensagem" || acao === "Enviar Alerta") {
            window.location.href = `mailto:exemplo@instituicao.pt?subject=Pendente: ${doc}&body=Olá ${nome}, falta o documento ${doc}.`;
        }
        else if (acao === "Consultar Documentos") {
            alert('A verificação ainda está em desenvolvimento.');
        }
        else {
            alert(`${acao} para ${nome}`);
        }
    }

    function atualizarDropdownFiltro(filtro, contadores, linhas) {
        if (filtro.options.length >= 4) {
            filtro.options[0].text = `${contadores.critico} Críticos`;
            filtro.options[1].text = `${contadores.hoje} Hoje`;
            filtro.options[2].text = `${contadores.pendente} Pendentes`;
            filtro.options[3].text = `Todos (${contadores.todos})`;
        }

        filtro.addEventListener('change', function () {
            const cores = { critico: 'red', hoje: 'yellow', pendente: 'blue', todos: 'gray' };
            this.className = `badge ${cores[this.value]}`;
            linhas.forEach(l => l.style.display = (this.value === 'todos' || l.getAttribute('data-estado') === this.value) ? '' : 'none');
        });
    }

    function inicializarValidacaoFormularios() {
        document.querySelectorAll('input').forEach(campo => {
            campo.addEventListener('invalid', (e) => {
                e.target.setCustomValidity('');
                if (e.target.validity.valueMissing) e.target.setCustomValidity('Por favor, preencha este campo.');
                else if (e.target.validity.typeMismatch) e.target.setCustomValidity('O email precisa de incluir um "@".');
                else if (e.target.validity.patternMismatch) e.target.setCustomValidity('Por favor, insira um domínio válido (ex: .pt).');
            });
            campo.addEventListener('input', (e) => e.target.setCustomValidity(''));
        });
    }

    function configurarModalTurma() {
        const elementos = {
            modal: document.getElementById('modal-turma'),
            btnAbrir: document.getElementById('btn-nova-turma'),
            btnFechar: document.getElementById('fechar-modal')
        };
        if (!elementos.modal || !elementos.btnAbrir || !elementos.btnFechar) return;

        const alternarModal = (mostrar) => {
            elementos.modal.style.display = mostrar ? 'flex' : 'none';
        };

        elementos.btnAbrir.addEventListener('click', () => alternarModal(true));
        elementos.btnFechar.addEventListener('click', () => alternarModal(false));
        window.addEventListener('click', (event) => {
            if (event.target === elementos.modal) alternarModal(false);
        });
        window.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && elementos.modal.style.display === 'flex') {
                alternarModal(false);
            }
        });
    }
});