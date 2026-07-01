// Sync Activities Web — store.js
// Mesma interface do original, mas usa localStorage em vez de chrome.storage.
(function () {
  const EA = (window.__EA = window.__EA || {});

  const DEFAULTS = {
    delayMs: 700,
    sectionDelayMs: 200,
    retries: 2,
    types: {
      scorm: true, h5pactivity: true, url: true, page: true, resource: true,
      folder: true, book: true, lesson: true, glossary: true, imscp: true,
      subsection: true, generic: true,
    },
    registros: { enabled: true, assign: true, forum: true, workshop: false },
    groqKey: '',
    groqModel: 'llama-3.3-70b-versatile',
    theme: 'sync',
    safeMode: true,
    autoCollapse: false,
    runModes: { atividades: true, registros: false, quiz: false },
  };

  const CONFIG_KEY  = 'ea_config';
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

  function lsGet(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }

  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  const store = {
    defaults: DEFAULTS,

    async getConfig() {
      return deepMerge(DEFAULTS, lsGet(CONFIG_KEY, {}));
    },

    async setConfig(partial) {
      const cur = await store.getConfig();
      const next = deepMerge(cur, partial);
      lsSet(CONFIG_KEY, next);
      return next;
    },

    async resetConfig() {
      lsSet(CONFIG_KEY, {});
      return Object.assign({}, DEFAULTS);
    },

    async getHistory() {
      return lsGet(HISTORY_KEY, []);
    },

    async addHistory(entry) {
      const hist = await store.getHistory();
      hist.unshift(Object.assign({ ts: Date.now() }, entry));
      lsSet(HISTORY_KEY, hist.slice(0, 50));
      return hist;
    },

    async clearHistory() {
      lsSet(HISTORY_KEY, []);
      return [];
    },
  };

  EA.store = store;
})();
