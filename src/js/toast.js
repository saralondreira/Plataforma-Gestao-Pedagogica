let toastEl = null;

function garantirToast() {
    if (!toastEl) {
        toastEl = document.createElement('p');
        toastEl.className = 'toast';
        document.body.appendChild(toastEl);
    }
    return toastEl;
}

export function showToast(message, type = 'success') {
    const el = garantirToast();
    el.textContent = message;

    el.classList.remove('toast-success', 'toast-error');
    el.classList.add(type === 'success' ? 'toast-success' : 'toast-error');
    el.classList.add('show');

    clearTimeout(el._timeoutId);
    el._timeoutId = setTimeout(() => {
        el.classList.remove('show');
    }, 3000);
}