// Sync Activities Web — main.js
// Substitui o main.js da extensão: sem chrome.runtime, monta o painel direto.
(function () {
  const EA = (window.__EA = window.__EA || {});
  const api = EA.api;
  const ui  = EA.ui;

  // Esconde o loading screen e mostra o painel
  const loadingEl = document.getElementById('loading-screen');
  if (loadingEl) loadingEl.style.display = 'none';

  // Monta o painel
  api.ensureAuth().then(() => {
    ui.mount();
  }).catch((e) => {
    console.error('Erro ao iniciar:', e);
    if (loadingEl) {
      loadingEl.innerHTML = '<p style="color:#EF4444">Erro ao conectar: ' + e.message + '</p>';
      loadingEl.style.display = 'flex';
    }
  });
})();
