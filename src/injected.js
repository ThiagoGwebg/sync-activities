// Sync Activities — injected.js
// Roda no CONTEXTO DA PÁGINA (MAIN world) para ler window.M.cfg,
// que o content script (mundo isolado) não consegue acessar.
(function () {
  function send() {
    try {
      var cfg = (window.M && window.M.cfg) || {};
      window.postMessage({
        __ea_page: true,
        sesskey: cfg.sesskey || '',
        userId: cfg.userId || cfg.userid || 0,
        wwwroot: cfg.wwwroot || '',
      }, '*');
    } catch (e) {
      window.postMessage({ __ea_page: true, error: String(e) }, '*');
    }
  }
  send();
})();
