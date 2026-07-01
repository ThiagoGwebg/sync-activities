// Sync Activities Web — api.js
// Igual ao original, mas todas as requisições ao Moodle passam pelo /api/proxy do backend.
// O window.fetch é interceptado automaticamente para URLs do portal.
(function () {
  const EA = (window.__EA = window.__EA || {});

  const BASE = 'https://educacaoprofissional.educacao.sp.gov.br';

  // ── Intercepta fetch para URLs do Moodle ────────────────────────────────────
  // Qualquer módulo (completers, reader, etc.) que fizer fetch(BASE + '...') cai aqui
  // sem precisar de nenhuma alteração nesses módulos.
  const _nativeFetch = window.fetch.bind(window);

  window.fetch = async function (input, opts) {
    const urlStr = typeof input === 'string' ? input
      : (input instanceof URL ? input.href : (input.url || String(input)));

    // Só intercepta URLs do portal Moodle
    if (!urlStr.startsWith(BASE) && !urlStr.startsWith('/mod/') && !urlStr.startsWith('/lib/')) {
      return _nativeFetch(input, opts);
    }

    const method = (opts && opts.method) || 'GET';
    const headers = Object.assign({}, (opts && opts.headers) || {});

    // Serializa o body para string (URLSearchParams, string, etc.)
    let body = null;
    if (opts && opts.body !== undefined && opts.body !== null && method !== 'GET') {
      if (typeof opts.body === 'string') {
        body = opts.body;
      } else if (opts.body instanceof URLSearchParams) {
        body = opts.body.toString();
      } else {
        try { body = JSON.stringify(opts.body); } catch (e) { body = String(opts.body); }
      }
    }

    // Remove headers que causam problemas no proxy
    delete headers['credentials'];
    delete headers['mode'];

    const proxyRes = await _nativeFetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlStr, method, headers, body }),
    });

    return proxyRes;
  };

  // ── API ──────────────────────────────────────────────────────────────────────

  function parseHTML(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  function espera(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  const api = {
    BASE,
    sesskey: '',
    userId: 0,
    parseHTML,
    espera,

    // No contexto web, sesskey/userId vêm do login (injetados via window.__EA_INIT)
    refreshAuth() {
      const init = window.__EA_INIT || {};
      if (init.sesskey && !api.sesskey) api.sesskey = init.sesskey;
      if (init.userId && !api.userId)   api.userId  = init.userId;
      return { sesskey: api.sesskey, userId: api.userId };
    },

    async ensureAuth() {
      api.refreshAuth();

      // Se ainda não tem sesskey, tenta renovar via backend
      if (!api.sesskey) {
        try {
          const r = await _nativeFetch('/api/refresh-auth', { method: 'POST' });
          const d = await r.json();
          if (d.sesskey) { api.sesskey = d.sesskey; api.userId = d.userId; }
        } catch (e) { /* ignora */ }
      }

      return { sesskey: api.sesskey, userId: api.userId };
    },

    async call(methodname, args) {
      if (!api.sesskey) await api.ensureAuth();
      const url = BASE + '/lib/ajax/service.php?sesskey=' + api.sesskey + '&info=' + methodname;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify([{ index: 0, methodname, args }]),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data[0] && data[0].error) {
        throw new Error((data[0].exception && data[0].exception.message) || 'erro na API');
      }
      return data[0].data;
    },

    async getHTML(url) {
      const res = await fetch(url, { credentials: 'include', headers: { Accept: 'text/html' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    },

    async postForm(url, params) {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res;
    },

    async withRetry(fn, tries) {
      tries = tries || 2;
      let lastErr;
      for (let i = 0; i < tries; i++) {
        try { return await fn(); }
        catch (e) { lastErr = e; if (i < tries - 1) await espera(1200); }
      }
      throw lastErr;
    },
  };

  api.refreshAuth();
  EA.api = api;
})();
