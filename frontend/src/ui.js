let activeDialog = null;

export function confirmDialog({ title, message, summary = '', confirmLabel = 'Xác nhận', cancelLabel = 'Quay lại', tone = 'danger' }) {
  activeDialog?.close();
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    activeDialog = dialog;
    dialog.className = 'app-dialog';
    dialog.innerHTML = `<form method="dialog" class="dialog-card"><div class="dialog-icon ${tone}" aria-hidden="true">!</div><div><p class="eyebrow">XÁC NHẬN THAO TÁC</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${summary ? `<div class="dialog-summary">${escapeHtml(summary)}</div>` : ''}</div><div class="dialog-actions"><button class="outline-button" value="cancel">${escapeHtml(cancelLabel)}</button><button class="primary-button ${tone === 'danger' ? 'danger-button' : ''}" value="confirm">${escapeHtml(confirmLabel)}</button></div></form>`;
    const finish = value => { activeDialog = null; dialog.remove(); previousFocus?.focus?.(); resolve(value); };
    dialog.addEventListener('close', () => finish(dialog.returnValue === 'confirm'), { once: true });
    dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close('cancel'); });
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector('[value="cancel"]')?.focus();
  });
}

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
