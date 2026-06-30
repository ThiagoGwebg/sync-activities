// Sync Activities — store.js
// Wrapper sobre chrome.storage.local: config persistente + histórico.
(function () {
  const EA = (window.__EA = window.__EA || {});

  const DEFAULTS = {
    delayMs: 700,            // espera entre atividades
    sectionDelayMs: 200,     // espera entre seções
    retries: 2,              // tentativas por atividade
    types: {                 // quais tipos automatizar
      scorm: true,
      h5pactivity: true,
      url: true,
      page: true,
      resource: true,
      folder: true,
      book: true,
      lesson: true,
      glossary: true,
      imscp: true,
      subsection: true,
      generic: true,
    },
    registros: {             // usa IA para ler material e gerar resposta
      enabled: true,
      assign: true,
      forum: true,
      workshop: false,
    },
    groqKey: '',             // chave API Groq (llama-3.3-70b-versatile)
    groqModel: 'llama-3.3-70b-versatile',
    theme: 'sync',           // sync (azul/ciano) | cyan | verde
    safeMode: true,          // pula atividades já concluídas
    autoCollapse: false,     // inicia o painel minimizado
    runModes: {              // modos de execução ativos
      atividades: true,
      registros: false,
      quiz: false,
    },
  };

  const CONFIG_KEY = 'ea_config';
  const HISTORY_KEY = 'ea_history';

  function deepMerge(base, over) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    for (const k in over) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])) {
        out[k] = deepMerge(base[k] || {}, over[k]);
      } else {
        out[k] = over[k];
      }
    }
    return out;
  }

  const store = {
    defaults: DEFAULTS,

    async getConfig() {
      const res = await chrome.storage.local.get(CONFIG_KEY);
      return deepMerge(DEFAULTS, res[CONFIG_KEY] || {});
    },

    async setConfig(partial) {
      const cur = await store.getConfig();
      const next = deepMerge(cur, partial);
      await chrome.storage.local.set({ [CONFIG_KEY]: next });
      return next;
    },

    async resetConfig() {
      await chrome.storage.local.set({ [CONFIG_KEY]: {} });
      return Object.assign({}, DEFAULTS);
    },

    async getHistory() {
      const res = await chrome.storage.local.get(HISTORY_KEY);
      return res[HISTORY_KEY] || [];
    },

    async addHistory(entry) {
      const hist = await store.getHistory();
      hist.unshift(Object.assign({ ts: Date.now() }, entry));
      const trimmed = hist.slice(0, 50);
      await chrome.storage.local.set({ [HISTORY_KEY]: trimmed });
      return trimmed;
    },

    async clearHistory() {
      await chrome.storage.local.set({ [HISTORY_KEY]: [] });
      return [];
    },
  };

  EA.store = store;
})();
