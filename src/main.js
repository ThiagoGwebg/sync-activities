// Sync Activities — main.js
// Bootstrap: verifica login, monta UI ou tela de login.
(function () {
  const EA = window.__EA;
  if (!EA || !EA.ui) return;

  async function init() {
    // Tenta pegar sesskey da página atual primeiro
    await EA.api.initFromPage();

    // Se já temos sesskey, usuário está logado — monta direto
    if (EA.api.sesskey) {
      EA.ui.mount();
      return;
    }

    // Verifica se está logado pelo portal
    const logado = await EA.api.isLoggedIn();
    if (logado) {
      EA.ui.mount();
    } else {
      // Mostra tela de login
      EA.ui.mountLogin();
    }
  }

  init().catch(() => EA.ui.mount());

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'EA_TOGGLE') EA.ui.toggle();
    if (msg && msg.type === 'EA_GET_CFG') {
      sendResponse({ sesskey: EA.api.sesskey, userId: EA.api.userId });
    }
  });

  console.log('%cSync Activities v4.0 carregado', 'color:#3B82F6;font-weight:600;font-size:12px');
})();
