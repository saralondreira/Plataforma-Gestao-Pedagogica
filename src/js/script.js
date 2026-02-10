document.addEventListener('DOMContentLoaded', function() {

    // ======================================================
    //              GESTÃO DE PRAZOS E DATAS
    // ======================================================

    // Função auxiliar para calcular a diferença
    function calcularDias(dataAlvo) {
        const hoje = new Date();
        const prazo = new Date(dataAlvo);

        // "Zerar" as horas para comparar apenas as datas (dia/mês/ano)
        hoje.setHours(0, 0, 0, 0);
        prazo.setHours(0, 0, 0, 0);

        // Calcular a diferença em milissegundos
        const diferencaTempo = prazo - hoje;
        // Converter para dias e arredondar
        const diferencaDias = Math.ceil(diferencaTempo / (1000 * 60 * 60 * 24));

        return diferencaDias;
    }

    // Função principal que atualiza o visual
    function atualizarPrazos() {
        const elementos = document.querySelectorAll('.calculo-prazo');

        elementos.forEach(el => {
            const dataPrazo = el.getAttribute('data-prazo');
            
            if (!dataPrazo) return; // Se não tiver data, salta este elemento

            const dias = calcularDias(dataPrazo);

            if (dias === -1) {
                el.innerText = "Ontem";
                el.style.color = "#dc2626"; // Vermelho
            } 
            else if (dias === 0) {
                el.innerText = "Hoje";
                el.style.color = "#d97706"; // Laranja
            } 
            else if (dias === 1) {
                el.innerText = "Amanhã";
                el.style.color = "#2563eb"; // Azul
            } 
            else if (dias < -1) {
                el.innerText = `Há ${Math.abs(dias)} dias`;
                el.style.color = "#dc2626"; // Vermelho
            } 
            else if (dias > 1) {
                el.innerText = `Daqui a ${dias} dias`;
                el.style.color = "#64748b"; // Cinzento
            }
        });
    }
    atualizarPrazos();


    // ======================================================
    // PARTE 2: VALIDAÇÃO DE FORMULÁRIOS (EMAIL E REQUIRED)
    // ======================================================

    const camposFormulario = document.querySelectorAll('input');

    camposFormulario.forEach(campo => {
        
        campo.addEventListener('invalid', function(e) {
            // 1. Campo Vazio
            if (e.target.validity.valueMissing) {
                e.target.setCustomValidity('Por favor, preencha este campo.');
            } 
            // 2. Falta o @ (erro de tipo)
            else if (e.target.validity.typeMismatch) {
                e.target.setCustomValidity('O email precisa de incluir um "@".');
            }
            // 3. Erro de Padrão (Regex) - caso tenhas adicionado o pattern no HTML
            else if (e.target.validity.patternMismatch) {
                e.target.setCustomValidity('Por favor, insira um domínio válido (ex: .pt).');
            }
        });

        // Limpar o erro quando a pessoa começa a escrever
        campo.addEventListener('input', function(e) {
            e.target.setCustomValidity('');
        });
    });

});