// Comportamentos partilhados por todas as páginas:
//  - mensagens de validação de formulários em português;
// (O resto do protótipo original — dados fictícios, alertas, prazos — foi removido.)
document.addEventListener('DOMContentLoaded', function () {

    inicializarValidacaoFormularios();

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
});
