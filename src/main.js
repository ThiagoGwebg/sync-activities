// Sync Activities — main.js
// Bootstrap: monta a UI e escuta o toggle vindo do ícone da extensão.
(function () {
  const EA = window.__EA;
  if (!EA || !EA.ui) return;

  // Lê sesskey/userId do contexto da página, depois monta o painel.
  EA.api.initFromPage().finally(() => EA.ui.mount());

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'EA_TOGGLE') EA.ui.toggle();
  });

  console.log('%cSync Activities v3.0 carregado', 'color:#a855f7;font-weight:600;font-size:12px');
})();
